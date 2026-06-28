/**
 * API_Wiki.md 全面实测脚本
 * 照抄文档示例 + 边界场景，记录所有不一致
 *
 * 用法: node tests/e2e_api_wiki_audit.mjs
 */
const BASE = 'https://test.945426.xyz';
const API_KEY = 'cfk_JNLcDpngq0rcDZvLBGL6Ahu1wTW7U3_-jaYAuWUmRis';
const WEB_PW = '123456';

let pass = 0, fail = 0;
const issues = [];
function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`    ${detail}`); issues.push(`${label}: ${detail||''}`); }

async function api(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = { _raw: text }; }
  return { status: res.status, json };
}

const createdIds = [];
async function cleanup(id) { if (id) await api('DELETE', `/api/v1/todos/${id}?scope=all`); }

// V0 cookie auth
let cookie = '';
async function v0Login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: WEB_PW }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const m1 = setCookie.match(/auth_token=([^;]+)/);
  const m2 = setCookie.match(/auth_sig=([^;]+)/);
  if (m1 && m2) cookie = `auth_token=${m1[1]}; auth_sig=${m2[1]}`;
  return !!cookie;
}
async function v0Api(body) {
  return api('POST', '/api/todo-action', body, cookie ? { Cookie: cookie } : {});
}

console.log('='.repeat(70));
console.log('API_Wiki.md 全面实测');
console.log('='.repeat(70));

// ============================================================
// §2.1 鉴权：API Key 三种传递方式
// 文档 §6 说：X-API-Key / Query api_key / Bearer Token
// ============================================================
console.log('\n[§2.1/§6 鉴权] API Key 三种传递方式');

// 方式1: X-API-Key Header
const r1 = await api('GET', '/api/v1/todos?limit=1');
if (r1.status === 200) ok('X-API-Key Header 鉴权成功');
else ko(`X-API-Key Header 失败: HTTP ${r1.status}`);

// 方式2: Query 参数
const r2 = await api('GET', `/api/v1/todos?limit=1&api_key=${API_KEY}`, null, { 'X-API-Key': '' });
if (r2.status === 200) ok('Query api_key 鉴权成功');
else ko(`Query api_key 失败: HTTP ${r2.status}`);

// 方式3: Bearer Token
const r3 = await api('GET', '/api/v1/todos?limit=1', null, { 'X-API-Key': '', 'Authorization': `Bearer ${API_KEY}` });
if (r3.status === 200) ok('Bearer Token 鉴权成功');
else ko(`Bearer Token 失败: HTTP ${r3.status}`);

// ============================================================
// §2.3 V1 Todo API — POST 响应字段
// 文档 §5.6 示例1 说：V1 POST 返回 27 字段完整记录
// ============================================================
console.log('\n[§2.3/§5.6 V1 POST 响应字段]');
const postRes = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'audit-post', desc: '描述', url: 'https://test.com',
  priority: 'high', repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  repeat_interval: 1, subtasks: [{ text: '子任务', done: false }]
});
const postId = postRes.json?.data?.id;
createdIds.push(postId);
if (postRes.status === 201) {
  const d = postRes.json.data;
  const fields = Object.keys(d);
  if (fields.length === 27) ok(`POST 201 返回 27 字段`);
  else ko(`POST 响应字段数不符`, `期望 27，实际 ${fields.length}: ${fields.join(',')}`);
  // 检查关键字段
  const expected = ['id','parent_id','date','text','time','priority','desc','url','copy_text','subtasks','search_terms','done','deleted','repeat_type','repeat_custom','repeat_end','end_time','category_id','recurrence_id','is_exception','is_series','repeat_interval','time_records','last_completed_at','last_duration_ms','is_zero_duration','fragment_anchor'];
  const missing = expected.filter(f => !(f in d));
  if (missing.length === 0) ok('所有 27 字段都存在');
  else ko('缺失字段', missing.join(', '));
  if (d.desc === '描述') ok('desc 字段值正确');
  else ko('desc 值不符', d.desc);
  if (d.is_series === true) ok('is_series=true（weekly）');
  else ko('is_series 不符', d.is_series);
} else {
  ko(`POST 失败: HTTP ${postRes.status}`, JSON.stringify(postRes.json).slice(0,200));
}

