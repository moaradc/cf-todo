#!/usr/bin/env python3
"""
cf-todo 阶段 0 黄金基线录制脚本
================================

流程：
  1. 启动 wrangler dev（local D1，端口 8787）
  2. 等待就绪后，POST /api/login 拿到 auth_token + auth_sig（手动解析 Set-Cookie，绕过 Secure 限制）
  3. POST /api/import?mode=overwrite 灌入 .research/baseline_seed.json
  4. 跑 50 条黄金测试用例，每条保存：
       tests/golden/baseline/<NN>_<name>.meta.json   (status/headers/timing)
       tests/golden/baseline/<NN>_<name>.body.<ext>  (response body 原样)
  5. 关闭 wrangler

健壮性设计：
  - 手动 cookie 管理：从 Set-Cookie 头正则提取 auth_token/auth_sig，后续请求
    手动塞 Cookie 头。绕过 Python urllib 对 Secure cookie 的限制
    （cf-todo cookie 设了 Secure，浏览器在 localhost 豁免，但 urllib 不豁免）。
  - 每个网络请求都有 3 次重试，指数退避。
  - wrangler 启动 60s 超时。
  - 出错时打印完整日志尾部 + 保留 wrangler 日志文件。
  - 任何关键步骤失败立即 abort，不静默继续。
  - Set-Cookie 中的 token 部分掩码（保持长度），便于后续回归 diff。
"""

import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import hashlib
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = Path("/home/z/my-project/cf-todo")
BASE_URL = "http://127.0.0.1:8787"
SEED_FILE = ROOT / ".research" / "baseline_seed.json"
OUT_DIR = ROOT / "tests" / "golden" / "baseline"
WRANGLER_LOG = Path("/tmp/wrangler-baseline.log")

ADMIN_PASSWORD = "baseline-test-123"

# ---------- HTTP 工具：手动 cookie 管理 ----------

class HttpClient:
    """手动 cookie 管理的极简 HTTP 客户端，绕过 Secure 限制。"""
    def __init__(self):
        self.cookies = {}  # name -> value

    def _cookie_header(self):
        if not self.cookies:
            return None
        return "; ".join(f"{k}={v}" for k, v in self.cookies.items())

    def request(self, method, path, body=None, headers=None, timeout=15):
        url = BASE_URL + path
        h = dict(headers or {})
        # 显式覆盖 cookie 头（除非调用方传了 Cookie，比如边界测试要清空）
        if "Cookie" not in h and "cookie" not in h:
            ch = self._cookie_header()
            if ch:
                h["Cookie"] = ch

        if body is not None and not isinstance(body, (bytes, bytearray)):
            body = json.dumps(body).encode("utf-8")
            h.setdefault("Content-Type", "application/json")

        req = Request(url, data=body, method=method, headers=h)
        last_err = None
        for attempt in range(3):
            try:
                t0 = time.time()
                resp = urlopen(req, timeout=timeout)
                resp_body = resp.read()
                dt_ms = int((time.time() - t0) * 1000)
                resp_headers = {k: v for k, v in resp.headers.items()}
                # 自动捕获 Set-Cookie（仅 login 路径会触发）
                for sc in resp.headers.get_all("Set-Cookie") or []:
                    m = re.match(r"([^=;]+)=([^;]+)", sc)
                    if m:
                        self.cookies[m.group(1).strip()] = m.group(2).strip()
                return {
                    "status": resp.status,
                    "headers": resp_headers,
                    "body": resp_body,
                    "timing_ms": dt_ms,
                }
            except HTTPError as e:
                resp_body = e.read()
                resp_headers = {k: v for k, v in e.headers.items()} if e.headers else {}
                dt_ms = int((time.time() - t0) * 1000)
                return {
                    "status": e.code,
                    "headers": resp_headers,
                    "body": resp_body,
                    "timing_ms": dt_ms,
                }
            except (URLError, ConnectionError, TimeoutError) as e:
                last_err = e
                time.sleep(1 + attempt * 2)
        raise RuntimeError(f"HTTP {method} {path} failed after 3 retries: {last_err}")


