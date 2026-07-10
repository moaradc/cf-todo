/**
 * cf-todo Drizzle Schema (v3.0 / db_schema 1)
 *
 * 设计原则：
 *   - 索引名与 SQL 查询硬编码一致，不可随意重命名。
 *   - 不使用 Drizzle 的 $default / $onUpdate，所有 default 都是 SQL 层
 *     （sql`DEFAULT '...'`），保证生成的迁移 SQL 是纯 DDL，不依赖运行时。
 *   - drizzle-kit generate 按 column 声明顺序生成 CREATE TABLE，
 *     新增列必须追加到末尾，不可插入中间。
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ==================== todos ====================
// 21 列，5 索引（含 1 个 partial unique index）。
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
    parentDateDelUniqueIdx: uniqueIndex('uq_todos_parent_date_deleted')
      .on(table.parent_id, table.date, table.deleted)
      .where(sql`deleted = 0`),
  }),
);

// ==================== todo_templates ====================
// 16 列，1 索引。
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
// 3 列。
export const login_attempts = sqliteTable('login_attempts', {
  ip: text('ip').primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  lock_until: integer('lock_until').notNull().default(0),
});

// ==================== settings ====================
// 2 列。value 允许 NULL（无 NOT NULL，无 DEFAULT）。
// db_schema_version 行由 baseline 迁移写入，worker.ts 运行时校验。
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// ==================== import_sessions ====================
// 5 列。
export const import_sessions = sqliteTable('import_sessions', {
  id: text('id').primaryKey(),
  mode: text('mode').notNull(),
  status: text('status').notNull().default('active'),
  started_at: integer('started_at').notNull(),
  updated_at: integer('updated_at').notNull(),
});

// ==================== export_sessions ====================
// 10 列。
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
// 3 列。
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#888888'),
});