// ============================================================
// §2.3 V1 Todo API — GET 单个
// 文档 §4.1 说 V1 返回 formatTodo 格式
// ============================================================
console.log('\n[§2.3/§4.1 V1 GET 单个 todo]');
if (postId) {
  const getRes = await api('GET', `/api/v1/todos/${postId}`);
  if (getRes.status === 200 && getRes.json.success) {
    ok('GET 200');
    const d = getRes.json.data;
    if (d.id === postId) ok('id 匹配');
    else ko('id 不匹配', `${d.id} vs ${postId}`);
    // V1 应返回解析后的 subtasks 数组
    if (Array.isArray(d.subtasks)) ok('subtasks 已解析为数组');
    else ko('subtasks 未解析', typeof d.subtasks);
  } else ko('GET 失败', JSON.stringify(getRes.json).slice(0,200));
}

// ============================================================
// §2.3 V1 Todo API — GET 列表 expand=false
// 文档 §5.6 示例4 说：templates 数组含 18 字段
// ============================================================
console.log('\n[§2.3/§5.6 expand=false templates 字段]');
const expandRes = await api('GET', '/api/v1/todos?date=2026-06-29&expand=false');
if (expandRes.status === 200) {
  ok('expand=false GET 200');
  if (expandRes.json.expand === false) ok('expand=false 字段正确');
  else ko('expand 字段不符', expandRes.json.expand);
  if (Array.isArray(expandRes.json.templates)) ok('templates 是数组');
  else ko('templates 不是数组', typeof expandRes.json.templates);
  // 找到我们创建的 todo 的 template
  const tpl = (expandRes.json.templates || []).find(t => t.parent_id === postId);
  if (tpl) {
    const tplFields = Object.keys(tpl);
    if (tplFields.length === 18) ok(`template 字段数 18`);
    else ko(`template 字段数不符`, `期望 18，实际 ${tplFields.length}: ${tplFields.join(',')}`);
    // subtasks 应已 parse 为数组
    if (Array.isArray(tpl.subtasks)) ok('template.subtasks 已 parse 为数组');
    else ko('template.subtasks 未 parse', typeof tpl.subtasks);
    // search_terms / exdates / time_records 应为字符串
    if (typeof tpl.search_terms === 'string') ok('template.search_terms 保留字符串');
    else ko('template.search_terms 类型不符', typeof tpl.search_terms);
    if (typeof tpl.exdates === 'string') ok('template.exdates 保留字符串');
    else ko('template.exdates 类型不符', typeof tpl.exdates);
    if (typeof tpl.time_records === 'string') ok('template.time_records 保留字符串');
    else ko('template.time_records 类型不符', typeof tpl.time_records);
    if (tpl.repeat_custom === 'FREQ=WEEKLY;BYDAY=MO,WE,FR') ok('template.repeat_custom 正确');
    else ko('template.repeat_custom 不符', tpl.repeat_custom);
  } else {
    ko('未找到 template', `templates count: ${(expandRes.json.templates||[]).length}`);
  }
} else ko('expand=false 失败', JSON.stringify(expandRes.json).slice(0,200));

// ============================================================
// §5.6 联动推导 — repeat_custom 反推 repeat_type
// 文档说：repeat_custom 非空 + repeat_type=none → 反推
// ============================================================
console.log('\n[§5.6 联动推导: custom 反推 type]');
const deriveRes = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'derive-test', repeat_custom: 'FREQ=DAILY;INTERVAL=3'
  // 不传 repeat_type，默认 none
});
const deriveId = deriveRes.json?.data?.id;
createdIds.push(deriveId);
if (deriveRes.status === 201) {
  const d = deriveRes.json.data;
  if (d.repeat_type === 'daily') ok('repeat_custom=FREQ=DAILY 反推为 daily');
  else ko('反推失败', `repeat_type=${d.repeat_type}`);
  if (d.repeat_custom === 'FREQ=DAILY;INTERVAL=3') ok('repeat_custom 保留');
  else ko('repeat_custom 丢失', d.repeat_custom);
  if (d.is_series === true) ok('is_series=true');
  else ko('is_series 不符', d.is_series);
} else ko('POST 失败', JSON.stringify(deriveRes.json).slice(0,200));

