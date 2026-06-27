#!/usr/bin/env node
/**
 * cf-todo V0 / V1 API robustness validation test harness (v3).
 *
 * Fixes vs v2:
 *   - V0 todo-action: `date` is a top-level body field, NOT inside `task`
 *     (per API_Wiki §3.2). The V0 non-fragment CREATE/UPDATE path uses
 *     body.date for the SQL bind. Missing top-level `date` previously
 *     triggered a 500 D1_TYPE_ERROR (a real robustness bug noted in report).
 *   - V1 PATCH /api/v1/todos/:id/toggle on a fragment: must pass `body.date`
 *     to freeze the fragment's date on completion. Without body.date the
 *     freeze falls back to existing.date which for a floating fragment is ''.
 *   - V1 recurring: after thisAndFuture update, the original series is split
 *     and subsequent scope=all operations should target the original series
 *     only. Reorganized the recurring test to verify scope=all on date+4
 *     (still part of original series under interval=2) and delete
 *     thisAndFuture on date+4.
 */

const BASE = 'https://test.945426.xyz';
const API_KEY = 'cfk_QHP_7YOH0hxmzwPk1cK5OmYkWPD3TnoOWXoKMKBxHcc';

let caseCounter = 0;
const results = [];

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function http(method, path, { headers = {}, body, qs } = {}) {
  const url = new URL(BASE + path);
  if (qs) for (const [k, v] of Object.entries(qs)) if (v !== undefined) url.searchParams.set(k, v);
  const finalHeaders = { 'X-API-Key': API_KEY, ...headers };
  const init = { method, headers: finalHeaders };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const t0 = Date.now();
  let resp;
  try { resp = await fetch(url, init); }
  catch (e) { return { ok: false, status: 0, body: null, error: String(e), ms: Date.now() - t0 }; }
  const ms = Date.now() - t0;
  const text = await resp.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (_) { parsed = text; }
  return { ok: resp.ok, status: resp.status, body: parsed, raw: text, ms };
}

function record(group, name, pass, actual, extra = {}) {
  caseCounter += 1;
  results.push({
    id: caseCounter, group, name, pass: !!pass,
    status: actual?.status, ms: actual?.ms,
    bodyPreview: typeof actual?.body === 'string'
      ? actual.body.slice(0, 300)
      : JSON.stringify(actual?.body)?.slice(0, 400),
    ...extra,
  });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] #${caseCounter} ${group} :: ${name} (HTTP ${actual?.status} ${actual?.ms}ms)`);
  if (!pass && actual?.body) console.log('   body:', JSON.stringify(actual.body).slice(0, 400));
  return pass;
}

// ============================================================================
// V1 single todo (repeat_type=none)
// ============================================================================
async function v1_single_todo() {
  const date = todayISO(0);
  let r = await http('POST', '/api/v1/todos', { body: {
    date, text: 'V1 single [none]', priority: 'med', desc: 'initial',
    time: '10:00', subtasks: ['s1', { text: 's2', done: true }],
    search_terms: [{ text: 'tag-a', done: false }],
  }});
  record('V1 single', 'create', r.status === 201 && r.body?.data?.id, r);
  const id = r.body?.data?.id;
  if (!id) return;

  r = await http('GET', `/api/v1/todos/${id}`);
  record('V1 single', 'get by id', r.status === 200 && r.body?.data?.id === id, r);

  r = await http('PUT', `/api/v1/todos/${id}`, { body: {
    text: 'V1 single [none] edited', priority: 'high', desc: 'edited desc',
    time: '11:30',
    subtasks: [{ text: 's1', done: true }, { text: 's3', done: false }],
    search_terms: [{ text: 'tag-b', done: false }],
  }});
  record('V1 single', 'edit attributes',
    r.status === 200 && r.body?.data?.text === 'V1 single [none] edited', r);

  const now = Date.now();
  r = await http('PATCH', `/api/v1/todos/${id}/toggle`, { body: { record: { s: now, e: now, p: 0 } } });
  record('V1 single', 'toggle done zero-duration', r.status === 200 && r.body?.data?.done === true, r);
  r = await http('GET', `/api/v1/todos/${id}`);
  const tr = r.body?.data?.time_records;
  record('V1 single', 'time_records has 1 zero-duration entry',
    r.status === 200 && Array.isArray(tr) && tr.length === 1 && tr[0].s === tr[0].e, r);

  r = await http('PATCH', `/api/v1/todos/${id}/toggle`);
  record('V1 single', 'toggle undone', r.status === 200 && r.body?.data?.done === false, r);
  r = await http('GET', `/api/v1/todos/${id}`);
  record('V1 single', 'after undone — time_records empty',
    r.status === 200 && Array.isArray(r.body?.data?.time_records) && r.body.data.time_records.length === 0, r);

  const s = Date.now();
  const e = s + 5 * 60 * 1000;
  r = await http('PATCH', `/api/v1/todos/${id}/toggle`, { body: { record: { s, e, p: 60 * 1000 } } });
  record('V1 single', 'timer complete real duration', r.status === 200 && r.body?.data?.done === true, r);
  r = await http('GET', `/api/v1/todos/${id}`);
  const tr2 = r.body?.data?.time_records || [];
  record('V1 single', 'timer session written',
    r.status === 200 && tr2.length > 0 && tr2[tr2.length-1].e > tr2[tr2.length-1].s, r);
  record('V1 single', 'last_duration_ms computed',
    r.body?.data?.last_duration_ms === 4 * 60 * 1000, r);
  record('V1 single', 'is_zero_duration false', r.body?.data?.is_zero_duration === false, r);

  r = await http('DELETE', `/api/v1/todos/${id}`);
  record('V1 single', 'soft delete', r.status === 200 && r.body?.success === true, r);
  r = await http('GET', `/api/v1/todos/${id}`);
  record('V1 single', 'after delete — instance returns with deleted:true (not 404)',
    r.status === 200 && r.body?.data?.deleted === true, r);
  r = await http('GET', '/api/v1/trash');
  const trashed = r.body?.data?.find(t => t.id === id);
  record('V1 single', 'appears in trash', r.status === 200 && trashed, r, { trashId: trashed?.id });
  r = await http('POST', '/api/v1/trash-action', { body: { action: 'RESTORE', id } });
  record('V1 single', 'restore from trash', r.status === 200 && r.body?.success === true, r);
  r = await http('GET', `/api/v1/todos/${id}`);
  record('V1 single', 'restored — deleted flag cleared',
    r.status === 200 && r.body?.data?.id === id && r.body?.data?.deleted === false, r);

  await http('DELETE', `/api/v1/todos/${id}`);
  r = await http('POST', '/api/v1/trash-action', { body: { action: 'DELETE_PERMANENT', id } });
  record('V1 single', 'permanent delete', r.status === 200 && r.body?.success === true, r);
  r = await http('GET', `/api/v1/todos/${id}`);
  record('V1 single', 'permanent deleted — 404', r.status === 404, r);
}

