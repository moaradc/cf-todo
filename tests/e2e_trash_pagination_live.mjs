/**
 * V0 trash 自动分页实测（精简版）
 * 用 V0 CREATE 批量创建 105 条 → 批量删除 → 验证 V0 trash 返回 ≥105 条
 */
const BASE = 'https://test.945426.xyz';
const API_KEY = 'cfk_JNLcDpngq0rcDZvLBGL6Ahu1wTW7U3_-jaYAuWUmRis';
const WEB_PW = '123456';

async function api(method, path, body, headers = {}) {
  const opts = { method, headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = { _raw: text }; }
  return { status: res.status, json };
}

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: WEB_PW }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const m1 = setCookie.match(/auth_token=([^;]+)/);
  const m2 = setCookie.match(/auth_sig=([^;]+)/);
  return (m1 && m2) ? `auth_token=${m1[1]}; auth_sig=${m2[1]}` : '';
}

let pass = 0, fail = 0;
function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`    ${detail}`); }

console.log('='.repeat(60));
console.log('V0 trash 自动分页实测（精简版）');
console.log('='.repeat(60));

// 1. 登录
console.log('\n[1] 登录');
const cookie = await login();
if (cookie) ok('登录成功');
else { ko('登录失败'); process.exit(1); }

// 2. 批量创建 105 条（用 V1 POST，并发加速）
console.log('\n[2] 并发创建 105 条测试 todo');
const createdIds = [];
const batchSize = 15; // 每批 15 条并发
for (let i = 0; i < 105; i += batchSize) {
  const promises = [];
  for (let j = 0; j < batchSize && i + j < 105; j++) {
    promises.push(api('POST', '/api/v1/todos', {
      date: '2026-06-29', text: `pgtest-${i+j}`, repeat_type: 'none'
    }));
  }
  const results = await Promise.all(promises);
  for (const r of results) {
    if (r.json?.data?.id) createdIds.push(r.json.data.id);
  }
  process.stdout.write(`  创建进度: ${createdIds.length}/105\r`);
}
console.log(`  创建了 ${createdIds.length} 条                    `);

// 3. 批量删除（用 V1 batch DELETE）
console.log('\n[3] 批量删除（移到回收站）');
// V1 batch endpoint
for (let i = 0; i < createdIds.length; i += 99) {
  const batch = createdIds.slice(i, i + 99);
  await api('POST', '/api/v1/todos/batch', {
    action: 'BATCH_DELETE', ids: batch
  });
  process.stdout.write(`  删除进度: ${Math.min(i+99, createdIds.length)}/${createdIds.length}\r`);
}
console.log(`  删除完成                                  `);

// 4. V1 trash 确认总数
console.log('\n[4] V1 trash 确认总数');
const v1Trash = await api('GET', '/api/v1/trash?limit=1');
const total = v1Trash.json?.pagination?.total;
console.log(`  V1 trash total: ${total}`);
if (total >= 105) ok(`回收站总数 ${total} ≥ 105`);
else ko(`回收站总数 ${total} < 105`);

// 5. V0 trash 验证自动分页
console.log('\n[5] V0 trash 自动分页验证（关键）');
const v0Res = await fetch(`${BASE}/api/trash`, { headers: { Cookie: cookie } });
const v0Text = await v0Res.text();
let v0Trash;
try { v0Trash = JSON.parse(v0Text); } catch (e) { v0Trash = null; }

if (Array.isArray(v0Trash)) {
  ok('V0 trash 返回纯数组');
  console.log(`  返回条数: ${v0Trash.length}`);
  if (v0Trash.length >= 105) {
    ok(`返回 ${v0Trash.length} 条 ≥ 105（自动分页生效，旧代码会截断为 100）`);
  } else if (v0Trash.length === 100) {
    ko('返回 100 条（旧代码行为，自动分页未部署）');
  } else {
    ko(`返回 ${v0Trash.length} 条，期望 ≥105`);
  }
  // 检查测试数据
  const ourItems = v0Trash.filter(t => t.text?.startsWith('pgtest-'));
  console.log(`  测试数据: ${ourItems.length}/105`);
} else {
  ko('V0 trash 不是数组', v0Text.slice(0, 200));
}

// 6. V1 trash offset 上限
console.log('\n[6] V1 trash offset 上限保护');
const offRes = await api('GET', '/api/v1/trash?offset=99999');
if (offRes.json?.pagination?.offset === 10000) ok('offset=99999 → 截断为 10000');
else ko('offset 上限不符', offRes.json?.pagination?.offset);

// 7. 清理
console.log('\n[7] 清理测试数据');
if (v0Trash && Array.isArray(v0Trash)) {
  const ourIds = v0Trash.filter(t => t.text?.startsWith('pgtest-')).map(t => t.id);
  for (let i = 0; i < ourIds.length; i += 99) {
    const batch = ourIds.slice(i, i + 99);
    await api('POST', '/api/v1/trash-action', {
      action: 'BATCH_DELETE_PERMANENT', ids: batch
    });
  }
  console.log(`  清理了 ${ourIds.length} 条`);
}

console.log('\n' + '='.repeat(60));
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log('='.repeat(60));
process.exit(fail > 0 ? 1 : 0);
