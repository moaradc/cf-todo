/**
 * 第二轮深挖：边界场景 + 数值声明
 */
const BASE = 'https://test.945426.xyz';
const API_KEY = 'cfk_JNLcDpngq0rcDZvLBGL6Ahu1wTW7U3_-jaYAuWUmRis';
const WEB_PW = '123456';

let pass = 0, fail = 0;
const issues = [];
function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`    ${detail}`); issues.push(`${label}: ${detail||''}`); }

async function api(method, path, body, headers = {}) {
  const opts = { method, headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = { _raw: text }; }
  return { status: res.status, json, headers: res.headers };
}

const createdIds = [];
async function cleanup(id) { if (id) await api('DELETE', `/api/v1/todos/${id}?scope=all`); }

let cookie = '';
async function v0Login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: WEB_PW }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const m1 = setCookie.match(/auth_token=([^;]+)/);
  const m2 = setCookie.match(/auth_sig=([^;]+)/);
  if (m1 && m2) cookie = `auth_token=${m1[1]}; auth_sig=${m2[1]}`;
  return { ok: !!cookie, setCookie };
}
async function v0Api(body) {
  return api('POST', '/api/todo-action', body, cookie ? { Cookie: cookie } : {});
}
async function v0Get(path) {
  return api('GET', path, null, cookie ? { Cookie: cookie } : {});
}

console.log('='.repeat(70));
console.log('第二轮深挖：边界场景 + 数值声明');
console.log('='.repeat(70));

// ============================================================
// §3.1 Cookie 属性
// 文档 line 707: HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
// ============================================================
console.log('\n[§3.1 Cookie 属性]');
const loginInfo = await v0Login();
if (loginInfo.ok) {
  const sc = loginInfo.setCookie;
  if (/HttpOnly/i.test(sc)) ok('Cookie 含 HttpOnly');
  else ko('Cookie 缺 HttpOnly');
  if (/Secure/i.test(sc)) ok('Cookie 含 Secure');
  else ko('Cookie 缺 Secure');
  // 文档说 SameSite=Strict
  if (/SameSite=Strict/i.test(sc)) ok('Cookie SameSite=Strict');
  else if (/SameSite=Lax/i.test(sc)) ko('Cookie SameSite=Lax（文档说 Strict）', sc);
  else ko('Cookie SameSite 不符', sc);
  // 文档说 Max-Age=2592000
  const maxAgeMatch = sc.match(/Max-Age=(\d+)/i);
  if (maxAgeMatch) {
    if (maxAgeMatch[1] === '2592000') ok(`Max-Age=2592000（30天）`);
    else ko('Max-Age 不符', `期望 2592000，实际 ${maxAgeMatch[1]}`);
  } else ko('Cookie 无 Max-Age');
} else ko('登录失败');

// ============================================================
// §2.3 limit 默认值与最大值
// 文档 line 144: limit 默认 100，最大 500
// ============================================================
console.log('\n[§2.3 limit 参数]');
// 不传 limit → 默认 100
const defRes = await api('GET', '/api/v1/todos');
if (defRes.json?.pagination?.limit === 100) ok('默认 limit=100');
else ko('默认 limit 不符', defRes.json?.pagination?.limit);

// 传 limit=500 → 应接受
const maxRes = await api('GET', '/api/v1/todos?limit=500');
if (maxRes.json?.pagination?.limit === 500) ok('limit=500 被接受');
else ko('limit=500 不符', maxRes.json?.pagination?.limit);

// 传 limit=1000 → 应被截断为 500
const overRes = await api('GET', '/api/v1/todos?limit=1000');
if (overRes.json?.pagination?.limit === 500) ok('limit=1000 被截断为 500');
else ko('limit=1000 未截断', overRes.json?.pagination?.limit);

// 传 limit=0 → 应被提升为 1（文档说最小 1）
const zeroRes = await api('GET', '/api/v1/todos?limit=0');
if (zeroRes.json?.pagination?.limit >= 1) ok(`limit=0 被提升为 ${zeroRes.json.pagination.limit}`);
else ko('limit=0 未处理', zeroRes.json?.pagination?.limit);