// ============================================================================
// V1 recurring (daily, interval 1 → 2 → thisAndFuture delete)
// ============================================================================
async function v1_recurring_daily() {
  const today = todayISO(0);
  let r = await http('POST', '/api/v1/todos', { body: {
    date: today, text: 'V1 daily', repeat_type: 'daily', repeat_interval: 1,
    time: '09:00', priority: 'med',
    search_terms: [{ text: 'tech', done: false }],
  }});
  record('V1 recurring', 'create daily interval=1', r.status === 201 && r.body?.data?.id, r);
  const id = r.body?.data?.id;
  const parentId = r.body?.data?.parent_id;
  if (!id) return;

  for (const off of [0, 1, 2, 3, 4]) {
    const d = todayISO(off);
    r = await http('GET', '/api/v1/todos', { qs: { date: d } });
    const hit = r.body?.data?.find(t => t.parent_id === parentId && t.date === d);
    record('V1 recurring', `expand date+${off}`, r.status === 200 && hit, r, { date: d, instId: hit?.id });
  }

  // Change interval 1 → 2 (scope=all)
  r = await http('PUT', `/api/v1/todos/${id}`, { body: { repeat_interval: 2, scope: 'all' } });
  record('V1 recurring', 'change interval 1→2 (all)', r.status === 200, r);
  // interval=2 from anchor 0 → 0, 2, 4, 6, 8, ...
  const dPlus5 = todayISO(5);
  r = await http('GET', '/api/v1/todos', { qs: { date: dPlus5 } });
  const hitPlus5 = r.body?.data?.find(t => t.parent_id === parentId && t.date === dPlus5);
  record('V1 recurring', 'interval=2 — date+5 NOT generated', r.status === 200 && !hitPlus5, r, { date: dPlus5 });
  const dPlus6 = todayISO(6);
  r = await http('GET', '/api/v1/todos', { qs: { date: dPlus6 } });
  const hitPlus6 = r.body?.data?.find(t => t.parent_id === parentId && t.date === dPlus6);
  record('V1 recurring', 'interval=2 — date+6 IS generated', r.status === 200 && hitPlus6, r, { date: dPlus6, instId: hitPlus6?.id });

  // scope=this on date+2 (text only)
  const instPlus2 = (await http('GET', '/api/v1/todos', { qs: { date: todayISO(2) } }))
    .body?.data?.find(t => t.parent_id === parentId && t.date === todayISO(2));
  if (instPlus2) {
    r = await http('PUT', `/api/v1/todos/${instPlus2.id}`, { body: { text: 'V1 daily [d+2 edited]', scope: 'this' } });
    record('V1 recurring', 'update scope=this', r.status === 200, r);
    const instPlus4 = (await http('GET', '/api/v1/todos', { qs: { date: todayISO(4) } }))
      .body?.data?.find(t => t.parent_id === parentId && t.date === todayISO(4));
    record('V1 recurring', 'scope=this — date+4 unchanged text',
      r.status === 200 && instPlus4?.text === 'V1 daily', r);
  }

  // scope=all update search_terms
  r = await http('PUT', `/api/v1/todos/${id}`, { body: { search_terms: [{ text: 'news', done: false }], scope: 'all' } });
  record('V1 recurring', 'update search_terms scope=all', r.status === 200, r);

  // scope=all update time
  r = await http('PUT', `/api/v1/todos/${id}`, { body: { time: '14:30', scope: 'all' } });
  record('V1 recurring', 'update time scope=all', r.status === 200, r);
  // Verify on date+4 (still in original series under interval=2)
  const instPlus4Check = (await http('GET', '/api/v1/todos', { qs: { date: todayISO(4) } }))
    .body?.data?.find(t => t.parent_id === parentId && t.date === todayISO(4));
  record('V1 recurring', 'time applied to future expansion',
    r.status === 200 && instPlus4Check?.time === '14:30', r, { time: instPlus4Check?.time });

  // Toggle done zero-duration on instance
  if (instPlus4Check) {
    const now = Date.now();
    r = await http('PATCH', `/api/v1/todos/${instPlus4Check.id}/toggle`, { body: { record: { s: now, e: now, p: 0 } } });
    record('V1 recurring', 'toggle done instance', r.status === 200 && r.body?.data?.done === true, r);
  }

  // Delete scope=thisAndFuture on date+4 — future expansions stop
  if (instPlus4Check) {
    r = await http('DELETE', `/api/v1/todos/${instPlus4Check.id}?scope=thisAndFuture`);
    record('V1 recurring', 'delete scope=thisAndFuture', r.status === 200 && r.body?.success === true, r);
    const dPlus6After = todayISO(6);
    r = await http('GET', '/api/v1/todos', { qs: { date: dPlus6After } });
    const hitPlus6After = r.body?.data?.find(t => t.parent_id === parentId && t.date === dPlus6After);
    record('V1 recurring', 'thisAndFuture delete — date+6 NOT expanded',
      r.status === 200 && !hitPlus6After, r, { date: dPlus6After });
  }

  // Cleanup
  r = await http('DELETE', `/api/v1/todos/${id}?scope=all`);
  record('V1 recurring', 'cleanup scope=all', r.status === 200 && r.body?.success === true, r);
  await http('POST', '/api/v1/trash-action', { body: { action: 'CLEAR_ALL' } });
}

