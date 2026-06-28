/**
 * V0 trash 自动分页逻辑本地验证
 * 模拟 DB.prepare 返回不同条数，验证自动分页拉取全部
 */

// 模拟 DB
function createMockDB(totalItems) {
  return {
    prepare(sql) {
      return {
        async all() {
          // 解析 SQL 里的 LIMIT 和 OFFSET
          const limitMatch = sql.match(/LIMIT (\?|\d+)/);
          const offsetMatch = sql.match(/OFFSET (\?|\d+)/);
          // 这个简化模拟只处理 bind(limit, offset) 的情况
          return { results: [] };
        },
        bind(...args) {
          const [limit, offset] = args;
          return {
            async all() {
              const results = [];
              for (let i = 0; i < limit; i++) {
                const idx = offset + i;
                if (idx >= totalItems) break;
                results.push({ id: `trash-${idx}`, date: `2026-06-${String(idx % 30 + 1).padStart(2,'0')}`, text: `item ${idx}`, deleted: 1 });
              }
              return { results };
            }
          };
        }
      };
    }
  };
}

// 复刻 V0 trash 自动分页逻辑
async function v0TrashAutoPagination(env) {
  const TRASH_MAX_ITEMS = 1000;
  const TRASH_CHUNK_SIZE = 100;
  const allResults = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore && allResults.length < TRASH_MAX_ITEMS) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM todos WHERE deleted = 1 ORDER BY date DESC LIMIT ? OFFSET ?'
    ).bind(TRASH_CHUNK_SIZE, offset).all();
    if (results && results.length > 0) {
      allResults.push(...results);
      offset += results.length;
      if (results.length < TRASH_CHUNK_SIZE) hasMore = false;
    } else {
      hasMore = false;
    }
  }
  return allResults;
}

let pass = 0, fail = 0;
function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`    ${detail}`); }

console.log('='.repeat(60));
console.log('V0 trash 自动分页逻辑验证');
console.log('='.repeat(60));

// 测试 1: 空回收站
console.log('\n[1] 空回收站 (0 条)');
const db1 = createMockDB(0);
const r1 = await v0TrashAutoPagination({ DB: db1 });
if (r1.length === 0) ok('返回 0 条');
else ko(`期望 0，实际 ${r1.length}`);

// 测试 2: 少于 100 条（单页）
console.log('\n[2] 少于 100 条 (50 条)');
const db2 = createMockDB(50);
const r2 = await v0TrashAutoPagination({ DB: db2 });
if (r2.length === 50) ok('返回 50 条');
else ko(`期望 50，实际 ${r2.length}`);

// 测试 3: 正好 100 条（单页满）
console.log('\n[3] 正好 100 条');
const db3 = createMockDB(100);
const r3 = await v0TrashAutoPagination({ DB: db3 });
if (r3.length === 100) ok('返回 100 条');
else ko(`期望 100，实际 ${r3.length}`);

// 测试 4: 超过 100 条（多页，250 条）
console.log('\n[4] 超过 100 条 (250 条，应分 3 页)');
const db4 = createMockDB(250);
const r4 = await v0TrashAutoPagination({ DB: db4 });
if (r4.length === 250) ok('返回 250 条（自动分页拉全部）');
else ko(`期望 250，实际 ${r4.length}`);

// 测试 5: 超过 1000 条（上限保护）
console.log('\n[5] 超过 1000 条 (1500 条，应截断为 1000)');
const db5 = createMockDB(1500);
const r5 = await v0TrashAutoPagination({ DB: db5 });
if (r5.length === 1000) ok('返回 1000 条（上限保护）');
else ko(`期望 1000，实际 ${r5.length}`);

// 测试 6: 数据完整性（检查 ID 连续）
console.log('\n[6] 数据完整性 (250 条，检查 ID)');
const db6 = createMockDB(250);
const r6 = await v0TrashAutoPagination({ DB: db6 });
const ids = r6.map(x => x.id);
const allPresent = ids.every((id, i) => id === `trash-${i}`);
if (allPresent) ok('ID 0-249 全部存在且有序');
else ko('ID 不完整或无序', `前 5: ${ids.slice(0,5).join(',')}, 后 5: ${ids.slice(-5).join(',')}`);

console.log('\n' + '='.repeat(60));
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log('='.repeat(60));
process.exit(fail > 0 ? 1 : 0);
