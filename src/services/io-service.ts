/**
 * IO Service —— V0 Export / Import / Import-backup
 *
 *
 * 三个路由：
 *   - GET  /api/export（page/session/stream）
 *   - POST /api/import（init/finalize/status/abort + NDJSON）
 *   - ALL  /api/import-backup（query/restore/clear，无 method 检查）
 *
 * 用 raw D1 API 保持与原代码字节级一致。
 *
 * 审计保留：
 *   import_backup_time 10 分钟 TTL
 */

import type { Db } from '../db/client';

/** D1 原生数据库实例。 */
function d1(db: Db): D1Database {
  return (db as unknown as { $client: D1Database }).$client;
}

// ==================== Export ====================

/** 导出 page 模式 */
export async function exportPage(
  db: Db,
  params: { type?: string; cursor?: string; sessionId?: string; final?: boolean; todos?: boolean; trash?: boolean },
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  const d = d1(db);
  const type = params.type || 'todos';
  const cursor = params.cursor || '';
  const sessionId = params.sessionId || '';
  const PAGE_SIZE = 500;
  const incTodos = params.todos === true;
  const incTrash = params.trash === true;

  let condition = '1=0';
  if (type === 'todos') {
    if (incTodos && incTrash) condition = '1=1';
    else if (incTodos) condition = 'deleted = 0';
    else if (incTrash) condition = 'deleted = 1';
  } else {
    condition = '1=1';
  }

  const tableName = type === 'templates' ? 'todo_templates' : 'todos';
  let cursorCondition = '';
  let cursorParams: (string | number)[] = [];
  if (cursor) {
    if (type === 'todos') {
      const parts = cursor.split(':');
      const cursorDate = parts[0] || '';
      const cursorDeleted = parts[1] === '1' ? 1 : 0;
      const cursorId = parts.slice(2).join(':');
      cursorCondition = ` AND (date > ? OR (date = ? AND deleted > ?) OR (date = ? AND deleted = ? AND id > ?))`;
      cursorParams = [cursorDate, cursorDate, cursorDeleted, cursorDate, cursorDeleted, cursorId];
    } else {
      cursorCondition = ` AND parent_id > ?`;
      cursorParams = [cursor];
    }
  }

  const orderBy = type === 'todos' ? 'date ASC, deleted ASC, id ASC' : 'parent_id ASC';
  const dataRes = await d
    .prepare(`SELECT * FROM ${tableName} WHERE ${condition}${cursorCondition} ORDER BY ${orderBy} LIMIT ?`)
    .bind(...cursorParams, PAGE_SIZE)
    .all();

  const rows = (dataRes.results || []) as Record<string, unknown>[];
  let nextCursor = '';
  const hasMore = rows.length === PAGE_SIZE;
  if (hasMore) {
    const last = rows[rows.length - 1];
    nextCursor = type === 'todos' ? `${last.date}:${last.deleted}:${last.id}` : (last.parent_id as string);
  } else if (sessionId && params.final === true) {
    waitUntil(d.prepare('DELETE FROM export_sessions WHERE id = ?').bind(sessionId).run().catch(() => {}));
  }

  const lines: string[] = [];
  for (const row of rows) {
    lines.push(JSON.stringify(type === 'templates' ? { _type: 'template', ...row } : row));
  }
  if (hasMore) {
    lines.push(JSON.stringify({ _type: 'page_info', cursor: nextCursor, hasMore: true }));
  } else {
    lines.push(JSON.stringify({ _type: 'page_info', cursor: '', hasMore: false }));
  }
  const body = 'ndjson\n' + lines.join('\n') + '\n';
  return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
}