// ============================================================================
// V1 fragment todo (碎时记)
// ============================================================================
async function v1_fragment_todo() {
  // 1. Floating fragment (date='')
  let r = await http('POST', '/api/v1/todos', { body: {
    date: '', text: 'V1 fragment (floating)', repeat_type: 'fragment',
    priority: 'low', desc: 'no specific date',
  }});
  record('V1 fragment', 'create with empty date', r.status === 201 && r.body?.data?.id, r);
  const floatId = r.body?.data?.id;
  if (floatId) {
    for (const off of [0, 1, 5]) {
      const d = todayISO(off);
      r = await http('GET', '/api/v1/todos', { qs: { date: d } });
      const hit = r.body?.data?.find(t => t.id === floatId);
      record('V1 fragment', `floating visible on date+${off}`, r.status === 200 && hit, r, { date: d });
    }
    const today = todayISO(0);
    const now = Date.now();
    // V1 toggle: pass body.date to freeze
    r = await http('PATCH', `/api/v1/todos/${floatId}/toggle`, { body: { record: { s: now, e: now, p: 0 }, date: today } });
    record('V1 fragment', 'toggle done (with body.date) freezes date', r.status === 200 && r.body?.data?.done === true, r);
    r = await http('GET', `/api/v1/todos/${floatId}`);
    record('V1 fragment', 'after done — date frozen to today',
      r.body?.data?.date === today, r, { date: r.body?.data?.date });
    const tomorrow = todayISO(1);
    r = await http('GET', '/api/v1/todos', { qs: { date: tomorrow } });
    const hitT = r.body?.data?.find(t => t.id === floatId);
    record('V1 fragment', 'completed fragment not visible on tomorrow', r.status === 200 && !hitT, r);

    r = await http('PATCH', `/api/v1/todos/${floatId}/toggle`);
    record('V1 fragment', 'toggle undone', r.status === 200, r);
    r = await http('GET', `/api/v1/todos/${floatId}`);
    record('V1 fragment', 'after undone — date restored to fragment_anchor (empty)',
      r.body?.data?.date === '' || r.body?.data?.date === null, r, { date: r.body?.data?.date });
  }

  // 2. Anchored fragment (date=+2)
  const anchor = todayISO(2);
  r = await http('POST', '/api/v1/todos', { body: {
    date: anchor, text: 'V1 fragment anchored +2', repeat_type: 'fragment',
    priority: 'med',
  }});
  record('V1 fragment', 'create with anchor date+2', r.status === 201 && r.body?.data?.id, r);
  const aId = r.body?.data?.id;
  if (aId) {
    for (const off of [0, 1]) {
      const d = todayISO(off);
      r = await http('GET', '/api/v1/todos', { qs: { date: d } });
      record('V1 fragment', `anchored+2 NOT visible date+${off}`,
        r.status === 200 && !r.body?.data?.find(t => t.id === aId), r, { date: d });
    }
    for (const off of [2, 5, 10]) {
      const d = todayISO(off);
      r = await http('GET', '/api/v1/todos', { qs: { date: d } });
      record('V1 fragment', `anchored+2 visible date+${off}`,
        r.status === 200 && r.body?.data?.find(t => t.id === aId), r, { date: d });
    }

    // TIMER_RECORD multiple times — verify no truncation
    for (let i = 0; i < 7; i++) {
      const s = Date.now();
      const e = s + (i + 1) * 60 * 1000;
      r = await http('POST', '/api/todo-action', { body: {
        action: 'TIMER_RECORD', task: { id: aId }, record: { s, e, p: 0 },
      }});
      if (i === 0) record('V1 fragment', 'TIMER_RECORD #1 ok', r.status === 200, r);
    }
    r = await http('GET', `/api/v1/todos/${aId}`);
    const trLen = r.body?.data?.time_records?.length ?? 0;
    record('V1 fragment', 'TIMER_RECORD ×7 — no FIFO truncation (len ≥ 7)',
      r.status === 200 && trLen >= 7, r, { recordsLen: trLen });
    record('V1 fragment', 'after TIMER_RECORD — done still false',
      r.body?.data?.done === false, r);

    // TIMER_COMPLETE freezes date + done=true
    const s2 = Date.now();
    const e2 = s2 + 5 * 60 * 1000;
    r = await http('POST', '/api/todo-action', { body: {
      action: 'TIMER_COMPLETE',
      task: { id: aId, parent_id: aId },
      record: { s: s2, e: e2, p: 0 },
      date: todayISO(0),
    }});
    record('V1 fragment', 'TIMER_COMPLETE marks done + records session', r.status === 200, r);
    r = await http('GET', `/api/v1/todos/${aId}`);
    record('V1 fragment', 'TIMER_COMPLETE — done=true, date frozen to today',
      r.body?.data?.done === true && r.body?.data?.date === todayISO(0), r);

    // Soft delete + restore
    r = await http('DELETE', `/api/v1/todos/${aId}`);
    record('V1 fragment', 'soft delete', r.status === 200, r);
    r = await http('POST', '/api/v1/trash-action', { body: { action: 'RESTORE', id: aId } });
    record('V1 fragment', 'restore (no template path)', r.status === 200 && r.body?.success === true, r);
    r = await http('GET', `/api/v1/todos/${aId}`);
    record('V1 fragment', 'restored visible', r.status === 200 && r.body?.data?.id === aId, r);

    // Edit attributes
    r = await http('PUT', `/api/v1/todos/${aId}`, { body: {
      text: 'V1 fragment anchored +2 [edited]',
      time: '20:00',
      search_terms: [{ text: 'focus', done: false }],
    }});
    record('V1 fragment', 'edit attributes',
      r.status === 200 && r.body?.data?.text === 'V1 fragment anchored +2 [edited]', r);
  }

  // Cleanup
  if (floatId) await http('DELETE', `/api/v1/todos/${floatId}`);
  if (aId) {
    await http('DELETE', `/api/v1/todos/${aId}`);
    await http('POST', '/api/v1/trash-action', { body: { action: 'DELETE_PERMANENT', id: aId } });
  }
  if (floatId) await http('POST', '/api/v1/trash-action', { body: { action: 'DELETE_PERMANENT', id: floatId } });
}

