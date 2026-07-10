-- cf-todo baseline 迁移：7 张表 + 5 个索引
-- 用 CREATE TABLE IF NOT EXISTS 保留对已存在 D1 的兼容（已存在的表被跳过）。
-- 后续 0001+ 迁移回归 drizzle 默认风格（不带 IF NOT EXISTS）。
CREATE TABLE IF NOT EXISTS `categories` (
        `id` text PRIMARY KEY NOT NULL,
        `name` text NOT NULL,
        `color` text DEFAULT '#888888' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `export_sessions` (
        `id` text PRIMARY KEY NOT NULL,
        `status` text DEFAULT 'active' NOT NULL,
        `inc_todos` integer DEFAULT 0 NOT NULL,
        `inc_trash` integer DEFAULT 0 NOT NULL,
        `inc_settings` integer DEFAULT 0 NOT NULL,
        `total_todos` integer DEFAULT 0 NOT NULL,
        `total_templates` integer DEFAULT 0 NOT NULL,
        `todos_cursor` text DEFAULT '' NOT NULL,
        `templates_cursor` text DEFAULT '' NOT NULL,
        `created_at` integer NOT NULL,
        `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `import_sessions` (
        `id` text PRIMARY KEY NOT NULL,
        `mode` text NOT NULL,
        `status` text DEFAULT 'active' NOT NULL,
        `started_at` integer NOT NULL,
        `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `login_attempts` (
        `ip` text PRIMARY KEY NOT NULL,
        `attempts` integer DEFAULT 0 NOT NULL,
        `lock_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings` (
        `key` text PRIMARY KEY NOT NULL,
        `value` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `todo_templates` (
        `parent_id` text PRIMARY KEY NOT NULL,
        `text` text,
        `time` text,
        `priority` text,
        `desc` text,
        `url` text,
        `copy_text` text,
        `subtasks` text,
        `search_terms` text,
        `type` text DEFAULT 'recurring' NOT NULL,
        `end_time` text DEFAULT '',
        `anchor_date` text DEFAULT '' NOT NULL,
        `exdates` text DEFAULT '[]',
        `category_id` text DEFAULT '',
        `time_records` text DEFAULT '[]' NOT NULL,
        `rrule` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_templates_type` ON `todo_templates` (`type`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `todos` (
        `id` text PRIMARY KEY NOT NULL,
        `parent_id` text NOT NULL,
        `date` text NOT NULL,
        `text` text NOT NULL,
        `time` text,
        `priority` text,
        `desc` text,
        `url` text,
        `copy_text` text,
        `subtasks` text,
        `search_terms` text,
        `done` integer DEFAULT 0 NOT NULL,
        `deleted` integer DEFAULT 0 NOT NULL,
        `type` text DEFAULT 'none' NOT NULL,
        `end_time` text DEFAULT '',
        `category_id` text DEFAULT '',
        `time_records` text DEFAULT '[]' NOT NULL,
        `fragment_anchor` text DEFAULT '' NOT NULL,
        `rrule` text DEFAULT '' NOT NULL,
        `anchor_date` text DEFAULT '' NOT NULL,
        `exdates` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_todos_cursor` ON `todos` (`date`,`deleted`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_todos_parent_date_del` ON `todos` (`parent_id`,`date`,`deleted`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_todos_stats` ON `todos` (`date`,`deleted`,`priority`,`done`,`category_id`,`time`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_todos_type` ON `todos` (`type`);--> statement-breakpoint
-- 写入 db_schema_version 行，作为运行时 schema 版本校验的依据。
-- 值与 version.json 的 db_schema 字段绑定（当前为 1）。
-- worker.ts 启动时读此行与 version.json DB_SCHEMA 比对，不一致返回 503。
-- 后续迁移（0002+）应在 SQL 里 UPDATE 此行为新版本号，同时 bump version.json db_schema。
INSERT OR IGNORE INTO `settings` (`key`, `value`) VALUES ('db_schema_version', '1');
