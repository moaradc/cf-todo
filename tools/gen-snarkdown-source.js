// 构建前预处理：读取 snarkdown ES module 源码，生成可 import 的字符串模块
// 用法: node tools/gen-snarkdown-source.js
// 在 npm run build 之前自动运行（已配置在 package.json 的 build 脚本里）
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const source = readFileSync(join(__dirname, '../node_modules/snarkdown/dist/snarkdown.es.js'), 'utf-8');
// 去掉 export default，函数名 t 改成 snarkdown
// 源码里 t 出现在 3 处：1 个定义 + 2 个递归调用（s=t(...), t(g[12]...)）
const transformed = source
  .replace(/export default function t\(/, 'function snarkdown(')
  .replace(/s=t\(/g, 's=snarkdown(')
  .replace(/\+t\(g\[12\]/g, '+snarkdown(g[12]');
// 导出为字符串（JSON.stringify 保证安全转义）
const output = `// 自动生成，勿手改。由 tools/gen-snarkdown-source.js 从 snarkdown npm 包生成
export const snarkdownSource = ${JSON.stringify(transformed)};
`;

writeFileSync(join(__dirname, '../src/html/snarkdown-source.js'), output);
console.log('Generated src/html/snarkdown-source.js (' + output.length + ' bytes)');