// ============================================================================
// V0 single todo (repeat_type=none)
// ============================================================================
async function v0_single_todo() {
  const date = todayISO(0);
  const id = uuid();
  // V0 contract: `date` is TOP-LEVEL body field (per API_Wiki §3.2)
  let r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE',
    date,
    task: { id, date, text: 'V0 single [none]', priority: 'med', desc: 'init',
      time: '08:00', subtasks: [{ text: 'a', done: false }],
      search_terms: [{ text: 'foo', done: false }],
      repeat_type: 'none',
    },
  }});
  record('V0 single', 'create', r.status === 200 && r.body?.success === true, r);
  if (!r.body?.success) return;

  r = await http('GET', '/api/todos', { qs: { date } });
  const hit = r.body?.find(t => t.id === id);
  record('V0 single', 'appears in /api/todos', r.status === 200 && hit, r);

  // Edit attributes
  r = await http('POST', '/api/todo-action', { body: {
    action: 'UPDATE',
    date,
    task: { id, date, text: 'V0 single [none] edited', priority: 'high',
      desc: 'edited', time: '15:30', copyText: 'copy-me',
      subtasks: [{ text: 'a', done: true }, { text: 'b', done: false }],
      search_terms: [{ text: 'bar', done: false }],
      repeat_type: 'none',
    },
  }});
  record('V0 single', 'update attributes', r.status === 200, r);
  r = await http('GET', '/api/todos', { qs: { date } });
  const edited = r.body?.find(t => t.id === id);
  record('V0 single', 'edit reflected',
    r.status === 200 && edited?.text === 'V0 single [none] edited' && edited?.priority === 'high', r);

  // TOGGLE_DONE zero-duration (V0 contract: task.done is the TARGET state)
  const now = Date.now();
  r = await http('POST', '/api/todo-action', { body: {
    action: 'TOGGLE_DONE', date, task: { id, done: true }, record: { s: now, e: now, p: 0 },
  }});
  record('V0 single', 'toggle done zero-duration', r.status === 200, r);
  r = await http('GET', '/api/todos', { qs: { date } });
  const afterToggle = r.body?.find(t => t.id === id);
  let tr = typeof afterToggle?.time_records === 'string' ? JSON.parse(afterToggle.time_records) : (afterToggle?.time_records || []);
  record('V0 single', 'after toggle — done=true, 1 zero-duration record',
    r.status === 200 && afterToggle?.done === true && Array.isArray(tr) && tr.length === 1 && tr[0].s === tr[0].e,
    r, { trLen: tr.length });

  // TOGGLE_DONE undone
  r = await http('POST', '/api/todo-action', { body: { action: 'TOGGLE_DONE', date, task: { id, done: false } } });
  record('V0 single', 'toggle undone', r.status === 200, r);
  r = await http('GET', '/api/todos', { qs: { date } });
  const afterUndone = r.body?.find(t => t.id === id);
  tr = typeof afterUndone?.time_records === 'string' ? JSON.parse(afterUndone.time_records) : (afterUndone?.time_records || []);
  record('V0 single', 'after undone — time_records cleared',
    r.status === 200 && Array.isArray(tr) && tr.length === 0, r, { trLen: tr.length });

  // TIMER_COMPLETE real duration
  const s = Date.now();
  const e = s + 3 * 60 * 1000;
  r = await http('POST', '/api/todo-action', { body: {
    action: 'TIMER_COMPLETE',
    date,
    task: { id, parent_id: id, done: false },
    record: { s, e, p: 30 * 1000 },
  }});
  record('V0 single', 'TIMER_COMPLETE real duration', r.status === 200, r);
  r = await http('GET', '/api/todos', { qs: { date } });
  const afterTimer = r.body?.find(t => t.id === id);
  tr = typeof afterTimer?.time_records === 'string' ? JSON.parse(afterTimer.time_records) : (afterTimer?.time_records || []);
  record('V0 single', 'timer session written',
    r.status === 200 && Array.isArray(tr) && tr.length > 0 && tr[tr.length-1].e > tr[tr.length-1].s, r, { trLen: tr.length });

  // Soft delete + restore
  r = await http('POST', '/api/todo-action', { body: { action: 'DELETE', date, task: { id } } });
  record('V0 single', 'soft delete', r.status === 200, r);
  r = await http('GET', '/api/todos', { qs: { date } });
  record('V0 single', 'gone from active list', r.status === 200 && !r.body?.find(t => t.id === id), r);
  r = await http('GET', '/api/trash');
  record('V0 single', 'appears in /api/trash', r.status === 200 && r.body?.find(t => t.id === id), r);
  r = await http('POST', '/api/trash-action', { body: { action: 'RESTORE', id } });
  record('V0 single', 'restore from trash', r.status === 200, r);
  r = await http('GET', '/api/todos', { qs: { date } });
  record('V0 single', 'visible after restore', r.status === 200 && r.body?.find(t => t.id === id), r);

  // Permanent delete
  await http('POST', '/api/todo-action', { body: { action: 'DELETE', date, task: { id } } });
  r = await http('POST', '/api/trash-action', { body: { action: 'DELETE_PERMANENT', id } });
  record('V0 single', 'permanent delete', r.status === 200, r);
  r = await http('GET', '/api/todos', { qs: { date } });
  record('V0 single', 'gone permanently', r.status === 200 && !r.body?.find(t => t.id === id), r);
}

