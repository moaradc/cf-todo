-- cf-todo baseline 迁移：7 张表 + 5 个索引
-- 与 src/api.js initDb() 字节级对齐（CREATE TABLE IF NOT EXISTS 语义保留）。
-- 这是唯一一份 baseline：用于在已跑过旧 initDb() 的生产 D1 上平滑接管——
--   IF NOT EXISTS 让已存在的表被跳过，新部署的 D1 直接建表。
-- 后续 0001+ 迁移不再用 IF NOT EXISTS，回归 drizzle 默认风格。
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
CREATE INDEX IF NOT EXISTS `idx_todos_type` ON `todos` (`type`);