/** 导出 session 模式 */
export async function exportSession(
  db: Db,
  params: { action?: string; sessionId?: string; todos?: boolean; trash?: boolean; settings?: boolean; categories?: boolean; todosCursor?: string | null; templatesCursor?: string | null },
): Promise<Response> {
  const d = d1(db);
  const action = params.action || 'create';
  const sessionId = params.sessionId;

  if (action === 'create') {
    const incTodos = params.todos === true ? 1 : 0;
    const incTrash = params.trash === true ? 1 : 0;
    const incSettings = params.settings === true ? 1 : 0;
    const incCategories = params.categories === true ? 1 : 0;
    const id = sessionId || crypto.randomUUID();
    const now = Date.now();

    let todoCondition = '1=0';
    if (incTodos && incTrash) todoCondition = '1=1';
    else if (incTodos) todoCondition = 'deleted = 0';
    else if (incTrash) todoCondition = 'deleted = 1';

    const hasTodoData = incTodos || incTrash;
    const [todoExistsRes, tplExistsRes] = hasTodoData
      ? await Promise.all([
          d.prepare(`SELECT 1 FROM todos WHERE ${todoCondition} LIMIT 1`).first(),
          incTodos ? d.prepare('SELECT 1 FROM todo_templates LIMIT 1').first() : Promise.resolve(null),
        ])
      : [null, null];

    const EXPORT_TIMEOUT = 10 * 60 * 1000;
    const oldSession = await d.prepare('SELECT * FROM export_sessions WHERE status = ?').bind('active').first<Record<string, unknown>>();
    if (oldSession) {
      if (now - (oldSession.updated_at as number) < EXPORT_TIMEOUT) {
        return new Response(JSON.stringify({ error: '存在进行中的导出会话', conflict: true, sessionId: oldSession.id }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
      await d.prepare('DELETE FROM export_sessions WHERE id = ?').bind(oldSession.id).run();
    }

    const staleSessions = await d.prepare('SELECT id FROM export_sessions WHERE updated_at < ?').bind(now - EXPORT_TIMEOUT).all();
    if (staleSessions.results && staleSessions.results.length > 0) {
      await d.prepare('DELETE FROM export_sessions WHERE updated_at < ?').bind(now - EXPORT_TIMEOUT).run();
    }

    await d
      .prepare('INSERT INTO export_sessions (id, status, inc_todos, inc_trash, inc_settings, todos_cursor, templates_cursor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, 'active', incTodos, incTrash, incSettings, '', '', now, now)
      .run();

    return new Response(
      JSON.stringify({ sessionId: id, hasData: !!(todoExistsRes || tplExistsRes || incSettings || incCategories) }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (action === 'update' && sessionId) {
    const session = await d.prepare('SELECT * FROM export_sessions WHERE id = ? AND status = ?').bind(sessionId, 'active').first();
    if (!session) return new Response(JSON.stringify({ error: 'Session not found or not active' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    const todosCursor = params.todosCursor;
    const templatesCursor = params.templatesCursor;
    const now = Date.now();
    if (todosCursor !== null && todosCursor !== undefined) {
      await d.prepare('UPDATE export_sessions SET todos_cursor = ?, updated_at = ? WHERE id = ?').bind(todosCursor, now, sessionId).run();
    }
    if (templatesCursor !== null && templatesCursor !== undefined) {
      await d.prepare('UPDATE export_sessions SET templates_cursor = ?, updated_at = ? WHERE id = ?').bind(templatesCursor, now, sessionId).run();
    }
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (action === 'status' && sessionId) {
    const session = await d.prepare('SELECT * FROM export_sessions WHERE id = ?').bind(sessionId).first<Record<string, unknown>>();
    if (!session) return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(
      JSON.stringify({ sessionId: session.id, status: session.status, todosCursor: session.todos_cursor, templatesCursor: session.templates_cursor }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  if ((action === 'done' || action === 'abort') && sessionId) {
    await d.prepare('DELETE FROM export_sessions WHERE id = ?').bind(sessionId).run();
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Invalid session action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}

export function exportStream(
  db: Db,
  params: {
    sessionId?: string | null;
    todosCursor?: string;
    templatesCursor?: string;
    skipHeader?: boolean;
    todos?: boolean;
    trash?: boolean;
    settings?: boolean;
    categories?: boolean;
  },
): Response {
  const d = d1(db);
  let _todosCursor = params.todosCursor || '';
  let _templatesCursor = params.templatesCursor || '';
  let todosDone = _todosCursor === '__done__';
  let templatesDone = _templatesCursor === '__done__';
  const skipHeader = params.skipHeader === true;
  const incTodos = params.todos === true;
  const incTrash = params.trash === true;
  const incSettings = params.settings === true;
  const incCategories = params.categories === true;
  const STREAM_PAGE_SIZE = 500;
  const SESSION_UPDATE_INTERVAL = 5;
  const MAX_QUERIES_PER_INVOCATION = 45;
  const sessionId = params.sessionId || null;

  let todoCondition = '1=0';
  if (incTodos && incTrash) todoCondition = '1=1';
  else if (incTodos) todoCondition = 'deleted = 0';
  else if (incTrash) todoCondition = 'deleted = 1';

  const encoder = new TextEncoder();
  let pageCount = 0;
  let queryCount = 0;
  let headerEmitted = skipHeader;
  let continuationEmitted = false;

  function buildTodoCursorCondition(cursor: string): { sql: string; params: (string | number)[] } {
    if (!cursor) return { sql: '', params: [] };
    const parts = cursor.split(':');
    const cursorDate = parts[0] || '';
    const cursorDeleted = parts[1] === '1' ? 1 : 0;
    const cursorId = parts.slice(2).join(':');
    return { sql: ` AND (date > ? OR (date = ? AND deleted > ?) OR (date = ? AND deleted = ? AND id > ?))`, params: [cursorDate, cursorDate, cursorDeleted, cursorDate, cursorDeleted, cursorId] };
  }

  function encodeNdjsonLine(obj: unknown): string {
    return JSON.stringify(obj) + '\n';
  }

  function enqueueBatch(controller: ReadableStreamDefaultController, rows: Record<string, unknown>[], mapper?: (r: Record<string, unknown>) => string): void {
    if (rows.length === 0) return;
    const chunk = rows.map(mapper || ((r) => JSON.stringify(r) + '\n')).join('');
    controller.enqueue(encoder.encode(chunk));
  }

  function emitContinuation(controller: ReadableStreamDefaultController): void {
    continuationEmitted = true;
    controller.enqueue(
      encoder.encode(
        encodeNdjsonLine({ _type: 'continuation', todosCursor: todosDone ? '__done__' : _todosCursor, templatesCursor: templatesDone ? '__done__' : _templatesCursor, hasMore: true }),
      ),
    );
  }

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (continuationEmitted) {
          controller.close();
          return;
        }

        if (!headerEmitted) {
          controller.enqueue(encoder.encode('ndjson\n'));
          if (incSettings) {
            const [settingsRes, headerRes, contentRes, customColorsRes] = await d.batch([
              d.prepare("SELECT value FROM settings WHERE key = 'app_settings'"),
              d.prepare("SELECT value FROM settings WHERE key = 'custom_header'"),
              d.prepare("SELECT value FROM settings WHERE key = 'custom_content'"),
              d.prepare("SELECT value FROM settings WHERE key = 'customColors'"),
            ]);
            queryCount++;
            const settingsRecord = settingsRes.results?.[0] as { value?: string } | undefined;
            let settingsObj: unknown = {};
            try { settingsObj = settingsRecord?.value ? JSON.parse(settingsRecord.value) : {}; } catch { /* 静默 */ }
            controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'settings', data: settingsObj })));
            const headerRecord = headerRes.results?.[0] as { value?: string } | undefined;
            controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'custom_header', data: headerRecord?.value || '' })));
            const contentRecord = contentRes.results?.[0] as { value?: string } | undefined;
            controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'custom_content', data: contentRecord?.value || '' })));
            const customColorsRecord = customColorsRes.results?.[0] as { value?: string } | undefined;
            let customColorsArr: unknown[] = [];
            try { customColorsArr = customColorsRecord?.value ? JSON.parse(customColorsRecord.value) : []; } catch { /* 静默 */ }
            controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'customColors', data: customColorsArr })));
          }
          if (incCategories) {
            const { results: catRes } = await d.prepare('SELECT id, name, color FROM categories ORDER BY id').all();
            queryCount++;
            controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'categories', data: catRes || [] })));
          }
          headerEmitted = true;
        }

        if (!todosDone) {
          if (queryCount >= MAX_QUERIES_PER_INVOCATION) { emitContinuation(controller); return; }
          const cc = buildTodoCursorCondition(_todosCursor);
          const dataRes = await d.prepare(`SELECT * FROM todos WHERE ${todoCondition}${cc.sql} ORDER BY date ASC, deleted ASC, id ASC LIMIT ?`).bind(...cc.params, STREAM_PAGE_SIZE).all();
          queryCount++;
          const rows = (dataRes.results || []) as Record<string, unknown>[];
          enqueueBatch(controller, rows);
          pageCount++;
          if (rows.length === STREAM_PAGE_SIZE) {
            const last = rows[rows.length - 1];
            _todosCursor = `${last.date}:${last.deleted}:${last.id}`;
            if (sessionId && pageCount % SESSION_UPDATE_INTERVAL === 0) {
              await d.prepare('UPDATE export_sessions SET todos_cursor = ?, updated_at = ? WHERE id = ?').bind(_todosCursor, Date.now(), sessionId).run();
              queryCount++;
            }
            return;
          } else {
            todosDone = true;
            if (sessionId) { await d.prepare('UPDATE export_sessions SET todos_cursor = ?, updated_at = ? WHERE id = ?').bind('__done__', Date.now(), sessionId).run(); queryCount++; }
          }
        }

        if (todosDone && !templatesDone && incTodos) {
          if (queryCount >= MAX_QUERIES_PER_INVOCATION) { emitContinuation(controller); return; }
          const tplCursorSql = _templatesCursor ? ' AND parent_id > ?' : '';
          const tplCursorParams = _templatesCursor ? [_templatesCursor] : [];
          const dataRes = await d.prepare(`SELECT * FROM todo_templates WHERE 1=1${tplCursorSql} ORDER BY parent_id ASC LIMIT ?`).bind(...tplCursorParams, STREAM_PAGE_SIZE).all();
          queryCount++;
          const rows = (dataRes.results || []) as Record<string, unknown>[];
          enqueueBatch(controller, rows, (r) => JSON.stringify({ _type: 'template', ...r }) + '\n');
          pageCount++;
          if (rows.length === STREAM_PAGE_SIZE) {
            _templatesCursor = rows[rows.length - 1].parent_id as string;
            if (sessionId && pageCount % SESSION_UPDATE_INTERVAL === 0) {
              await d.prepare('UPDATE export_sessions SET templates_cursor = ?, updated_at = ? WHERE id = ?').bind(_templatesCursor, Date.now(), sessionId).run();
              queryCount++;
            }
            return;
          } else {
            templatesDone = true;
            if (sessionId) { await d.prepare('UPDATE export_sessions SET templates_cursor = ?, updated_at = ? WHERE id = ?').bind('__done__', Date.now(), sessionId).run(); queryCount++; }
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Content-Disposition': 'attachment; filename="todo_export.json"' },
  });
}