// ============================================================================
// V0 recurring (daily, interval 1 → 2)
// ============================================================================
async function v0_recurring_daily() {
  const today = todayISO(0);
  const id = uuid();
  let r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE',
    date: today,
    task: {
      id, date: today, text: 'V0 daily', repeat_type: 'daily', repeat_interval: 1,
      time: '07:00', priority: 'high',
      search_terms: [{ text: 'AI', done: false }],
    },
  }});
  record('V0 recurring', 'create daily interval=1', r.status === 200 && r.body?.success === true, r);
  if (!r.body?.success) return;
  let parentId = id;

  for (const off of [0, 1, 2, 3, 4]) {
    const d = todayISO(off);
    r = await http('GET', '/api/todos', { qs: { date: d } });
    const hit = r.body?.find(t => t.parent_id === parentId && t.date === d);
    record('V0 recurring', `expand date+${off}`, r.status === 200 && hit, r, { date: d, instId: hit?.id });
  }

  // Change interval 1 → 2 (scope=all) — V0 UPDATE requires `text` AND `parent_id` in task object
  r = await http('POST', '/api/todo-action', { body: {
    action: 'UPDATE',
    date: today,
    task: { id, parent_id: id, text: 'V0 daily', repeat_interval: 2, repeat_type: 'daily' },
    scope: 'all',
  }});
  record('V0 recurring', 'change interval 1→2 (all)', r.status === 200, r);
  const dPlus5 = todayISO(5);
  r = await http('GET', '/api/todos', { qs: { date: dPlus5 } });
  record('V0 recurring', 'interval=2 date+5 NOT generated',
    r.status === 200 && !r.body?.find(t => t.parent_id === parentId && t.date === dPlus5), r, { date: dPlus5 });
  const dPlus6 = todayISO(6);
  r = await http('GET', '/api/todos', { qs: { date: dPlus6 } });
  record('V0 recurring', 'interval=2 date+6 IS generated',
    r.status === 200 && r.body?.find(t => t.parent_id === parentId && t.date === dPlus6), r, { date: dPlus6 });

  // Update search_terms scope=all
  r = await http('POST', '/api/todo-action', { body: {
    action: 'UPDATE',
    date: today,
    task: { id, parent_id: id, text: 'V0 daily', search_terms: [{ text: 'LLM', done: false }], repeat_type: 'daily' },
    scope: 'all',
  }});
  record('V0 recurring', 'update search_terms scope=all', r.status === 200, r);

  // Update time scope=all
  r = await http('POST', '/api/todo-action', { body: {
    action: 'UPDATE',
    date: today,
    task: { id, parent_id: id, text: 'V0 daily', time: '18:45', repeat_type: 'daily' },
    scope: 'all',
  }});
  record('V0 recurring', 'update time scope=all', r.status === 200, r);
  const instPlus6 = (await http('GET', '/api/todos', { qs: { date: todayISO(6) } }))
    .body?.find(t => t.parent_id === parentId && t.date === todayISO(6));
  record('V0 recurring', 'future instance time updated',
    r.status === 200 && instPlus6?.time === '18:45', r, { time: instPlus6?.time });

  // scope=this edit on today
  const instToday = (await http('GET', '/api/todos', { qs: { date: today } }))
    .body?.find(t => t.parent_id === parentId && t.date === today);
  if (instToday) {
    r = await http('POST', '/api/todo-action', { body: {
      action: 'UPDATE',
      date: today,
      task: { id: instToday.id, text: 'V0 daily [today edited]', repeat_type: 'daily', parent_id: parentId },
      scope: 'this',
    }});
    record('V0 recurring', 'update scope=this', r.status === 200, r);
    const instPlus4v2 = (await http('GET', '/api/todos', { qs: { date: todayISO(4) } }))
      .body?.find(t => t.parent_id === parentId && t.date === todayISO(4));
    record('V0 recurring', 'scope=this — date+4 unchanged',
      r.status === 200 && instPlus4v2?.text === 'V0 daily', r);
  }

  // Delete scope=thisAndFuture on date+6
  const instPlus6Final = (await http('GET', '/api/todos', { qs: { date: todayISO(6) } }))
    .body?.find(t => t.parent_id === parentId && t.date === todayISO(6));
  if (instPlus6Final) {
    r = await http('POST', '/api/todo-action', { body: {
      action: 'DELETE',
      date: todayISO(6),
      task: { id: instPlus6Final.id, repeat_type: 'daily', parent_id: parentId },
      scope: 'thisAndFuture',
    }});
    record('V0 recurring', 'delete scope=thisAndFuture', r.status === 200, r);
    const dPlus8 = todayISO(8);
    r = await http('GET', '/api/todos', { qs: { date: dPlus8 } });
    record('V0 recurring', 'thisAndFuture delete — date+8 NOT expanded',
      r.status === 200 && !r.body?.find(t => t.parent_id === parentId && t.date === dPlus8), r, { date: dPlus8 });
  }

  // Cleanup
  await http('POST', '/api/todo-action', { body: { action: 'DELETE', date: today, task: { id, repeat_type: 'daily' }, scope: 'all' } });
  await http('POST', '/api/trash-action', { body: { action: 'CLEAR_ALL' } });
  record('V0 recurring', 'cleanup', true, { status: 200, body: null, ms: 0 });
}