// ============================================================
// §3.4 V0 trash 固定返回 100 条
// 文档 line 823-824: 最近 100 条，V0 不支持分页
// ============================================================
console.log('\n[§3.4 V0 trash 固定 100 条]');
if (cookie) {
  const v0Trash = await v0Get('/api/trash');
  if (v0Trash.status === 200) {
    // V0 trash 响应格式：可能是数组或对象
    const items = Array.isArray(v0Trash.json) ? v0Trash.json : (v0Trash.json.data || v0Trash.json.todos || []);
    console.log(`  V0 trash 返回 ${items.length} 条`);
    // 文档说固定 100 条，但实际可能少于 100（如果回收站不够 100 条）
    // 这里只验证不超过 100
    if (items.length <= 100) ok(`V0 trash 条数 ≤ 100（${items.length}）`);
    else ko('V0 trash 超过 100 条', items.length);
  } else ko('V0 trash GET 失败', v0Trash.status);
}

// ============================================================
// §5.6 expand=false 在 date 查询时返回 templates
// 但范围查询返回空数组（已验证）
// 验证：date 查询 expand=true 不返回 templates 字段
// ============================================================
console.log('\n[§5.6 expand=true 不返回 templates]');
const expTrue = await api('GET', '/api/v1/todos?date=2026-06-29&expand=true');
if (expTrue.status === 200) {
  if (expTrue.json.templates === undefined) ok('expand=true 不返回 templates 字段');
  else ko('expand=true 不应返回 templates', `count=${expTrue.json.templates.length}`);
}

// ============================================================
// §2.3 V1 POST 必填字段校验
// 文档说：date 和 text 为必填项（碎时记允许 date 为空）
// ============================================================
console.log('\n[§2.3 V1 POST 必填字段]');
// 缺 text → 400
const noText = await api('POST', '/api/v1/todos', { date: '2026-06-29' });
if (noText.status === 400) ok('缺 text → 400');
else ko('缺 text 未拒绝', noText.status);

// 缺 date + 非 fragment → 400
const noDate = await api('POST', '/api/v1/todos', { text: 'no-date' });
if (noDate.status === 400) ok('缺 date + 非 fragment → 400');
else ko('缺 date 未拒绝', noDate.status);

// fragment + 缺 date → 应通过（碎时记允许 date 为空）
const fragNoDate = await api('POST', '/api/v1/todos', { text: 'frag-no-date', repeat_type: 'fragment' });
const fragNoDateId = fragNoDate.json?.data?.id;
createdIds.push(fragNoDateId);
if (fragNoDate.status === 201) ok('fragment + 缺 date → 201（碎时记允许 date 为空）');
else ko('fragment + 缺 date 应通过', `${fragNoDate.status}: ${JSON.stringify(fragNoDate.json).slice(0,100)}`);

// ============================================================
// §4.1 V1 响应字段类型
// 文档说：done/deleted 为布尔，priority 为 low/med/high
// ============================================================
console.log('\n[§4.1 V1 响应字段类型]');
const typeRes = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'type-test', priority: 'medium'
});
const typeId = typeRes.json?.data?.id;
createdIds.push(typeId);
if (typeRes.status === 201) {
  const d = typeRes.json.data;
  if (typeof d.done === 'boolean') ok('done 为 boolean');
  else ko('done 类型不符', typeof d.done);
  if (typeof d.deleted === 'boolean') ok('deleted 为 boolean');
  else ko('deleted 类型不符', typeof d.deleted);
  // priority='medium' 应被规范化为 'med'
  if (d.priority === 'med') ok("priority='medium' 规范化为 'med'");
  else ko('priority 规范化失败', d.priority);
}

// ============================================================
// §5.3 重复 todo 模板创建
// 文档说：仅 daily/weekly/monthly/yearly 才创建模板
// ============================================================
console.log('\n[§5.3 重复 todo 模板创建]');
// weekly → 应创建模板
const wkRes = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'wk-template', repeat_type: 'weekly', repeat_interval: 1
});
const wkId = wkRes.json?.data?.id;
createdIds.push(wkId);
if (wkRes.status === 201) {
  // 查 expand=false 看是否有对应 template
  const tplRes = await api('GET', '/api/v1/todos?date=2026-06-29&expand=false');
  const hasTpl = (tplRes.json.templates || []).some(t => t.parent_id === wkId);
  if (hasTpl) ok('weekly 创建了模板');
  else ko('weekly 未创建模板');
}

