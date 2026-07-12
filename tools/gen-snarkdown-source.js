/** 构建前预处理：读 snarkdown ES module 源码，生成可内联到前端 <script> 的字符串模块。npm run build 自动调用。 */
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const source = readFileSync(join(__dirname, '../node_modules/snarkdown/dist/snarkdown.es.js'), 'utf-8');
// minified 源码里函数名是 t，含 1 个定义 + 2 个递归调用，全部改成 snarkdown
const transformed = source
  .replace(/export default function t\(/, 'function snarkdown(')
  .replace(/s=t\(/g, 's=snarkdown(')
  .replace(/\+t\(g\[12\]/g, '+snarkdown(g[12]');

writeFileSync(
  join(__dirname, '../src/html/snarkdown-source.js'),
  `// 自动生成，勿手改。由 tools/gen-snarkdown-source.js 从 snarkdown npm 包生成\nexport const snarkdownSource = ${JSON.stringify(transformed)};\n`,
);