// ============================================================================
// V0 fragment todo
// ============================================================================
async function v0_fragment_todo() {
  // 1. Floating
  const floatId = uuid();
  let r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE',
    date: '',
    task: { id: floatId, date: '', text: 'V0 fragment (floating)', repeat_type: 'fragment', priority: 'med' },
  }});
  record('V0 fragment', 'create floating', r.status === 200 && r.body?.success === true, r);

  if (r.body?.success) {
    for (const off of [0, 1, 5, 10]) {
      const d = todayISO(off);
      r = await http('GET', '/api/todos', { qs: { date: d } });
      const hit = r.body?.find(t => t.id === floatId);
      record('V0 fragment', `floating visible date+${off}`, r.status === 200 && hit, r, { date: d });
    }

    const today = todayISO(0);
    const now = Date.now();
    r = await http('POST', '/api/todo-action', { body: {
      action: 'TOGGLE_DONE', date: today, task: { id: floatId, done: true }, record: { s: now, e: now, p: 0 },
    }});
    record('V0 fragment', 'toggle done zero-duration', r.status === 200, r);
    r = await http('GET', '/api/todos', { qs: { date: today } });
    const after = r.body?.find(t => t.id === floatId);
    record('V0 fragment', 'done — date frozen to today',
      r.status === 200 && after?.done === true && after?.date === today, r, { date: after?.date });

    r = await http('GET', '/api/todos', { qs: { date: todayISO(1) } });
    record('V0 fragment', 'done — not visible on tomorrow',
      r.status === 200 && !r.body?.find(t => t.id === floatId), r);

    // Toggle undone — date restored
    r = await http('POST', '/api/todo-action', { body: { action: 'TOGGLE_DONE', date: today, task: { id: floatId, done: false } } });
    record('V0 fragment', 'toggle undone', r.status === 200, r);
    r = await http('GET', '/api/todos', { qs: { date: todayISO(2) } });
    const restored = r.body?.find(t => t.id === floatId);
    record('V0 fragment', 'undone — visible again (date restored)',
      r.status === 200 && restored, r);
  }

  // 2. Anchored
  const anchor = todayISO(3);
  const aId = uuid();
  r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE',
    date: anchor,
    task: { id: aId, date: anchor, text: 'V0 fragment anchored +3', repeat_type: 'fragment', priority: 'high' },
  }});
  record('V0 fragment', 'create anchored +3', r.status === 200 && r.body?.success === true, r);

  if (r.body?.success) {
    for (const off of [0, 1, 2]) {
      const d = todayISO(off);
      r = await http('GET', '/api/todos', { qs: { date: d } });
      record('V0 fragment', `anchored+3 NOT visible date+${off}`,
        r.status === 200 && !r.body?.find(t => t.id === aId), r, { date: d });
    }
    for (const off of [3, 7, 14]) {
      const d = todayISO(off);
      r = await http('GET', '/api/todos', { qs: { date: d } });
      record('V0 fragment', `anchored+3 visible date+${off}`,
        r.status === 200 && r.body?.find(t => t.id === aId), r, { date: d });
    }

    // TIMER_RECORD multiple times — verify no truncation
    for (let i = 0; i < 7; i++) {
      const s = Date.now();
      const e = s + (i + 1) * 60 * 1000;
      r = await http('POST', '/api/todo-action', { body: {
        action: 'TIMER_RECORD',
        date: anchor,
        task: { id: aId },
        record: { s, e, p: 0 },
      }});
      if (i === 0) record('V0 fragment', 'TIMER_RECORD #1 ok', r.status === 200, r);
    }
    r = await http('GET', '/api/todos', { qs: { date: anchor } });
    const afterRec = r.body?.find(t => t.id === aId);
    let tr = typeof afterRec?.time_records === 'string' ? JSON.parse(afterRec.time_records) : (afterRec?.time_records || []);
    record('V0 fragment', 'TIMER_RECORD ×7 — no FIFO truncation (len ≥ 7)',
      r.status === 200 && Array.isArray(tr) && tr.length >= 7 && afterRec?.done === false, r, { trLen: tr.length });

    // TIMER_COMPLETE freezes date + done=true
    const s2 = Date.now();
    const e2 = s2 + 8 * 60 * 1000;
    r = await http('POST', '/api/todo-action', { body: {
      action: 'TIMER_COMPLETE',
      date: todayISO(0),
      task: { id: aId, parent_id: aId },
      record: { s: s2, e: e2, p: 0 },
    }});
    record('V0 fragment', 'TIMER_COMPLETE freezes date + done', r.status === 200, r);
    r = await http('GET', '/api/todos', { qs: { date: todayISO(0) } });
    const afterDone = r.body?.find(t => t.id === aId);
    record('V0 fragment', 'TIMER_COMPLETE — visible on today, done=true',
      r.status === 200 && afterDone?.done === true, r);

    // Soft delete + restore
    r = await http('POST', '/api/todo-action', { body: { action: 'DELETE', date: todayISO(0), task: { id: aId } } });
    record('V0 fragment', 'soft delete', r.status === 200, r);
    r = await http('POST', '/api/trash-action', { body: { action: 'RESTORE', id: aId } });
    record('V0 fragment', 'restore (no template path)', r.status === 200, r);
    r = await http('GET', '/api/todos', { qs: { date: todayISO(0) } });
    record('V0 fragment', 'restored visible', r.status === 200 && r.body?.find(t => t.id === aId), r);

    // Edit
    r = await http('POST', '/api/todo-action', { body: {
      action: 'UPDATE',
      date: todayISO(0),
      task: { id: aId, text: 'V0 fragment anchored +3 [edited]', time: '21:00',
        search_terms: [{ text: 'late', done: false }], repeat_type: 'fragment' },
    }});
    record('V0 fragment', 'edit attributes', r.status === 200, r);
    r = await http('GET', '/api/todos', { qs: { date: todayISO(0) } });
    const edited = r.body?.find(t => t.id === aId);
    record('V0 fragment', 'edit reflected',
      r.status === 200 && edited?.text === 'V0 fragment anchored +3 [edited]', r);
  }

  // Cleanup
  if (floatId) await http('POST', '/api/todo-action', { body: { action: 'DELETE', date: todayISO(0), task: { id: floatId } } });
  if (aId) {
    await http('POST', '/api/todo-action', { body: { action: 'DELETE', date: todayISO(0), task: { id: aId } } });
    await http('POST', '/api/trash-action', { body: { action: 'DELETE_PERMANENT', id: aId } });
  }
  if (floatId) await http('POST', '/api/trash-action', { body: { action: 'DELETE_PERMANENT', id: floatId } });
}