def save_response(case_id, name, response, request_info):
    """保存一条用例的响应。body 单独文件，meta JSON 单独文件。"""
    # headers 大小写不敏感查找 content-type（urllib 返回首字母大写）
    content_type = ""
    for k, v in response["headers"].items():
        if k.lower() == "content-type":
            content_type = v
            break
    if "json" in content_type:
        ext = "json"
    elif "html" in content_type:
        ext = "html"
    elif "javascript" in content_type:
        ext = "js"
    elif "ndjson" in content_type or "x-ndjson" in content_type:
        ext = "ndjson"
    elif "text" in content_type:
        ext = "txt"
    elif "octet-stream" in content_type:
        ext = "bin"
    else:
        ext = "bin"

    fname_base = f"{case_id:02d}_{name}"
    body_path = OUT_DIR / f"{fname_base}.body.{ext}"
    meta_path = OUT_DIR / f"{fname_base}.meta.json"

    body_path.write_bytes(response["body"])

    # 掩码 Set-Cookie 和 Cookie 头中的敏感值（保持长度，便于 diff）
    def mask_cookie(s):
        return re.sub(
            r"(auth_token|auth_sig)=([^\s;]+)",
            lambda m: f"{m.group(1)}=<MASKED_LEN_{len(m.group(2))}>",
            s,
        )

    sanitized_resp_headers = {}
    for k, v in response["headers"].items():
        if k.lower() == "set-cookie":
            sanitized_resp_headers[k] = mask_cookie(v)
        else:
            sanitized_resp_headers[k] = v

    req_headers_sanitized = {}
    for k, v in (request_info.get("headers") or {}).items():
        if k.lower() == "cookie":
            req_headers_sanitized[k] = mask_cookie(v)
        else:
            req_headers_sanitized[k] = v

    meta = {
        "case_id": case_id,
        "name": name,
        "request": {
            "method": request_info["method"],
            "path": request_info["path"],
            "headers": req_headers_sanitized,
            "body_summary": _summarize_body(request_info.get("body")),
        },
        "response": {
            "status": response["status"],
            "headers": sanitized_resp_headers,
            "timing_ms": response["timing_ms"],
            "body_size": len(response["body"]),
            "body_sha256": _sha256(response["body"]),
            "body_ext": ext,
        },
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    return meta


def _summarize_body(body):
    if body is None:
        return None
    if isinstance(body, (dict, list)):
        s = json.dumps(body, ensure_ascii=False)
        return {"json_preview": s[:200] + ("..." if len(s) > 200 else ""), "size": len(s)}
    if isinstance(body, str):
        return {"text_preview": body[:200] + ("..." if len(body) > 200 else ""), "size": len(body)}
    if isinstance(body, (bytes, bytearray)):
        return {"bytes_size": len(body)}
    return None


def _sha256(b):
    return hashlib.sha256(b).hexdigest()


# ---------- Wrangler 管理 ----------

def start_wrangler():
    """启动 wrangler dev，等待就绪。返回 Popen。"""
    if WRANGLER_LOG.exists():
        WRANGLER_LOG.unlink()

    # 阶段 2 起：wrangler dev 前必须先跑 d1 migrations apply，否则表不存在。
    # 本地 D1 state 在 main() 开头已被清理，这里跑 migrate 建表。
    print("  running d1 migrations apply (local)...")
    migrate = subprocess.run(
        ["npx", "wrangler", "d1", "migrations", "apply", "todo-db", "--local"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=60,
    )
    if migrate.returncode != 0:
        print("  ❌ d1 migrations apply failed:")
        print(migrate.stdout[-1000:])
        print(migrate.stderr[-1000:])
        sys.exit(1)
    print("  ✓ migrations applied")

    log_fd = open(WRANGLER_LOG, "w")
    proc = subprocess.Popen(
        ["npx", "wrangler", "dev", "--local", "--port", "8787", "--ip", "127.0.0.1"],
        cwd=str(ROOT),
        stdout=log_fd,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        preexec_fn=os.setsid,
        env={**os.environ, "WRANGLER_LOG": "debug", "NO_COLOR": "1"},
    )
    print(f"  wrangler pid: {proc.pid}")

    for i in range(60):
        time.sleep(1)
        try:
            r = urlopen(f"{BASE_URL}/manifest.json", timeout=3)
            if r.status == 200:
                print(f"  wrangler ready after {i+1}s")
                return proc
        except Exception:
            continue
    print("  ❌ wrangler failed to start in 60s. Log tail:")
    print("-" * 60)
    print(open(WRANGLER_LOG).read()[-3000:])
    proc.terminate()
    raise RuntimeError("wrangler did not become ready")


def stop_wrangler(proc):
    """关闭 wrangler + 子进程。"""
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except Exception:
        pass
    time.sleep(1)
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except Exception:
        pass
    try:
        proc.wait(timeout=5)
    except Exception:
        pass


# ---------- 主流程 ----------

def main():
    print("=" * 60)
    print("cf-todo baseline recording")
    print("=" * 60)

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)

    print("[1/5] starting wrangler dev...")
    proc = start_wrangler()
    client = HttpClient()

    try:
        print("[2/5] logging in...")
        r = client.request("POST", "/api/login", body={"password": ADMIN_PASSWORD})
        if r["status"] != 200:
            print(f"  ❌ login failed: {r['status']} {r['body'][:300]}")
            sys.exit(1)
        login_resp = json.loads(r["body"])
        if not login_resp.get("success"):
            print(f"  ❌ login returned success=false: {login_resp}")
            sys.exit(1)
        print(f"  ✓ logged in, cookies: {list(client.cookies.keys())}")

        print("[3/5] importing seed data (mode=overwrite)...")
        # cf-todo import 协议：3 阶段
        #   1) POST /api/import JSON {phase:'init', importId, mode:'overwrite'}
        #      → 备份旧表 + 创建空 todos/todo_templates/categories
        #   2) POST /api/import?importId=xxx  Content-Type: application/x-ndjson
        #      body = raw NDJSON 文件内容（含首行 'ndjson' 标识）
        #   3) POST /api/import JSON {phase:'finalize', importId, categories, custom_header, custom_content, customColors}
        seed_raw = SEED_FILE.read_bytes()

        # 解析 seed，提取 categories / custom_header / custom_content / customColors 给 finalize 用
        seed_lines = seed_raw.decode("utf-8").splitlines()
        if seed_lines and seed_lines[0].strip() == "ndjson":
            seed_lines = seed_lines[1:]
        categories_data = []
        custom_header_data = None
        custom_content_data = None
        custom_colors_data = None
        todos_ndjson_lines = []
        for line in seed_lines:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            t = obj.get("_type")
            if t == "categories":
                categories_data = obj.get("data", [])
            elif t == "custom_header":
                custom_header_data = obj.get("data", "")
            elif t == "custom_content":
                custom_content_data = obj.get("data", "")
            elif t == "customColors":
                custom_colors_data = obj.get("data", [])
            elif t == "settings":
                # settings 通过另一个接口写，import 不处理
                pass
            elif t == "template":
                todos_ndjson_lines.append(line)
            else:
                # 普通 todo
                todos_ndjson_lines.append(line)

        # 重新组装 NDJSON body（含 'ndjson' 首行，与导出格式一致）
        ndjson_body = ("ndjson\n" + "\n".join(todos_ndjson_lines) + "\n").encode("utf-8")

        import_id = f"baseline-{int(time.time()*1000)}"

        # 阶段 1: init
        r = client.request("POST", "/api/import",
                          body={"phase": "init", "importId": import_id, "mode": "overwrite"},
                          timeout=60)
        if r["status"] != 200:
            print(f"  ❌ import init failed: {r['status']} {r['body'][:300]}")
            sys.exit(1)
        print(f"  ✓ init ok (importId={import_id})")

        # 阶段 2: NDJSON upload
        r = client.request("POST", f"/api/import?importId={import_id}",
                          body=ndjson_body,
                          headers={"Content-Type": "application/x-ndjson"},
                          timeout=120)
        if r["status"] != 200:
            print(f"  ❌ import upload failed: {r['status']} {r['body'][:300]}")
            sys.exit(1)
        print(f"  ✓ uploaded {len(todos_ndjson_lines)} NDJSON lines")

        # 阶段 3: finalize
        finalize_body = {"phase": "finalize", "importId": import_id}
        if categories_data:
            finalize_body["categories"] = categories_data
        if custom_header_data is not None:
            finalize_body["custom_header"] = custom_header_data
        if custom_content_data is not None:
            finalize_body["custom_content"] = custom_content_data
        if custom_colors_data is not None:
            finalize_body["customColors"] = custom_colors_data
        r = client.request("POST", "/api/import", body=finalize_body, timeout=60)
        if r["status"] != 200:
            print(f"  ❌ import finalize failed: {r['status']} {r['body'][:300]}")
            sys.exit(1)
        print(f"  ✓ finalize ok")

        print("[4/5] verifying seed data...")
        r = client.request("GET", "/api/todos?date=2026-03-08")
        todos = json.loads(r["body"])
        if not isinstance(todos, list) or len(todos) == 0:
            print(f"  ⚠️  no todos for 2026-03-08, response: {r['body'][:300]}")
        else:
            print(f"  ✓ {len(todos)} todos on 2026-03-08")

        print("[5/5] recording 50 golden cases...")
        cases = build_cases()
        for case in cases:
            print(f"  [{case['id']:02d}] {case['method']} {case['path']} -> ", end="", flush=True)
            try:
                r = client.request(case["method"], case["path"],
                                  body=case.get("body"),
                                  headers=case.get("headers"),
                                  timeout=case.get("timeout", 15))
                meta = save_response(case["id"], case["name"], r, case)
                print(f"HTTP {r['status']} ({r['timing_ms']}ms, {len(r['body'])}B)")
            except Exception as e:
                print(f"❌ {e}")
                raise

        print()
        print(f"✅ {len(cases)} cases recorded to {OUT_DIR}")

        manifest = {
            "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "wrangler_version": "4.106.0",
            "worker_commit": subprocess.check_output(
                ["git", "-C", str(ROOT), "rev-parse", "HEAD"]
            ).decode().strip(),
            "seed_file_sha256": _sha256(SEED_FILE.read_bytes()),
            "seed_file_records": sum(1 for _ in open(SEED_FILE)) - 1,  # 减去首行 "ndjson"
            "case_count": len(cases),
            "notes": (
                "Set-Cookie 中的 auth_token/auth_sig 已掩码（保持长度便于对比）。"
                "响应体原样保存。后续阶段回归测试时，新版本对相同用例的响应"
                "应 byte-for-byte 一致（除掩码字段 + 时间戳相关字段如 Last-Modified）。"
                "录制脚本本身在 tests/golden/record_baseline.py，可重复执行。"
            ),
            "known_nondeterministic_fields": [
                "Set-Cookie: auth_token / auth_sig 值（已掩码）",
                "Set-Cookie: Max-Age 内的随机 token（已掩码）",
                "/api/v1/keys POST 返回的 key 明文（每次生成都不同）",
                "/api/category-action create 返回的 id（时间戳 + 随机数）",
                "/api/todo-action CREATE 返回的 id（时间戳 + 随机数）",
                "/api/stats range=year 包含年度报告叙事文本，可能含日期",
            ],
        }
        (OUT_DIR / "_manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2)
        )
        print(f"✅ manifest written")

    finally:
        print()
        print("[cleanup] stopping wrangler...")
        stop_wrangler(proc)
        print("  done")


def build_cases():
    """构造 50 条测试用例。返回 list of dict。

    顺序约束：
      - logout 必须放最后（会清除 session）
      - create/update 操作在前，read 在后，便于对比状态变化
    """
    cases = []

    def add(name, method, path, body=None, headers=None, timeout=15):
        cases.append({
            "id": len(cases) + 1,
            "name": name,
            "method": method,
            "path": path,
            "body": body,
            "headers": headers,
            "timeout": timeout,
        })

    # ============ Auth (4) ============
    # login 会创建新 session，wrong_password/empty_body 不会破坏当前 session。
    # logout 单独放到最末尾（第 50 条）避免破坏后续用例的 session。
    add("auth_login_success", "POST", "/api/login", body={"password": ADMIN_PASSWORD})
    add("auth_login_wrong_password", "POST", "/api/login", body={"password": "wrong-password"})
    add("auth_login_empty_body", "POST", "/api/login", body={})
    add("auth_sessions_list", "GET", "/api/sessions")

    # ============ Static (3) ============
    add("static_index_html", "GET", "/")
    add("static_manifest_json", "GET", "/manifest.json")
    add("static_sw_js", "GET", "/sw.js")

    # ============ Settings (4) ============
    add("settings_get", "GET", "/api/settings")
    add("custom_code_get", "GET", "/api/custom-code")
    add("custom_colors_get", "GET", "/api/custom-colors")
    add("custom_header_get", "GET", "/api/custom-header")

    # ============ Categories (4) ============
    # action 必须大写：CREATE/UPDATE/BATCH_DELETE
    add("categories_list", "GET", "/api/categories")
    add("categories_create", "POST", "/api/category-action", body={
        "action": "CREATE",
        "name": "baseline-test-cat",
        "color": "#FF5722",
    })
    add("categories_list_after_create", "GET", "/api/categories")
    add("categories_create_duplicate_name", "POST", "/api/category-action", body={
        "action": "CREATE",
        "name": "baseline-test-cat",
        "color": "#FF5722",
    })

    # ============ Todos CRUD (10) ============
    # V0 /api/todos 只接受 date（不支持 range；range 在 V1 才有）
    add("todos_get_single_date", "GET", "/api/todos?date=2026-03-08")
    add("todos_get_empty_date", "GET", "/api/todos?date=2025-01-01")
    add("todos_get_invalid_date_format", "GET", "/api/todos?date=2026-13-45")
    add("todos_get_missing_date", "GET", "/api/todos")
    # CREATE 需要 task.id（前端生成 timestamp+random）
    add("todos_create_simple", "POST", "/api/todo-action", body={
        "action": "CREATE",
        "task": {
            "id": "baseline-create-simple-001",
            "date": "2026-07-01",
            "text": "baseline-test-todo",
            "priority": "med",
            "type": "none",
        },
    })
    add("todos_create_fragment", "POST", "/api/todo-action", body={
        "action": "CREATE",
        "task": {
            "id": "baseline-create-fragment-001",
            "date": "2026-07-01",
            "text": "baseline-fragment-test",
            "type": "fragment",
            "time": "10:00",
            "end_time": "12:00",
        },
    })
    add("todos_create_recurring_daily", "POST", "/api/todo-action", body={
        "action": "CREATE",
        "task": {
            "id": "baseline-create-recurring-001",
            "date": "2026-07-01",
            "text": "baseline-recurring-daily",
            "type": "recurring",
            "rrule": "FREQ=DAILY",
            "anchor_date": "2026-07-01",
        },
    })
    add("todos_get_after_creates", "GET", "/api/todos?date=2026-07-01")
    # UPDATE nonexistent - task 必填且 id 必填
    add("todos_update_nonexistent", "POST", "/api/todo-action", body={
        "action": "UPDATE",
        "task": {
            "id": "nonexistent-id-baseline-test",
            "text": "should-fail",
        },
    })
    # DELETE nonexistent 改用 BATCH_DELETE 避免单 DELETE 在内部读 parent_id 时 500
    add("todos_batch_delete_nonexistent", "POST", "/api/todo-action", body={
        "action": "BATCH_DELETE",
        "ids": ["nonexistent-id-baseline-test"],
        "scope": "this",
    })

    # ============ Time records (1) ============
    add("time_records_get", "GET", "/api/time-records?parent_id=baseline-test-todo")

    # ============ Trash (3) ============
    add("trash_list", "GET", "/api/trash")
    add("trash_action_restore_nonexistent", "POST", "/api/trash-action", body={
        "action": "RESTORE",
        "id": "nonexistent-trash-id-baseline",
    })
    add("trash_action_invalid_action", "POST", "/api/trash-action", body={
        "action": "INVALID_ACTION",
        "id": "some-id",
    })

    # ============ Stats (4) ============
    # V0 /api/stats 用 start + end（YYYY-MM-DD），不支持 range
    add("stats_week", "GET", "/api/stats?start=2026-06-25&end=2026-07-01")
    add("stats_12weeks", "GET", "/api/stats?start=2026-04-09&end=2026-07-01")
    add("stats_6months", "GET", "/api/stats?start=2026-01-01&end=2026-07-01")
    add("stats_year", "GET", "/api/stats?start=2026-01-01&end=2026-12-31")

    # ============ Export (1) ============
    add("export_stream", "GET", "/api/export?mode=stream", timeout=60)

    # ============ Hot Search (1) ============
    add("hot_search", "GET", "/api/hot-search")

    # ============ V1 API (10) ============
    # V1 /api/v1/keys action 必须大写：CREATE/DELETE/TOGGLE/RENAME
    add("v1_keys_create", "POST", "/api/v1/keys", body={
        "action": "CREATE",
        "name": "baseline-test-key",
        "scope": "v1",
    })
    add("v1_keys_list", "GET", "/api/v1/keys")
    add("v1_todos_get", "GET", "/api/v1/todos?date=2026-03-08")
    add("v1_todos_get_range", "GET", "/api/v1/todos?start_date=2026-03-08&end_date=2026-03-10")
    add("v1_todos_get_expand_false", "GET", "/api/v1/todos?date=2026-03-08&expand=false")
    add("v1_todos_create", "POST", "/api/v1/todos", body={
        "date": "2026-07-01",
        "text": "baseline-v1-test-todo",
        "priority": "high",
        "type": "none",
    })
    # V1 batch action 合法值：BATCH_TOGGLE_DONE / BATCH_DELETE
    add("v1_todos_batch_toggle_nonexistent", "POST", "/api/v1/todos/batch", body={
        "action": "BATCH_TOGGLE_DONE",
        "ids": ["nonexistent-1", "nonexistent-2"],
    })
    add("v1_categories_list", "GET", "/api/v1/categories")
    add("v1_trash_list", "GET", "/api/v1/trash")
    # V1 stats 也用 start+end
    add("v1_stats", "GET", "/api/v1/stats?start=2026-06-25&end=2026-07-01")

    # ============ 边界 (4) ============
    add("boundary_404_unknown_path", "GET", "/api/nonexistent-endpoint")
    add("boundary_method_not_allowed", "DELETE", "/api/login")
    add("boundary_v1_no_auth", "GET", "/api/v1/todos?date=2026-03-08",
        headers={"Cookie": ""})  # 显式清空 cookie
    add("boundary_static_unknown_path", "GET", "/some-unknown-spa-route-xyz")

    # ============ Auth: logout (1，放最后避免破坏后续用例的 session) ============
    # logout 会清除当前 session token，必须放在所有需要鉴权的用例之后。
    add("auth_logout", "POST", "/api/logout")

    assert len(cases) == 50, f"expected 50 cases, got {len(cases)}"
    return cases


if __name__ == "__main__":
    main()
