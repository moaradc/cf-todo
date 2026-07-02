-- cf-todo 0001: per-date unique constraint for recurring expansion
--
-- 修复审计 §9d 的跨 isolate 竞态：重复展开会撞 UNIQUE 失败而非插入重复行。
-- partial unique index：仅约束 deleted=0 的行（允许同 parent_id 多次软删）。
-- expansion 改用 INSERT OR IGNORE（见 GET /api/todos 迁移）。
--
-- 这个改动修复了一个真实的竞态 bug，但行为对用户透明
-- （之前靠 per-date lock 兜底，现在 DB 层也兜底）。
CREATE UNIQUE INDEX IF NOT EXISTS `uq_todos_parent_date_deleted`
  ON `todos` (`parent_id`, `date`, `deleted`)
  WHERE `deleted` = 0;