// ============================================================================
// Robustness probes (negative tests for the branch's robustness theme)
// ============================================================================
async function robustness_probes() {
  // 1. V0 CREATE without top-level `date` (post-fix: should succeed via task.date fallback)
  const id1 = uuid();
  let r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE',
    task: { id: id1, date: todayISO(0), text: 'no top-level date', repeat_type: 'none' },
  }});
  record('Robustness', 'V0 CREATE without top-level date — falls back to task.date (200 or 400, NOT 500)',
    r.status !== 500, r);
  if (r.body?.success) {
    await http('POST', '/api/todo-action', { body: { action: 'DELETE', date: todayISO(0), task: { id: id1 } } });
    await http('POST', '/api/trash-action', { body: { action: 'DELETE_PERMANENT', id: id1 } });
  }

  // 1b. V0 CREATE with NO date anywhere (neither top-level nor task.date) — should be 400
  const id1b = uuid();
  r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE',
    task: { id: id1b, text: 'no date at all', repeat_type: 'none' },
  }});
  record('Robustness', 'V0 CREATE with no date anywhere — 400 (not 500)',
    r.status === 400, r);

  // 2. V0 CREATE with empty task.id (should be 400)
  r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE', date: todayISO(0),
    task: { id: '', date: todayISO(0), text: 'empty id', repeat_type: 'none' },
  }});
  record('Robustness', 'V0 CREATE with empty task.id — 400',
    r.status === 400, r);

  // 3. V0 CREATE with empty task.text (should be 400)
  r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE', date: todayISO(0),
    task: { id: uuid(), date: todayISO(0), text: '', repeat_type: 'none' },
  }});
  record('Robustness', 'V0 CREATE with empty task.text — 400',
    r.status === 400, r);

  // 4. V0 CREATE with invalid repeat_type (should be 400)
  r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE', date: todayISO(0),
    task: { id: uuid(), date: todayISO(0), text: 'bad repeat', repeat_type: 'hourly' },
  }});
  record('Robustness', 'V0 CREATE invalid repeat_type — 400',
    r.status === 400, r);

  // 5. V0 UPDATE with invalid scope (should be 400)
  const validId = uuid();
  await http('POST', '/api/todo-action', { body: {
    action: 'CREATE', date: todayISO(0),
    task: { id: validId, date: todayISO(0), text: 'scope test', repeat_type: 'daily' },
  }});
  r = await http('POST', '/api/todo-action', { body: {
    action: 'UPDATE', date: todayISO(0),
    task: { id: validId, text: 'edit', repeat_type: 'daily' },
    scope: 'tomorrow',
  }});
  record('Robustness', 'V0 UPDATE invalid scope — 400',
    r.status === 400, r);

  // 5c. V0 UPDATE scope=all without `parent_id` — post-fix: should derive parent_id from DB (200 or 400, NOT 500)
  r = await http('POST', '/api/todo-action', { body: {
    action: 'UPDATE', date: todayISO(0),
    task: { id: validId, text: 'edit', repeat_interval: 3, repeat_type: 'daily' }, // no parent_id!
    scope: 'all',
  }});
  record('Robustness', 'V0 UPDATE scope=all without parent_id — derives from DB (NOT 500)',
    r.status !== 500, r);

  // 5d. V0 UPDATE scope=all with ONLY text changed (no parent_id, no repeat_interval) — V1 PATCH style
  r = await http('POST', '/api/todo-action', { body: {
    action: 'UPDATE', date: todayISO(0),
    task: { id: validId, text: 'only text changed' },
    scope: 'all',
  }});
  record('Robustness', 'V0 UPDATE scope=all V1-PATCH style (text only) — NOT 500',
    r.status !== 500, r);

  // 5e. V0 UPDATE scope=all changing ONLY time (no text, no parent_id)
  r = await http('POST', '/api/todo-action', { body: {
    action: 'UPDATE', date: todayISO(0),
    task: { id: validId, time: '12:00', repeat_type: 'daily' },
    scope: 'all',
  }});
  record('Robustness', 'V0 UPDATE scope=all (time only, no text) — NOT 500',
    r.status !== 500, r);
  // Verify time was actually applied
  const instCheck = (await http('GET', '/api/todos', { qs: { date: todayISO(2) } })).body?.find(t => t.parent_id === validId);
  record('Robustness', 'V0 UPDATE (time only) — time applied to expansion',
    r.status === 200 && instCheck?.time === '12:00', r, { time: instCheck?.time });

  await http('POST', '/api/todo-action', { body: { action: 'DELETE', date: todayISO(0), task: { id: validId }, scope: 'all' } });

  // 6. V1 GET /api/v1/todos/nonexistent-id — 404
  r = await http('GET', '/api/v1/todos/nonexistent-uuid-12345');
  record('Robustness', 'V1 GET nonexistent todo — 404',
    r.status === 404, r);

  // 7. V1 POST /api/v1/todos missing required date — 400
  r = await http('POST', '/api/v1/todos', { body: { text: 'no date' } });
  record('Robustness', 'V1 POST todos missing date — 400',
    r.status === 400, r);

  // 8. V1 POST /api/v1/todos missing required text — 400
  r = await http('POST', '/api/v1/todos', { body: { date: todayISO(0) } });
  record('Robustness', 'V1 POST todos missing text — 400',
    r.status === 400, r);

  // 9. V1 with invalid API key — 401
  r = await http('GET', '/api/v1/todos', { headers: { 'X-API-Key': 'cfk_invalid_key_xxxxxxxxxxxxxxxxxxxxxxxx' } });
  record('Robustness', 'V1 invalid API key — 401',
    r.status === 401, r);

  // 10. V1 fragment with future date completion — should be clamped to today
  const fId = (await http('POST', '/api/v1/todos', { body: {
    date: todayISO(0), text: 'fragment future complete test', repeat_type: 'fragment', priority: 'low',
  }})).body?.data?.id;
  if (fId) {
    const futureDate = todayISO(30);
    const now = Date.now();
    r = await http('PATCH', `/api/v1/todos/${fId}/toggle`, { body: { record: { s: now, e: now, p: 0 }, date: futureDate } });
    record('Robustness', 'V1 fragment future body.date clamped to today',
      r.status === 200 && r.body?.data?.done === true, r);
    r = await http('GET', `/api/v1/todos/${fId}`);
    record('Robustness', 'V1 fragment date NOT in future (clamped)',
      r.body?.data?.date <= todayISO(0), r, { date: r.body?.data?.date });
    await http('DELETE', `/api/v1/todos/${fId}`);
    await http('POST', '/api/v1/trash-action', { body: { action: 'DELETE_PERMANENT', id: fId } });
  }

  // 11. V1 toggle with bad record (s > e) — should silently skip record, still toggle
  const tId = (await http('POST', '/api/v1/todos', { body: {
    date: todayISO(0), text: 'bad record test', repeat_type: 'none',
  }})).body?.data?.id;
  if (tId) {
    r = await http('PATCH', `/api/v1/todos/${tId}/toggle`, { body: { record: { s: 1000, e: 500, p: 0 } } });
    record('Robustness', 'V1 toggle bad record (s>e) — still toggles, skips record',
      r.status === 200 && r.body?.data?.done === true, r);
    await http('DELETE', `/api/v1/todos/${tId}`);
    await http('POST', '/api/v1/trash-action', { body: { action: 'DELETE_PERMANENT', id: tId } });
  }

  // 12. V0 fragment TIMER_RECORD on a NON-fragment todo — should downgrade (no-op)
  const nfId = uuid();
  await http('POST', '/api/todo-action', { body: {
    action: 'CREATE', date: todayISO(0),
    task: { id: nfId, date: todayISO(0), text: 'TIMER_RECORD on none', repeat_type: 'none' },
  }});
  r = await http('POST', '/api/todo-action', { body: {
    action: 'TIMER_RECORD',
    date: todayISO(0),
    task: { id: nfId },
    record: { s: Date.now(), e: Date.now() + 60000, p: 0 },
  }});
  record('Robustness', 'V0 TIMER_RECORD on non-fragment — downgraded (no-op)',
    r.status === 200 && (r.body?.success === true || r.body?.downgraded === true), r);
  await http('POST', '/api/todo-action', { body: { action: 'DELETE', date: todayISO(0), task: { id: nfId } } });
  await http('POST', '/api/trash-action', { body: { action: 'DELETE_PERMANENT', id: nfId } });

  // 13. V0 CREATE with snake_case `copy_text` (V1-style) — post-fix: should be read by readCopyText helper
  const cId = uuid();
  r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE', date: todayISO(0),
    task: { id: cId, date: todayISO(0), text: 'snake_case copy_text', repeat_type: 'none', copy_text: 'snake-copied' },
  }});
  record('Robustness', 'V0 CREATE with copy_text snake_case — accepted',
    r.status === 200, r);
  if (r.body?.success) {
    const fetched = (await http('GET', '/api/todos', { qs: { date: todayISO(0) } })).body?.find(t => t.id === cId);
    record('Robustness', 'V0 CREATE with copy_text snake_case — value persisted',
      fetched?.copy_text === 'snake-copied', { status: 200, body: fetched, ms: 0 }, { val: fetched?.copy_text });
    await http('POST', '/api/todo-action', { body: { action: 'DELETE', date: todayISO(0), task: { id: cId } } });
    await http('POST', '/api/trash-action', { body: { action: 'DELETE_PERMANENT', id: cId } });
  }

  // 14. V0 CREATE with camelCase `copyText` — backward compat (frontend's primary path)
  const cId2 = uuid();
  r = await http('POST', '/api/todo-action', { body: {
    action: 'CREATE', date: todayISO(0),
    task: { id: cId2, date: todayISO(0), text: 'camelCase copyText', repeat_type: 'none', copyText: 'camel-copied' },
  }});
  record('Robustness', 'V0 CREATE with copyText camelCase — accepted',
    r.status === 200, r);
  if (r.body?.success) {
    const fetched = (await http('GET', '/api/todos', { qs: { date: todayISO(0) } })).body?.find(t => t.id === cId2);
    record('Robustness', 'V0 CREATE with copyText camelCase — value persisted',
      fetched?.copy_text === 'camel-copied', { status: 200, body: fetched, ms: 0 }, { val: fetched?.copy_text });
    await http('POST', '/api/todo-action', { body: { action: 'DELETE', date: todayISO(0), task: { id: cId2 } } });
    await http('POST', '/api/trash-action', { body: { action: 'DELETE_PERMANENT', id: cId2 } });
  }
}