// ============================================================
// §5.6 联动推导 — 不覆盖显式 fragment
// 文档说：repeat_type=fragment + repeat_custom → 尊重 fragment，不反推
// ============================================================
console.log('\n[§5.6 联动推导: 不覆盖 fragment]');
const fragRes = await api('POST', '/api/v1/todos', {
  date: '', text: 'fragment-derive-test', repeat_type: 'fragment', repeat_custom: 'FREQ=DAILY'
});
const fragId = fragRes.json?.data?.id;
createdIds.push(fragId);
if (fragRes.status === 201) {
  const d = fragRes.json.data;
  if (d.repeat_type === 'fragment') ok('repeat_type=fragment 保留（未被反推）');
  else ko('fragment 被覆盖', `repeat_type=${d.repeat_type}`);
  if (d.repeat_custom === '') ok('fragment 强制清空 repeat_custom');
  else ko('fragment 未清空 custom', d.repeat_custom);
} else ko('POST 失败', JSON.stringify(fragRes.json).slice(0,200));

// ============================================================
// §5.6 原子组校验 — repeat_end + repeat_type=none → 400
// ============================================================
console.log('\n[§5.6 原子组: repeat_end + none → 400]');
const e1 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'conflict1', repeat_type: 'none', repeat_end: '2026-12-31'
});
if (e1.status === 400) ok('repeat_end + none → 400');
else ko(`期望 400，实际 ${e1.status}`, JSON.stringify(e1.json).slice(0,150));

// ============================================================
// §5.6 原子组校验 — repeat_interval=2 + repeat_type=none → 400
// ============================================================
console.log('\n[§5.6 原子组: repeat_interval=2 + none → 400]');
const e2 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'conflict2', repeat_type: 'none', repeat_interval: 2
});
if (e2.status === 400) ok('repeat_interval=2 + none → 400');
else ko(`期望 400，实际 ${e2.status}`, JSON.stringify(e2.json).slice(0,150));

// ============================================================
// §5.6 原子组校验 — time > end_time → 400
// ============================================================
console.log('\n[§5.6 原子组: time > end_time → 400]');
const e3 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'conflict3', time: '18:00', end_time: '09:00'
});
if (e3.status === 400) ok('time(18:00) > end_time(09:00) → 400');
else ko(`期望 400，实际 ${e3.status}`, JSON.stringify(e3.json).slice(0,150));

// ============================================================
// §5.6 格式校验 — 日期格式错误 → 400
// 文档说：date 必须 YYYY-MM-DD 且真实存在
// ============================================================
console.log('\n[§5.6 格式校验: 日期]');
const e4 = await api('POST', '/api/v1/todos', {
  date: '2026-13-45', text: 'bad-date'
});
if (e4.status === 400) ok('非法日期 2026-13-45 → 400');
else ko(`期望 400，实际 ${e4.status}`, JSON.stringify(e4.json).slice(0,150));

const e5 = await api('POST', '/api/v1/todos', {
  date: '20260629', text: 'bad-date2'
});
if (e5.status === 400) ok('非 YYYY-MM-DD 格式 → 400');
else ko(`期望 400，实际 ${e5.status}`, JSON.stringify(e5.json).slice(0,150));

// ============================================================
// §5.6 格式校验 — 时间格式错误 → 400
// 文档说：time 必须 HH:MM 且范围合法
// ============================================================
console.log('\n[§5.6 格式校验: 时间]');
const e6 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'bad-time', time: '25:99'
});
if (e6.status === 400) ok('非法时间 25:99 → 400');
else ko(`期望 400，实际 ${e6.status}`, JSON.stringify(e6.json).slice(0,150));

const e7 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'bad-time2', time: '9:30'
});
if (e7.status === 400) ok('非 HH:MM 格式 9:30 → 400');
else ko(`期望 400，实际 ${e7.status}`, JSON.stringify(e7.json).slice(0,150));

// ============================================================
// §5.6 repeat_custom 校验 — SECONDLY → 400
// ============================================================
console.log('\n[§5.6 repeat_custom 校验: SECONDLY]');
const e8 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'secondly', repeat_type: 'daily', repeat_custom: 'FREQ=SECONDLY'
});
if (e8.status === 400) ok('FREQ=SECONDLY → 400');
else ko(`期望 400，实际 ${e8.status}`, JSON.stringify(e8.json).slice(0,150));

// ============================================================
// §5.6 repeat_custom 校验 — CRLF 注入 → 400
// ============================================================
console.log('\n[§5.6 repeat_custom 校验: CRLF 注入]');
const e9 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'crlf', repeat_type: 'daily',
  repeat_custom: 'FREQ=DAILY\nX-INJECT:evil'
});
if (e9.status === 400) ok('CRLF 注入 → 400');
else ko(`期望 400，实际 ${e9.status}`, JSON.stringify(e9.json).slice(0,150));

