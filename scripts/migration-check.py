#!/usr/bin/env python3
"""
cf-todo 迁移完整性校验脚本。

drizzle-kit check 只校验 snapshot 之间的 diff 与 .sql 是否匹配，
但不校验文件存在性（如手写迁移漏 snapshot 文件不会被检测到）。
本脚本补充检查：
  1. 每个 journal entry 的 tag 对应的 .sql 文件存在
  2. 每个 journal entry 的 tag 对应的 _snapshot.json 文件存在
  3. .sql 文件名与 journal tag 一一对应（无孤儿文件）
  4. version.json db_schema 与 baseline 写入的 db_schema_version 一致

退出码：0 = 通过，1 = 失败。
用于 CI（deploy.yml）和本地 npm run db:check:full。
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRIZZLE_DIR = os.path.join(ROOT, 'drizzle')
META_DIR = os.path.join(DRIZZLE_DIR, 'meta')
JOURNAL_PATH = os.path.join(META_DIR, '_journal.json')
VERSION_JSON = os.path.join(ROOT, 'version.json')
BASELINE_SQL = os.path.join(DRIZZLE_DIR, '0000_baseline.sql')

errors = []
warnings = []


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def check_files_exist():
    """检查 journal 里每个 entry 的 .sql 和 _snapshot.json 都存在。"""
    journal = load_json(JOURNAL_PATH)
    entries = journal.get('entries', [])
    if not entries:
        errors.append('_journal.json 没有 entries')
        return

    for entry in entries:
        tag = entry.get('tag', '')
        idx = entry.get('idx')
        if not tag:
            errors.append(f'journal entry idx={idx} 缺少 tag 字段')
            continue

        # .sql 文件（用 tag 命名，如 0000_baseline.sql）
        sql_path = os.path.join(DRIZZLE_DIR, f'{tag}.sql')
        if not os.path.exists(sql_path):
            errors.append(f'journal entry idx={idx} tag={tag} 对应的 .sql 文件不存在: {sql_path}')

        # _snapshot.json 文件（用 idx 命名，如 0000_snapshot.json）
        snapshot_path = os.path.join(META_DIR, f'{idx:04d}_snapshot.json')
        if not os.path.exists(snapshot_path):
            errors.append(f'journal entry idx={idx} tag={tag} 对应的 snapshot 文件不存在: {snapshot_path}')


def check_no_orphan_files():
    """检查 drizzle/ 下没有孤儿 .sql 文件（不在 journal 里的）。"""
    journal = load_json(JOURNAL_PATH)
    tags = {e.get('tag') for e in journal.get('entries', [])}

    for fname in os.listdir(DRIZZLE_DIR):
        if not fname.endswith('.sql'):
            continue
        tag = fname[:-4]  # 去掉 .sql
        if tag not in tags:
            errors.append(f'孤儿 .sql 文件（不在 journal 里）: {fname}')


def check_version_consistency():
    """检查 version.json db_schema 与 baseline SQL 写入的 db_schema_version 一致。"""
    if not os.path.exists(VERSION_JSON):
        errors.append('version.json 不存在')
        return
    version_data = load_json(VERSION_JSON)
    expected = version_data.get('db_schema')
    if expected is None:
        errors.append('version.json 缺少 db_schema 字段')
        return

    if not os.path.exists(BASELINE_SQL):
        errors.append('0000_baseline.sql 不存在')
        return

    with open(BASELINE_SQL, 'r', encoding='utf-8') as f:
        baseline_content = f.read()
    # 匹配 INSERT OR IGNORE INTO settings ... 'db_schema_version', 'N'
    m = re.search(r"db_schema_version['\"]\s*,\s*['\"](\d+)['\"]", baseline_content)
    if not m:
        errors.append('0000_baseline.sql 里找不到 db_schema_version 的 INSERT 语句')
        return
    baseline_version = int(m.group(1))

    if baseline_version != expected:
        errors.append(
            f'version.json db_schema={expected} 与 0000_baseline.sql 写入的 '
            f'db_schema_version={baseline_version} 不一致'
        )


def main():
    print('cf-todo 迁移完整性校验...')
    print(f'  drizzle 目录: {DRIZZLE_DIR}')
    print()

    check_files_exist()
    check_no_orphan_files()
    check_version_consistency()

    if warnings:
        print('⚠️  警告:')
        for w in warnings:
            print(f'   - {w}')
        print()

    if errors:
        print('❌ 校验失败:')
        for e in errors:
            print(f'   - {e}')
        print()
        print('修复建议:')
        print('  - 缺 snapshot: 运行 npx drizzle-kit generate 补生成，或手动复制上一个 snapshot')
        print('  - 孤儿 .sql: 删除或加入 _journal.json')
        print('  - 版本不一致: 检查 version.json db_schema 与 baseline SQL 的 INSERT 值')
        sys.exit(1)

    print('✅ 校验通过: journal/snapshot/.sql 文件一一对应，version.json 与 baseline 一致')
    sys.exit(0)


if __name__ == '__main__':
    main()
