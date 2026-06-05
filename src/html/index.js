import { APP_VERSION } from "../utils.js";
import { css } from "./css.js";
import { getBody } from "./body.js";
import { core } from "./js/core.js";
import { todos } from "./js/todos.js";
import { settings } from "./js/settings.js";
import { io } from "./js/io.js";
import { stats } from "./js/stats.js";
import { trash } from "./js/trash.js";
import { categories } from "./js/categories.js";
import { detail } from "./js/detail.js";
import { calendar } from "./js/calendar.js";
import { bootstrap } from "./js/bootstrap.js";

const safeForScriptTag = (s) => JSON.stringify(s || '').replace(/<\//g, '<\\/');

function renderHTML(isAuthorized, customHeader, customContent) {
  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MOARA 待办事项</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
${css}
  </style>
  <script>/*CUSTOM_HEADER_PLACEHOLDER*/</script>
</head>
${getBody(isAuthorized)}
  <script>/*CUSTOM_GLOBALS_PLACEHOLDER*/</script>
  <script>
  (function() {
    'use strict';

${core}

${todos}

${settings}

${io}

${stats}

${trash}

${categories}

${detail}

${calendar}

${bootstrap}

  })();
  </script>
  <script>/*CUSTOM_CONTENT_PLACEHOLDER*/</script>
</body>
</html>
  `;

  html = html.replaceAll('${APP_VERSION}', APP_VERSION);

  html = html.replace(
    '<script>/*CUSTOM_HEADER_PLACEHOLDER*/</script>',
    customHeader || ''
  );
  html = html.replace(
    '<script>/*CUSTOM_GLOBALS_PLACEHOLDER*/</script>',
    `<script>window.__CUSTOM_HEADER__=${safeForScriptTag(customHeader)};window.__CUSTOM_CONTENT__=${safeForScriptTag(customContent)};</script>`
  );
  html = html.replace(
    '<script>/*CUSTOM_CONTENT_PLACEHOLDER*/</script>',
    customContent || ''
  );

  return html;
}

export { renderHTML };
