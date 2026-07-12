/**
 * Post-build script: ensure Durable Object classes are exported from the bundle.
 *
 * Problem: esbuild tree-shakes `export { ReminderDO }` because the class is
 * only referenced by the Cloudflare runtime (not by any code in the bundle).
 * Even with --tree-shaking=false, esbuild removes the named export.
 *
 * Solution: after esbuild finishes, parse the bundle and append the missing
 * export statement. The class IS in the bundle (just not exported), so we
 * just need to add `export { ReminderDO }` to the final export list.
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.join(__dirname, '..', 'dist', 'worker.mjs');
const DO_CLASSES = ['ReminderDO'];

function fixExports() {
  if (!fs.existsSync(BUNDLE_PATH)) {
    console.error('[fix-do-exports] bundle not found:', BUNDLE_PATH);
    process.exit(1);
  }

  let content = fs.readFileSync(BUNDLE_PATH, 'utf8');
  let modified = false;

  for (const className of DO_CLASSES) {
    // Check if the class is defined in the bundle
    const classDefRegex = new RegExp(`\\b(var|let|const)\\s+${className}\\s*=\\s*(class|function)`);
    if (!classDefRegex.test(content)) {
      console.warn(`[fix-do-exports] ${className} not found in bundle, skipping`);
      continue;
    }

    // Check if it's already exported
    const exportRegex = new RegExp(`export\\s*\\{[^}]*\\b${className}\\b[^}]*\\}`);
    if (exportRegex.test(content)) {
      console.log(`[fix-do-exports] ${className} already exported, skipping`);
      continue;
    }

    // Find the final `export { worker_default as default };` and add the DO class
    // The bundle ends with: `export { worker_default as default };`
    // We change it to: `export { worker_default as default, ReminderDO };`
    const defaultExportRegex = /export\s*\{\s*worker_default\s+as\s+default\s*\}\s*;?\s*$/;
    if (defaultExportRegex.test(content)) {
      content = content.replace(
        defaultExportRegex,
        `export {\n  worker_default as default,\n  ${className}\n};\n`,
      );
      modified = true;
      console.log(`[fix-do-exports] added ${className} to export list`);
    } else {
      // Fallback: append a separate export statement at the end
      content += `\nexport { ${className} };\n`;
      modified = true;
      console.log(`[fix-do-exports] appended export { ${className} }`);
    }
  }

  if (modified) {
    fs.writeFileSync(BUNDLE_PATH, content);
    console.log('[fix-do-exports] bundle updated');
  } else {
    console.log('[fix-do-exports] no changes needed');
  }
}

fixExports();