// none → 不应创建模板
const noneRes = await api('POST', '/api/v1/todos', { date: '2026-06-29', text: 'none-tpl' });
const noneId = noneRes.json?.data?.id;
createdIds.push(noneId);
if (noneRes.status === 201) {
  const tplRes = await api('GET', '/api/v1/todos?date=2026-06-29&expand=false');
  const hasTpl = (tplRes.json.templates || []).some(t => t.parent_id === noneId);
  if (!hasTpl) ok('none 未创建模板');
  else ko('none 不应创建模板');
}

// fragment → 不应创建模板
if (fragNoDateId) {
  // fragment 的 date 可能为空，查不到 template
  const fragGet = await api('GET', `/api/v1/todos/${fragNoDateId}`);
  if (fragGet.json?.data?.repeat_type === 'fragment') {
    // 查所有可能的 template
    const tplRes = await api('GET', '/api/v1/todos?date=2026-06-29&expand=false');
    const hasTpl = (tplRes.json.templates || []).some(t => t.parent_id === fragNoDateId);
    if (!hasTpl) ok('fragment 未创建模板');
    else ko('fragment 不应创建模板');
  }
}

// ============================================================
// §2.3 V1 DELETE scope 参数
// 文档说：scope=all 删除全系列
// ============================================================
console.log('\n[§2.3 V1 DELETE scope]');
const delRes = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'del-test', repeat_type: 'weekly'
});
const delId = delRes.json?.data?.id;
if (delId) {
  // 在 2026-07-06 展开一个实例
  await api('GET', '/api/v1/todos?date=2026-07-06&expand=true');
  // DELETE scope=all
  const d = await api('DELETE', `/api/v1/todos/${delId}?scope=all`);
  if (d.status === 200) {
    // 验证 todo 已删除
    const check = await api('GET', `/api/v1/todos/${delId}`);
    if (check.status === 404 || check.json?.data?.deleted === true) ok('DELETE scope=all 成功');
    else ko('DELETE 后仍可访问', check.status);
  } else ko('DELETE 失败', d.status);
}

// ============================================================
// §5.4 碎时记 fragment_anchor
// 文档说：fragment_anchor 同步存起始日期，作为取消完成时恢复的权威副本
// ============================================================
console.log('\n[§5.4 fragment_anchor]');
if (fragNoDateId) {
  const fragGet = await api('GET', `/api/v1/todos/${fragNoDateId}`);
  if (fragGet.status === 200) {
    const d = fragGet.json.data;
    // fragment 未完成时，fragment_anchor 应为空或等于 date
    console.log(`  date=${JSON.stringify(d.date)}, fragment_anchor=${JSON.stringify(d.fragment_anchor)}`);
    if (d.repeat_type === 'fragment') ok('repeat_type=fragment');
    else ko('repeat_type 不符', d.repeat_type);
    // 文档说：未完成碎时记 fragment_anchor 与 date 一致
    // fragment 允许 date 为空，此时 fragment_anchor 也应为空
    if (d.date === '' && d.fragment_anchor === '') ok('未完成 fragment + 空 date → fragment_anchor 空');
    else if (d.date === d.fragment_anchor) ok('未完成 fragment → fragment_anchor = date');
    else ko('fragment_anchor 与 date 关系不符', `date=${d.date}, anchor=${d.fragment_anchor}`);
  }
}

// ============================================================
// §2.4 Category API
// 文档说：POST /api/v1/categories 创建分类
// ============================================================
console.log('\n[§2.4 Category API]');
const catRes = await api('POST', '/api/v1/categories', {
  name: 'audit-cat-' + Date.now(), color: '#ff0000'
});
const catId = catRes.json?.data?.id;
if (catRes.status === 201 || catRes.status === 200) {
  ok(`创建分类成功 (HTTP ${catRes.status})`);
  // 清理
  if (catId) await api('DELETE', `/api/v1/categories/${catId}`);
} else {
  ko('创建分类失败', `${catRes.status}: ${JSON.stringify(catRes.json).slice(0,100)}`);
}

// ============================================================
// 清理
// ============================================================
console.log('\n[清理]');
for (const id of createdIds) {
  if (id) {
    await cleanup(id);
    console.log(`  deleted ${id}`);
  }
}

console.log('\n' + '='.repeat(70));
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log('='.repeat(70));
if (issues.length) {
  console.log('\n问题清单:');
  issues.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
}
process.exit(fail > 0 ? 1 : 0);
