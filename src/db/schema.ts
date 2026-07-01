/**
 * cf-todo Drizzle Schema —— 与 src/api.js initDb() 字节级对齐
 *
 * 设计原则：
 *   - 这是 v3.0 baseline 快照，不是"优化版"。字段顺序、NOT NULL、DEFAULT
 *     全部 1:1 复制自 initDb()。即使是看起来不一致的地方
 *     （如 todo_templates.exdates 没有 NOT NULL 而 time_records 有），
 *     也保留原状——后续迁移文件再统一。
 *   - 索引名严格对齐 initDb()，因为 SQL 查询里硬编码了这些名字。
 *   - 不使用 Drizzle 的 $default / $onUpdate，所有 default 都是 SQL 层
 *     （sql\`DEFAULT '...'\`），保证生成的迁移 SQL 是纯 DDL，不依赖运行时。
 *
 * 字段顺序约束：
 *   drizzle-kit generate 按 schema.ts 中 column 声明顺序生成 CREATE TABLE，
 *   所以本文件的列顺序必须与 initDb() 完全一致。
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// ==================== todos ====================
// 21 列，4 索引。对应 initDb() 第 138-166 行。
export const todos = sqliteTable(
  'todos',
  {
    id: text('id').primaryKey(),
    parent_id: text('parent_id').notNull(),
    date: text('date').notNull(),
    text: text('text').notNull(),
    time: text('time'),
    priority: text('priority'),
    desc: text('desc'),
    url: text('url'),
    copy_text: text('copy_text'),
    subtasks: text('subtasks'),
    search_terms: text('search_terms'),
    done: integer('done').notNull().default(0),
    deleted: integer('deleted').notNull().default(0),
    type: text('type').notNull().default('none'),
    end_time: text('end_time').default(''),
    category_id: text('category_id').default(''),

    time_records: text('time_records').notNull().default('[]'),
    fragment_anchor: text('fragment_anchor').notNull().default(''),
    rrule: text('rrule').notNull().default(''),
    anchor_date: text('anchor_date').notNull().default(''),
    exdates: text('exdates').notNull().default('[]'),
  },
  (table) => ({
    cursorIdx: index('idx_todos_cursor').on(table.date, table.deleted, table.id),
    parentDateDelIdx: index('idx_todos_parent_date_del').on(table.parent_id, table.date, table.deleted),
    statsIdx: index('idx_todos_stats').on(table.date, table.deleted, table.priority, table.done, table.category_id, table.time),
    typeIdx: index('idx_todos_type').on(table.type),
  }),
);

// ==================== todo_templates ====================
// 16 列，1 索引。对应 initDb() 第 168-181 行。
// 注意：exdates 这里没有 NOT NULL（与 time_records 不一致），这是 initDb 原貌，保留。
export const todo_templates = sqliteTable(
  'todo_templates',
  {
    parent_id: text('parent_id').primaryKey(),
    text: text('text'),
    time: text('time'),
    priority: text('priority'),
    desc: text('desc'),
    url: text('url'),
    copy_text: text('copy_text'),
    subtasks: text('subtasks'),
    search_terms: text('search_terms'),
    type: text('type').notNull().default('recurring'),
    end_time: text('end_time').default(''),
    anchor_date: text('anchor_date').notNull().default(''),
    exdates: text('exdates').default('[]'),
    category_id: text('category_id').default(''),
    time_records: text('time_records').notNull().default('[]'),
    rrule: text('rrule').notNull().default(''),
  },
  (table) => ({
    typeIdx: index('idx_templates_type').on(table.type),
  }),
);

// ==================== login_attempts ====================
// 3 列。对应 initDb() 第 183-187 行。
export const login_attempts = sqliteTable('login_attempts', {
  ip: text('ip').primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  lock_until: integer('lock_until').notNull().default(0),
});

// ==================== settings ====================
// 2 列。对应 initDb() 第 190-193 行。
// value 允许 NULL（无 NOT NULL，无 DEFAULT）。
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// ==================== import_sessions ====================
// 5 列。对应 initDb() 第 196-202 行。
export const import_sessions = sqliteTable('import_sessions', {
  id: text('id').primaryKey(),
  mode: text('mode').notNull(),
  status: text('status').notNull().default('active'),
  started_at: integer('started_at').notNull(),
  updated_at: integer('updated_at').notNull(),
});

// ==================== export_sessions ====================
// 10 列。对应 initDb() 第 205-217 行。
export const export_sessions = sqliteTable('export_sessions', {
  id: text('id').primaryKey(),
  status: text('status').notNull().default('active'),
  inc_todos: integer('inc_todos').notNull().default(0),
  inc_trash: integer('inc_trash').notNull().default(0),
  inc_settings: integer('inc_settings').notNull().default(0),
  total_todos: integer('total_todos').notNull().default(0),
  total_templates: integer('total_templates').notNull().default(0),
  todos_cursor: text('todos_cursor').notNull().default(''),
  templates_cursor: text('templates_cursor').notNull().default(''),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
});

// ==================== categories ====================
// 3 列。对应 initDb() 第 220-224 行。
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#888888'),
});