// ============================================================
// §2.3 V1 PUT PATCH 语义
// 文档 §5.6 示例5 说：未传 repeat_custom 保留 DB 原值
// ============================================================
console.log('\n[§5.6 V1 PUT PATCH 语义]');
if (postId) {
  // 先 GET 记录原 repeat_custom
  const before = await api('GET', `/api/v1/todos/${postId}`);
  const rcBefore = before.json?.data?.repeat_custom;
  // PUT 只改 text，不传 repeat_custom
  const putRes = await api('PUT', `/api/v1/todos/${postId}`, {
    scope: 'all', text: 'audit-post-renamed'
  });
  if (putRes.status === 200) {
    const rcAfter = putRes.json?.data?.repeat_custom;
    if (rcAfter === rcBefore) ok(`PATCH: repeat_custom 保留 (${rcBefore})`);
    else ko('PATCH: repeat_custom 未保留', `before=${rcBefore}, after=${rcAfter}`);
    if (putRes.json.data.text === 'audit-post-renamed') ok('text 已更新');
    else ko('text 未更新', putRes.json.data.text);
  } else ko('PUT 失败', `${putRes.status}: ${JSON.stringify(putRes.json).slice(0,150)}`);
}

// ============================================================
// §3.2 V0 Todo API — CREATE 响应
// 文档 §5.6 V0 示例1 说：V0 CREATE 响应为 {"success":true}（无 data 字段）
// ============================================================
console.log('\n[§3.2/§5.6 V0 CREATE 响应]');
await v0Login();
if (cookie) {
  ok('V0 登录成功');
  const v0Id = `e2e-audit-${Date.now()}`;
  const v0Create = await v0Api({
    action: 'CREATE', date: '2026-06-29',
    task: { id: v0Id, text: 'v0-audit', repeat_type: 'weekly', repeat_interval: 1 }
  });
  if (v0Create.status === 200 && v0Create.json.success) {
    createdIds.push(v0Id);
    if (v0Create.json.data === undefined) ok('V0 CREATE 响应无 data 字段（与文档一致）');
    else ko('V0 CREATE 响应含 data（与文档不符）', JSON.stringify(v0Create.json.data).slice(0,150));
  } else ko('V0 CREATE 失败', `${v0Create.status}: ${JSON.stringify(v0Create.json).slice(0,150)}`);
} else ko('V0 登录失败');

// ============================================================
// §3.2 V0 UPDATE PATCH 语义
// 文档 §5.6 说：V0 UPDATE 现为 PATCH 语义，所有字段未传时从 DB 回退
// ============================================================
console.log('\n[§5.6 V0 UPDATE PATCH 语义]');
if (cookie) {
  // 创建带丰富字段的 V0 todo
  const v0RichId = `e2e-rich-${Date.now()}`;
  await v0Api({
    action: 'CREATE', date: '2026-06-29',
    task: {
      id: v0RichId, text: 'V0原始', desc: '原始描述', priority: 'high',
      repeat_type: 'weekly', repeat_interval: 2, repeat_end: '2026-12-31',
      subtasks: [{ text: '子任务', done: false }]
    }
  });
  createdIds.push(v0RichId);

  // V0 UPDATE 只传 text
  const v0Update = await v0Api({
    action: 'UPDATE', date: '2026-06-29', scope: 'all',
    task: { id: v0RichId, text: 'V0改名' }
  });
  if (v0Update.status === 200) {
    // 用 V1 GET 读回验证
    const after = await api('GET', `/api/v1/todos/${v0RichId}`);
    const d = after.json?.data;
    if (d) {
      if (d.text === 'V0改名') ok('V0 text 已更新');
      else ko('V0 text 未更新', d.text);
      if (d.desc === '原始描述') ok('V0 desc PATCH 保留');
      else ko('V0 desc 未保留', d.desc);
      if (d.priority === 'high') ok('V0 priority PATCH 保留');
      else ko('V0 priority 未保留', d.priority);
      if (d.repeat_interval === 2) ok('V0 repeat_interval PATCH 保留');
      else ko('V0 repeat_interval 未保留', d.repeat_interval);
      if (d.repeat_end === '2026-12-31') ok('V0 repeat_end PATCH 保留');
      else ko('V0 repeat_end 未保留', d.repeat_end);
      if (d.subtasks.length === 1 && d.subtasks[0].text === '子任务') ok('V0 subtasks PATCH 保留');
      else ko('V0 subtasks 未保留', JSON.stringify(d.subtasks));
      if (d.repeat_type === 'weekly') ok('V0 repeat_type PATCH 保留');
      else ko('V0 repeat_type 未保留', d.repeat_type);
    } else ko('V1 GET 读回失败', JSON.stringify(after.json).slice(0,150));
  } else ko('V0 UPDATE 失败', `${v0Update.status}: ${JSON.stringify(v0Update.json).slice(0,150)}`);
}