// ==================== Import ====================

const BATCH_ROWS = 100;
const BATCH_STMTS = 25;
const TODO_ROWS_PER_INSERT = 4;
const TEMPLATE_ROWS_PER_INSERT = 6;
const TODO_COLUMNS = '(id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, time_records, fragment_anchor, rrule, anchor_date, exdates)';
const TODO_ROW_PLACEHOLDER = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const TEMPLATE_COLUMNS = '(parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule)';
const TEMPLATE_ROW_PLACEHOLDER = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const BACKUP_TTL = 10 * 60 * 1000;

function safeStringify(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return JSON.stringify(v);
  if (v != null && typeof v === 'object') return JSON.stringify(v);
  return '[]';
}

function safeTimeRecords(v: unknown): string {
  if (v == null || v === '[]') return '[]';
  if (typeof v === 'string') {
    try { const parsed = JSON.parse(v); if (Array.isArray(parsed)) return v; } catch { /* 静默 */ }
    return '[]';
  }
  if (Array.isArray(v)) return JSON.stringify(v);
  return '[]';
}

/** import NDJSON 上传 */
export async function importNdjson(db: Db, request: Request, importId: string): Promise<Response> {
  const d = d1(db);
  if (!importId) return new Response(JSON.stringify({ error: 'importId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  if (!request.body) return new Response(JSON.stringify({ error: '请求体为空' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const session = await d.prepare('SELECT * FROM import_sessions WHERE id = ? AND status = ?').bind(importId, 'active').first();
  if (!session) return new Response(JSON.stringify({ error: '无效或已过期的导入会话' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const TODO_BIND_EXTRACTOR = (t: Record<string, unknown>): unknown[] => {
    const type = (t.type as string) || 'none';
    const rrule = (t.rrule as string) || '';
    return [
      t.id, t.parent_id, t.date, t.text, t.time || '', t.priority || 'low',
      t.desc || '', t.url || '', t.copy_text || '',
      safeStringify(t.subtasks), safeStringify(t.search_terms), t.done || 0, t.deleted || 0,
      type, t.end_time || '', t.category_id || '',
      safeTimeRecords(t.time_records), t.fragment_anchor || '',
      rrule, t.anchor_date || t.date || '', t.exdates || '[]',
    ];
  };

  const TEMPLATE_BIND_EXTRACTOR = (t: Record<string, unknown>): unknown[] => {
    const exdates = (t.exdates as string) || '[]';
    const type = (t.type as string) || 'recurring';
    const rrule = (t.rrule as string) || '';
    return [
      t.parent_id, t.text || '', t.time || '', t.priority || 'low', t.desc || '', t.url || '', t.copy_text || '',
      safeStringify(t.subtasks), safeStringify(t.search_terms), type, t.end_time || '',
      t.anchor_date || '', exdates, t.category_id || '', safeTimeRecords(t.time_records), rrule,
    ];
  };

  const buildMultiRowStmts = (items: Record<string, unknown>[], tableName: string, columns: string, rowPlaceholder: string, rowsPerInsert: number, bindExtractor: (t: Record<string, unknown>) => unknown[]): D1PreparedStatement[] => {
    if (!items || items.length === 0) return [];
    const stmts: D1PreparedStatement[] = [];
    for (let i = 0; i < items.length; i += rowsPerInsert) {
      const chunk = items.slice(i, i + rowsPerInsert);
      const placeholders = chunk.map(() => rowPlaceholder).join(', ');
      const params = chunk.flatMap(bindExtractor);
      stmts.push(d.prepare(`INSERT OR REPLACE INTO ${tableName} ${columns} VALUES ${placeholders}`).bind(...params));
    }
    return stmts;
  };

  const buildTodoStmts = (items: Record<string, unknown>[]) => buildMultiRowStmts(items, 'todos', TODO_COLUMNS, TODO_ROW_PLACEHOLDER, TODO_ROWS_PER_INSERT, TODO_BIND_EXTRACTOR);
  const buildTemplateStmts = (items: Record<string, unknown>[]) => buildMultiRowStmts(items, 'todo_templates', TEMPLATE_COLUMNS, TEMPLATE_ROW_PLACEHOLDER, TEMPLATE_ROWS_PER_INSERT, TEMPLATE_BIND_EXTRACTOR);

  const execBatch = async (stmts: D1PreparedStatement[]): Promise<void> => {
    for (let i = 0; i < stmts.length; i += BATCH_STMTS) {
      await d.batch(stmts.slice(i, i + BATCH_STMTS));
    }
  };

  let buffer = '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let todoBatch: Record<string, unknown>[] = [];
  let tplBatch: Record<string, unknown>[] = [];
  let ndjsonPrefixSkipped = false;

  const processBuffer = async (): Promise<void> => {
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!ndjsonPrefixSkipped) {
        ndjsonPrefixSkipped = true;
        if (trimmed === 'ndjson') continue;
      }
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj._type === 'template') {
        const tpl = { ...obj }; delete tpl._type;
        tplBatch.push(tpl);
        if (tplBatch.length >= BATCH_ROWS) { await execBatch(buildTemplateStmts(tplBatch)); tplBatch = []; }
      } else if (obj._type) {
        // settings/categories etc. handled by frontend separately
      } else {
        todoBatch.push(obj);
        if (todoBatch.length >= BATCH_ROWS) { await execBatch(buildTodoStmts(todoBatch)); todoBatch = []; }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (value) { buffer += decoder.decode(value, { stream: true }); }
      buffer += decoder.decode();
      await processBuffer();
      break;
    }
    if (value) { buffer += decoder.decode(value, { stream: true }); }
    await processBuffer();
  }

  if (buffer.trim()) {
    const obj = JSON.parse(buffer.trim()) as Record<string, unknown>;
    if (obj._type === 'template') { const tpl = { ...obj }; delete tpl._type; tplBatch.push(tpl); }
    else if (!obj._type) { todoBatch.push(obj); }
  }

  if (todoBatch.length > 0) { await execBatch(buildTodoStmts(todoBatch)); }
  if (tplBatch.length > 0) { await execBatch(buildTemplateStmts(tplBatch)); }

  await d.prepare('UPDATE import_sessions SET updated_at = ? WHERE id = ?').bind(Date.now(), importId).run();
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}

/** clearBackupTables / cleanExpiredBackups / restoreBackup 辅助 */
async function clearBackupTables(d: D1Database): Promise<void> {
  try {
    await d.batch([d.prepare('DROP TABLE IF EXISTS todos_backup'), d.prepare('DROP TABLE IF EXISTS todo_templates_backup'), d.prepare('DROP TABLE IF EXISTS categories_backup')]);
  } catch (e) { console.error('Failed to drop backup tables:', e); }
}

async function cleanExpiredBackups(d: D1Database): Promise<void> {
  const record = await d.prepare("SELECT value FROM settings WHERE key = 'import_backup_time'").first<{ value: string }>();
  if (!record || !record.value) return;
  const backupTime = parseInt(record.value, 10);
  if (isNaN(backupTime) || Date.now() - backupTime < BACKUP_TTL) return;
  await clearBackupTables(d);
  await d.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
}

/** 索引重建语句（abort/init/finalize/import-backup restore 共用）。 */
const INDEX_REBUILD_STMTS = (d: D1Database) => [
  d.prepare('CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)'),
  d.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
  d.prepare('CREATE INDEX IF NOT EXISTS idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)'),
  d.prepare('CREATE INDEX IF NOT EXISTS idx_templates_type ON todo_templates(type)'),
];

/** 恢复备份（DROP 当前 + RENAME backup 回来 + 重建索引） */
async function restoreFromBackup(d: D1Database): Promise<void> {
  await d.batch([
    d.prepare('DROP TABLE IF EXISTS todos'),
    d.prepare('DROP TABLE IF EXISTS todo_templates'),
    d.prepare('DROP TABLE IF EXISTS categories'),
    d.prepare('ALTER TABLE todos_backup RENAME TO todos'),
    d.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'),
    d.prepare('ALTER TABLE categories_backup RENAME TO categories'),
    ...INDEX_REBUILD_STMTS(d),
  ]);
}

/** import JSON phase（init/finalize/status/abort） */
export async function importPhase(db: Db, impBody: Record<string, unknown>): Promise<Response> {
  const d = d1(db);
  const phase = impBody.phase as string | undefined;

  try {
    if (phase === 'status') {
      await cleanExpiredBackups(d);
      const session = await d.prepare('SELECT * FROM import_sessions WHERE status = ?').bind('active').first<Record<string, unknown>>();
      if (!session) return new Response(JSON.stringify({ active: false }), { headers: { 'Content-Type': 'application/json' } });
      const now = Date.now();
      const TIMEOUT = 10 * 60 * 1000;
      const timedOut = now - (session.updated_at as number) > TIMEOUT;
      const [todoBakRes, tplBakRes] = await Promise.all([
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
      ]);
      return new Response(
        JSON.stringify({ active: true, importId: session.id, mode: session.mode, startedAt: session.started_at, updatedAt: session.updated_at, timedOut, hasBackup: !!(todoBakRes || tplBakRes) }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (phase === 'abort') {
      const importId = impBody.importId as string;
      const discard = !!impBody.discard;
      const keepBackup = !!impBody.keepBackup;
      if (!importId) return new Response(JSON.stringify({ error: 'importId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const session = await d.prepare('SELECT * FROM import_sessions WHERE id = ?').bind(importId).first<Record<string, unknown>>();
      if (!session) return new Response(JSON.stringify({ error: '会话不存在' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (session.mode === 'overwrite' && !keepBackup) {
        if (discard) { await clearBackupTables(d); }
        else { try { await restoreFromBackup(d); } catch (e) { return new Response(JSON.stringify({ error: '恢复备份失败: ' + ((e as Error).message) }), { status: 500, headers: { 'Content-Type': 'application/json' } }); } }
      }
      await d.prepare('DELETE FROM import_sessions WHERE id = ?').bind(importId).run();
      if (session.mode === 'overwrite' && !keepBackup) { await d.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run(); }
      return new Response(JSON.stringify({ success: true, recovered: session.mode === 'overwrite' && !discard && !keepBackup }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (phase === 'init') {
      const importId = impBody.importId as string;
      const mode = (impBody.mode as string) || 'merge';
      if (!importId) return new Response(JSON.stringify({ error: 'importId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      await cleanExpiredBackups(d);
      const oldSession = await d.prepare('SELECT * FROM import_sessions WHERE status = ?').bind('active').first<Record<string, unknown>>();
      if (oldSession) {
        const now = Date.now();
        const TIMEOUT = 10 * 60 * 1000;
        if (now - (oldSession.updated_at as number) < TIMEOUT) {
          return new Response(JSON.stringify({ error: '存在进行中的导入会话', conflict: true, importId: oldSession.id, mode: oldSession.mode }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }
        if (oldSession.mode === 'overwrite') { try { await restoreFromBackup(d); } catch (e) { console.error('Auto-recover old session failed:', e); } }
        await d.prepare('DELETE FROM import_sessions WHERE id = ?').bind(oldSession.id).run();
        if (oldSession.mode === 'overwrite') { await d.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run(); }
      }
      const now = Date.now();
      if (mode === 'overwrite') {
        try {
          await d.batch([
            d.prepare('DROP TABLE IF EXISTS todos_backup'), d.prepare('DROP TABLE IF EXISTS todo_templates_backup'), d.prepare('DROP TABLE IF EXISTS categories_backup'),
            d.prepare('DROP INDEX IF EXISTS idx_todos_cursor'), d.prepare('DROP INDEX IF EXISTS idx_todos_parent_date_del'),
            d.prepare('DROP INDEX IF EXISTS idx_todos_stats'), d.prepare('DROP INDEX IF EXISTS idx_templates_type'),
            d.prepare('DROP INDEX IF EXISTS idx_todos_type'), d.prepare('DROP INDEX IF EXISTS idx_templates_type'),
          ]);
          await d.batch([
            d.prepare('ALTER TABLE todos RENAME TO todos_backup'),
            d.prepare('ALTER TABLE todo_templates RENAME TO todo_templates_backup'),
            d.prepare('ALTER TABLE categories RENAME TO categories_backup'),
          ]);
          await d.batch([
            d.prepare(`CREATE TABLE todos (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL, date TEXT NOT NULL, text TEXT NOT NULL, time TEXT, priority TEXT, desc TEXT, url TEXT, copy_text TEXT, subtasks TEXT, search_terms TEXT, done INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, type TEXT NOT NULL DEFAULT 'none', end_time TEXT DEFAULT '', category_id TEXT DEFAULT '', time_records TEXT NOT NULL DEFAULT '[]', fragment_anchor TEXT NOT NULL DEFAULT '', rrule TEXT NOT NULL DEFAULT '', anchor_date TEXT NOT NULL DEFAULT '', exdates TEXT NOT NULL DEFAULT '[]')`),
            d.prepare('CREATE INDEX idx_todos_cursor ON todos(date, deleted, id)'),
            d.prepare('CREATE INDEX idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
            d.prepare('CREATE INDEX idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)'),
            d.prepare('CREATE INDEX idx_todos_type ON todos(type)'),
            d.prepare(`CREATE TABLE todo_templates (parent_id TEXT PRIMARY KEY, text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT, copy_text TEXT, subtasks TEXT, search_terms TEXT, type TEXT NOT NULL DEFAULT 'recurring', end_time TEXT DEFAULT '', anchor_date TEXT NOT NULL DEFAULT '', exdates TEXT DEFAULT '[]', category_id TEXT DEFAULT '', time_records TEXT NOT NULL DEFAULT '[]', rrule TEXT NOT NULL DEFAULT '')`),
            d.prepare('CREATE INDEX idx_templates_type ON todo_templates(type)'),
            d.prepare('CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT \'#888888\')'),
            d.prepare('INSERT INTO import_sessions (id, mode, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(importId, 'overwrite', 'active', now, now),
            d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('import_backup_time', ?)").bind(String(now)),
          ]);
        } catch (backupErr) {
          try { await restoreFromBackup(d); } catch (rollbackErr) { console.error('Rollback after backup failure also failed:', rollbackErr); }
          return new Response(JSON.stringify({ error: '覆写前备份失败: ' + ((backupErr as Error).message) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      } else {
        await d.prepare('INSERT INTO import_sessions (id, mode, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(importId, 'merge', 'active', now, now).run();
      }
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (phase === 'finalize') {
      const importId = impBody.importId as string;
      if (!importId) return new Response(JSON.stringify({ error: 'importId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const session = await d.prepare('SELECT * FROM import_sessions WHERE id = ?').bind(importId).first<Record<string, unknown>>();
      if (!session) return new Response(JSON.stringify({ error: '会话不存在' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (session.mode === 'overwrite') {
        try { await d.batch(INDEX_REBUILD_STMTS(d)); } catch (e) { console.error('Index rebuild after finalize:', e); }
      }
      if (impBody.custom_header !== undefined || impBody.custom_content !== undefined) {
        const customStmts: D1PreparedStatement[] = [];
        if (impBody.custom_header !== undefined) customStmts.push(d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_header', ?)").bind(impBody.custom_header));
        if (impBody.custom_content !== undefined) customStmts.push(d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_content', ?)").bind(impBody.custom_content));
        if (customStmts.length > 0) await d.batch(customStmts);
      }
      if (impBody.categories && Array.isArray(impBody.categories)) {
        if (session.mode === 'overwrite') { await d.prepare('DELETE FROM categories').run(); }
        const insertStmts = (impBody.categories as Array<Record<string, unknown>>).filter((c) => c.id && c.name).map((c) => d.prepare('INSERT OR REPLACE INTO categories (id, name, color) VALUES (?, ?, ?)').bind(c.id, c.name, c.color || '#888888'));
        if (insertStmts.length > 0) await d.batch(insertStmts);
        await d.batch([
          d.prepare("UPDATE todos SET category_id = '' WHERE category_id != '' AND category_id NOT IN (SELECT id FROM categories)"),
          d.prepare("UPDATE todo_templates SET category_id = '' WHERE category_id != '' AND category_id NOT IN (SELECT id FROM categories)"),
        ]);
      }
      if (impBody.customColors && Array.isArray(impBody.customColors)) {
        await d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(impBody.customColors)).run();
      }
      await d.prepare('DELETE FROM import_sessions WHERE id = ?').bind(importId).run();
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: '未知 phase，可用: status, abort, init, finalize' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// ==================== Import-backup ====================

/** import-backup（query/restore/clear，无 method 检查） */
export async function importBackup(db: Db, action: string): Promise<Response> {
  const d = d1(db);
  try {
    if (action === 'query') {
      const [todoBakRes, tplBakRes, catBakRes] = await Promise.all([
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories_backup'").first(),
      ]);
      const hasTodoBak = !!todoBakRes;
      const hasTplBak = !!tplBakRes;
      const hasCatBak = !!catBakRes;
      return new Response(
        JSON.stringify({ exists: hasTodoBak || hasTplBak || hasCatBak, todos: hasTodoBak ? 'backup_exists' : 0, templates: hasTplBak ? 'backup_exists' : 0, categories: hasCatBak ? 'backup_exists' : 0 }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'restore') {
      const [todoBakRes, tplBakRes, catBakRes] = await Promise.all([
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories_backup'").first(),
      ]);
      const hasTodoBak = !!todoBakRes;
      const hasTplBak = !!tplBakRes;
      const hasCatBak = !!catBakRes;
      if (!hasTodoBak && !hasTplBak && !hasCatBak) {
        return new Response(JSON.stringify({ error: '未找到备份数据，无需恢复' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      try {
        const restoreStmts: D1PreparedStatement[] = [];
        if (hasTodoBak) restoreStmts.push(d.prepare('DROP TABLE IF EXISTS todos'), d.prepare('ALTER TABLE todos_backup RENAME TO todos'), d.prepare('CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)'), d.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'), d.prepare('CREATE INDEX IF NOT EXISTS idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)'));
        if (hasTplBak) restoreStmts.push(d.prepare('DROP TABLE IF EXISTS todo_templates'), d.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'), d.prepare('CREATE INDEX IF NOT EXISTS idx_templates_type ON todo_templates(type)'));
        if (hasCatBak) restoreStmts.push(d.prepare('DROP TABLE IF EXISTS categories'), d.prepare('ALTER TABLE categories_backup RENAME TO categories'));
        await d.batch(restoreStmts);
      } catch (e) {
        return new Response(JSON.stringify({ error: '恢复失败: ' + ((e as Error).message) + '，备份数据仍保留，可重试' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      await d.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
      return new Response(
        JSON.stringify({ success: true, restored: { todos: hasTodoBak ? 'restored' : 0, templates: hasTplBak ? 'restored' : 0, categories: hasCatBak ? 'restored' : 0 } }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'clear') {
      const [todoBakRes, tplBakRes, catBakRes] = await Promise.all([
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
        d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories_backup'").first(),
      ]);
      const hasTodoBak = !!todoBakRes;
      const hasTplBak = !!tplBakRes;
      const hasCatBak = !!catBakRes;
      if (!hasTodoBak && !hasTplBak && !hasCatBak) {
        return new Response(JSON.stringify({ success: true, message: '无残留备份，无需清除' }), { headers: { 'Content-Type': 'application/json' } });
      }
      await d.batch([d.prepare('DROP TABLE IF EXISTS todos_backup'), d.prepare('DROP TABLE IF EXISTS todo_templates_backup'), d.prepare('DROP TABLE IF EXISTS categories_backup')]);
      await d.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
      return new Response(JSON.stringify({ success: true, message: '备份记录已清除（原始数据未恢复）' }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: '未知操作，可用: query, restore, clear' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