// ============================================================================
// Main
// ============================================================================
(async () => {
  // Clean up any leftover trash before tests
  await http('POST', '/api/v1/trash-action', { body: { action: 'CLEAR_ALL' } });

  console.log('===== V1 single =====');
  await v1_single_todo().catch(e => console.error('V1 single crashed:', e));
  console.log('===== V1 recurring daily =====');
  await v1_recurring_daily().catch(e => console.error('V1 recurring crashed:', e));
  console.log('===== V1 fragment =====');
  await v1_fragment_todo().catch(e => console.error('V1 fragment crashed:', e));
  console.log('===== V0 single =====');
  await v0_single_todo().catch(e => console.error('V0 single crashed:', e));
  console.log('===== V0 recurring daily =====');
  await v0_recurring_daily().catch(e => console.error('V0 recurring crashed:', e));
  console.log('===== V0 fragment =====');
  await v0_fragment_todo().catch(e => console.error('V0 fragment crashed:', e));
  console.log('===== Robustness probes =====');
  await robustness_probes().catch(e => console.error('Robustness crashed:', e));

  // Final cleanup
  await http('POST', '/api/v1/trash-action', { body: { action: 'CLEAR_ALL' } });

  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass).length;
  console.log(`\n===== SUMMARY =====`);
  console.log(`Total: ${results.length}  Pass: ${pass}  Fail: ${fail}`);

  const fs = require('fs');
  fs.writeFileSync('/home/z/my-project/scripts/test_results.json', JSON.stringify(results, null, 2));
  console.log('Raw JSON written to /home/z/my-project/scripts/test_results.json');
})();