// ============================================================
// §2.5 回收站 API
// 文档说：trash 返回纯数据库行，done/deleted 为整数 0/1
// ============================================================
console.log('\n[§2.5/§4.2 回收站 trash 响应格式]');
const trashRes = await api('GET', '/api/v1/trash?limit=5');
if (trashRes.status === 200) {
  ok('GET /api/v1/trash 200');
  const items = trashRes.json.data || [];
  if (items.length > 0) {
    const item = items[0];
    // V1 trash 应该也是 formatTodo 格式（done/deleted 为布尔）
    // 文档 §4.2 说 V0 trash 是整数，V1 应该是布尔
    if (typeof item.done === 'boolean') ok('V1 trash.done 为布尔');
    else ko('V1 trash.done 类型不符', `${typeof item.done}: ${item.done}`);
    if (typeof item.deleted === 'boolean') ok('V1 trash.deleted 为布尔');
    else ko('V1 trash.deleted 类型不符', `${typeof item.deleted}: ${item.deleted}`);
  } else {
    ok('回收站为空，跳过字段检查');
  }
} else ko('trash GET 失败', `${trashRes.status}`);

// ============================================================
// §2.11 HTTP 状态码
// 文档说：201 创建成功（POST /todos, POST /categories）
// ============================================================
console.log('\n[§2.11 HTTP 状态码]');
// V1 POST todo 应返回 201
if (postRes.status === 201) ok('POST /api/v1/todos 返回 201');
else ko('POST 状态码不符', `期望 201，实际 ${postRes.status}`);

// GET 不存在的 todo 应返回 404
const notFound = await api('GET', '/api/v1/todos/nonexistent-id-12345');
if (notFound.status === 404) ok('GET 不存在的 todo 返回 404');
else ko('GET 404 不符', `期望 404，实际 ${notFound.status}`);

// ============================================================
// §4.1 is_series 派生字段
// 文档说：is_series 由 repeat_type 推导
// ============================================================
console.log('\n[§4.1 is_series 派生字段]');
// none → false
const noneRes = await api('POST', '/api/v1/todos', { date: '2026-06-29', text: 'none-test' });
const noneId = noneRes.json?.data?.id;
createdIds.push(noneId);
if (noneRes.json?.data?.is_series === false) ok('repeat_type=none → is_series=false');
else ko('none is_series 不符', noneRes.json?.data?.is_series);

// fragment → false
if (fragId) {
  const fragGet = await api('GET', `/api/v1/todos/${fragId}`);
  if (fragGet.json?.data?.is_series === false) ok('repeat_type=fragment → is_series=false');
  else ko('fragment is_series 不符', fragGet.json?.data?.is_series);
}

// daily → true
const dailyRes = await api('POST', '/api/v1/todos', { date: '2026-06-29', text: 'daily-test', repeat_type: 'daily' });
const dailyId = dailyRes.json?.data?.id;
createdIds.push(dailyId);
if (dailyRes.json?.data?.is_series === true) ok('repeat_type=daily → is_series=true');
else ko('daily is_series 不符', dailyRes.json?.data?.is_series);

// ============================================================
// §5.6 expand=false 范围查询
// 文档说：范围查询 expand=false 也返回 templates 字段但为空数组
// ============================================================
console.log('\n[§5.6 expand=false 范围查询 templates]');
const rangeRes = await api('GET', '/api/v1/todos?start_date=2026-07-01&end_date=2026-07-07&expand=false');
if (rangeRes.status === 200) {
  if (Array.isArray(rangeRes.json.templates)) {
    if (rangeRes.json.templates.length === 0) ok('范围查询 templates 为空数组');
    else ko('范围查询 templates 非空', `count=${rangeRes.json.templates.length}`);
  } else {
    ko('范围查询无 templates 字段', typeof rangeRes.json.templates);
  }
} else ko('范围查询失败', rangeRes.status);

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
