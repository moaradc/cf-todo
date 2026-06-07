export const io = `
    async function exportData() {
      var incTodos = document.getElementById('export-todos').checked;
      var incTrash = document.getElementById('export-trash').checked;
      var incSettings = document.getElementById('export-settings').checked;
      var incCategories = document.getElementById('export-categories').checked;
      var useChunked = document.getElementById('chunked-mode').checked;

      if (!incTodos && !incTrash && !incSettings && !incCategories) return alert('请至少选择一项需要导出的内容。');

      var overlay = document.createElement('div');
      overlay.className = 'io-overlay';
      var box = document.createElement('div');
      box.className = 'io-dialog';
      var titleEl = document.createElement('div');
      titleEl.className = 'io-title';
      var subEl = document.createElement('div');
      subEl.className = 'io-sub';
      var barBg = document.createElement('div');
      barBg.className = 'io-bar-bg';
      var barFill = document.createElement('div');
      barFill.className = 'io-bar-fill';
      barBg.appendChild(barFill); box.appendChild(titleEl); box.appendChild(subEl); box.appendChild(barBg);
      overlay.appendChild(box); document.body.appendChild(overlay);

      var spinChars = ['\\u28FE','\\u28F7','\\u28EF','\\u28DF','\\u287F','\\u28BF','\\u28FB','\\u28FD'];
      var spinIdx = 0; var curTitle = ''; var targetPct = 0; var curPct = 0;
      var spinTimer = setInterval(function() { spinIdx = (spinIdx+1)%8; titleEl.textContent = spinChars[spinIdx]+' '+curTitle; if(curPct<targetPct){curPct=targetPct>=100?targetPct:curPct+Math.max(1,Math.round((targetPct-curPct)*0.1));if(curPct>targetPct)curPct=targetPct;barFill.style.width=Math.min(curPct,100)+'%';} }, 80);
      function showProgress(t,s,p) { curTitle=t; subEl.textContent=s||''; if(p!==undefined) targetPct=Math.min(Math.max(p,0),100); }
      function closeProgress() { clearInterval(spinTimer); if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }
      function showAlert(msg) {
        return new Promise(function(resolve) {
          var ao=document.createElement('div'); ao.className='io-overlay';
          var ab=document.createElement('div'); ab.className='io-dialog';
          var am=document.createElement('div'); am.className='io-msg'; am.textContent=msg;
          var bo=document.createElement('button'); bo.className='io-btn io-btn-primary'; bo.textContent='确定';
          ab.appendChild(am); ab.appendChild(bo); ao.appendChild(ab); document.body.appendChild(ao);
          bo.onclick=function(){ if(ao.parentNode) ao.parentNode.removeChild(ao); resolve(); };
        });
      }
      function showConfirm(title, msg, btnYesLabel, btnNoLabel) {
        return new Promise(function(resolve) {
          var co=document.createElement('div'); co.className='io-overlay';
          var cb=document.createElement('div'); cb.className='io-dialog';
          var ct=document.createElement('div'); ct.className='io-title'; ct.textContent=title;
          var cm=document.createElement('div'); cm.className='io-sub'; cm.textContent=msg;
          var br=document.createElement('div'); br.className='io-btn-row';
          var by=document.createElement('button'); by.className='io-btn io-btn-primary'; by.textContent=btnYesLabel||'确定';
          var bn=document.createElement('button'); bn.className='io-btn io-btn-secondary'; bn.textContent=btnNoLabel||'取消';
          br.appendChild(bn); br.appendChild(by); cb.appendChild(ct); cb.appendChild(cm); cb.appendChild(br); co.appendChild(cb); document.body.appendChild(co);
          by.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(true); };
          bn.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(false); };
        });
      }

      var sessionId = crypto.randomUUID();

      try {
        showProgress('初始化导出会话', '创建会话...', 8);
        var sessionRes = await fetch('/api/export?mode=session&action=create&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&categories=' + incCategories + '&sessionId=' + sessionId);
        if (!sessionRes.ok) {
          if (sessionRes.status === 409) {
            var conflictData = {};
            try { conflictData = await sessionRes.json(); } catch(ee) {}
            var doAbortExport = await showConfirm("导出会话冲突", '检测到未完成的导出会话 (' + (conflictData.sessionId || '') + ')。\\n可能是上次导出异常中断导致。\\n点击「确定」中止旧会话并重新导出。\\n点击「清理」仅清除旧会话。', "确定", "清理");
            if (doAbortExport) {
              if (conflictData.sessionId) {
                await fetch('/api/export?mode=session&action=abort&sessionId=' + conflictData.sessionId);
              }
              sessionRes = await fetch('/api/export?mode=session&action=create&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&categories=' + incCategories + '&sessionId=' + sessionId);
              if (!sessionRes.ok) throw new Error('重试创建导出会话失败');
            } else {
              if (conflictData.sessionId) {
                await fetch('/api/export?mode=session&action=abort&sessionId=' + conflictData.sessionId);
              }
              closeProgress();
              return;
            }
          } else {
            throw new Error('创建导出会话失败');
          }
        }
        var sessionData = await sessionRes.json();
        if (!sessionData.hasData) {
          try { await fetch('/api/export?mode=session&action=abort&sessionId=' + sessionId); } catch(e) {}
          closeProgress(); await showAlert('没有可导出的数据。'); return;
        }

        showProgress('准备导出', '开始下载...', 15);

        var exportStrategy = null;
        var writableStream = null;
        var fileHandle = null;
        var opfsFileHandle = null;
        var opfsRoot = null;
        var now = new Date();
        var fileName = 'todo_export_' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + '-' + String(now.getHours()).padStart(2,'0') + '-' + String(now.getMinutes()).padStart(2,'0') + '-' + String(now.getSeconds()).padStart(2,'0') + '.json';

        var EXPORT_STRATEGIES = [
          'fileSystemAPI',
          'opfs',
          'memoryBlob'
        ];

        for (var si = 0; si < EXPORT_STRATEGIES.length; si++) {
          var strategy = EXPORT_STRATEGIES[si];

          if (strategy === 'fileSystemAPI') {
            if (!window.showSaveFilePicker) continue;
            try {
              fileHandle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
              });
              writableStream = await fileHandle.createWritable();
              exportStrategy = 'fileSystemAPI';
              break;
            } catch (pickErr) {
              if (pickErr.name === 'AbortError') {
                try { await fetch('/api/export?mode=session&action=abort&sessionId=' + sessionId); } catch(e) {}
                closeProgress(); return;
              }
              fileHandle = null; writableStream = null;
            }
          }

          if (strategy === 'opfs') {
            if (!(navigator.storage && navigator.storage.getDirectory)) continue;
            try {
              opfsRoot = await navigator.storage.getDirectory();
              opfsFileHandle = await opfsRoot.getFileHandle(fileName, { create: true });
              writableStream = await opfsFileHandle.createWritable();
              exportStrategy = 'opfs';
              break;
            } catch (opfsErr) {
              opfsRoot = null; opfsFileHandle = null; writableStream = null;
            }
          }

          if (strategy === 'memoryBlob') {
            exportStrategy = 'memoryBlob';
            break;
          }
        }

        var useStreamWrite = exportStrategy === 'fileSystemAPI' || exportStrategy === 'opfs';
        var chunks = [];
        var encoder = new TextEncoder();
        var writeQueue = Promise.resolve();
        function writeLine(line) {
          var bytes = encoder.encode(line + '\\n');
          if (useStreamWrite) {
            writeQueue = writeQueue.then(function() { return writableStream.write(bytes); });
          } else {
            chunks.push(bytes);
          }
        }

        if (useChunked) {
          writeLine('ndjson');

          if (incSettings) {
            showProgress('分片导出', '获取设置...', 25);
            var settingsRes = await fetch('/api/settings');
            if (settingsRes.ok) {
              var settingsObj = await settingsRes.json();
              writeLine(JSON.stringify({ _type: 'settings', data: settingsObj }));
            }
            var headerRes = await fetch('/api/custom-header');
            if (headerRes.ok) {
              var headerVal = await headerRes.text();
              writeLine(JSON.stringify({ _type: 'custom_header', data: headerVal }));
            }
            var contentRes = await fetch('/api/custom-content');
            if (contentRes.ok) {
              var contentVal = await contentRes.text();
              writeLine(JSON.stringify({ _type: 'custom_content', data: contentVal }));
            }
            var colorsRes = await fetch('/api/custom-colors');
            if (colorsRes.ok) {
              var colorsVal = await colorsRes.json();
              writeLine(JSON.stringify({ _type: 'customColors', data: colorsVal }));
            }
          }

          if (incCategories) {
            showProgress('分片导出', '获取分类...', 30);
            var catRes = await fetch('/api/categories');
            if (catRes.ok) {
              var catData = await catRes.json();
              writeLine(JSON.stringify({ _type: 'categories', data: catData }));
            }
          }

          if (incTodos || incTrash) {
            var hasTemplates = incTodos;
            var todosCursor = '';
            var todosPage = 0;
            var todosPct = 35;
            var isFinalTodo = !hasTemplates;
            var todosBaseUrl = '/api/export?mode=page&type=todos&todos=' + incTodos + '&trash=' + incTrash + '&sessionId=' + (isFinalTodo ? sessionId : '') + (isFinalTodo ? '&final=true' : '');
            var pagePromise = fetch(todosBaseUrl + '&cursor=').then(function(r) { if (!r.ok) throw new Error('分页获取待办失败'); return r.text(); });
            while (true) {
              var pageText = await pagePromise;
              var pageLines = pageText.split('\\n').filter(function(l) { return l.trim(); });
              var pageInfo = null;
              for (var li = 0; li < pageLines.length; li++) {
                if (pageLines[li].trim() === 'ndjson') continue;
                try {
                  var parsed = JSON.parse(pageLines[li]);
                  if (parsed._type === 'page_info') { pageInfo = parsed; continue; }
                } catch(e) {}
                writeLine(pageLines[li]);
              }
              if (pageInfo && pageInfo.hasMore) {
                pagePromise = fetch(todosBaseUrl + '&cursor=' + encodeURIComponent(pageInfo.cursor)).then(function(r) { if (!r.ok) throw new Error('分页获取待办失败'); return r.text(); });
              }
              if (!pageInfo || !pageInfo.hasMore) break;
              todosCursor = pageInfo.cursor;
              todosPage++;
              todosPct += ((hasTemplates ? 55 : 60) - todosPct) * 0.15;
              showProgress('分片导出', '获取待办第 ' + todosPage + ' 页...', Math.round(todosPct));
              if (todosPage % 5 === 0) {
                await fetch('/api/export?mode=session&action=update&sessionId=' + sessionId + '&todosCursor=' + encodeURIComponent(todosCursor));
              }
            }

            if (hasTemplates) {
              var tplCursor = '';
              var tplPage = 0;
              var tplPct = Math.round(todosPct) + 5;
              var tplBaseUrl = '/api/export?mode=page&type=templates&todos=true&trash=false&sessionId=' + sessionId + '&final=true';
              var tplPromise = fetch(tplBaseUrl + '&cursor=').then(function(r) { if (!r.ok) throw new Error('分页获取模板失败'); return r.text(); });
              while (true) {
                var tplText = await tplPromise;
                var tplLines = tplText.split('\\n').filter(function(l) { return l.trim(); });
                var tplPageInfo = null;
                for (var tli = 0; tli < tplLines.length; tli++) {
                  if (tplLines[tli].trim() === 'ndjson') continue;
                  try {
                    var tplParsed = JSON.parse(tplLines[tli]);
                    if (tplParsed._type === 'page_info') { tplPageInfo = tplParsed; continue; }
                  } catch(e) {}
                  writeLine(tplLines[tli]);
                }
                if (tplPageInfo && tplPageInfo.hasMore) {
                  tplPromise = fetch(tplBaseUrl + '&cursor=' + encodeURIComponent(tplPageInfo.cursor)).then(function(r) { if (!r.ok) throw new Error('分页获取模板失败'); return r.text(); });
                }
                if (!tplPageInfo || !tplPageInfo.hasMore) break;
                tplCursor = tplPageInfo.cursor;
                tplPage++;
                tplPct += (90 - tplPct) * 0.15;
                showProgress('分片导出', '获取模板第 ' + tplPage + ' 页...', Math.round(tplPct));
                if (tplPage % 5 === 0) {
                  await fetch('/api/export?mode=session&action=update&sessionId=' + sessionId + '&templatesCursor=' + encodeURIComponent(tplCursor));
                }
              }
            }
          } else {
            try { await fetch('/api/export?mode=session&action=done&sessionId=' + sessionId); } catch(e) {}
          }

          if (useStreamWrite) {
            await writeQueue;
            await writableStream.close();
            if (exportStrategy === 'opfs') {
              showProgress('生成文件', '准备下载...', 96);
              var opfsFile = await opfsFileHandle.getFile();
              var opfsUrl = URL.createObjectURL(opfsFile);
              var a = document.createElement('a');
              a.href = opfsUrl; a.download = fileName;
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              setTimeout(function() {
                URL.revokeObjectURL(opfsUrl);
                try { opfsRoot.removeEntry(fileName); } catch(e) {}
              }, 30000);
            }
          } else {
            showProgress('生成文件', '组装下载文件...', 96);
            var blob = new Blob(chunks, { type: 'application/json' });
            var blobUrl = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = blobUrl; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 30000);
            chunks = null;
          }

          showProgress('导出完成', '文件已保存', 100);
          try { await fetch('/api/export?mode=session&action=done&sessionId=' + sessionId); } catch(e) {}
          setTimeout(closeProgress, 2000);
        } else {
          if (exportStrategy === 'opfs') {
            showProgress('OPFS 导出', '初始化缓存写入...', 15);
          } else if (exportStrategy === 'fileSystemAPI') {
            showProgress('File System API 导出', '初始化流式写入...', 15);
          } else {
            showProgress('内存导出', '大数据量时可能较慢，建议使用 Chrome/Edge 浏览器', 15);
          }
          var streamBaseUrl = '/api/export?mode=stream&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&categories=' + incCategories + '&sessionId=' + sessionId;
          var streamTodosCursor = '';
          var streamTemplatesCursor = '';
          var streamSkipHeader = false;
          var streamBytes = 0;
          var streamPct = 15;
          var continuationRound = 0;
          var streamLabel = exportStrategy === 'fileSystemAPI' ? 'File System API' : (exportStrategy === 'opfs' ? 'OPFS' : '内存');
          var streamSubLabel = exportStrategy === 'fileSystemAPI' ? '已写入' : (exportStrategy === 'opfs' ? '已缓存' : '已读取');

          while (true) {
            var extraParams = '';
            if (streamTodosCursor) extraParams += '&todosCursor=' + encodeURIComponent(streamTodosCursor);
            if (streamTemplatesCursor) extraParams += '&templatesCursor=' + encodeURIComponent(streamTemplatesCursor);
            if (streamSkipHeader) extraParams += '&skipHeader=true';
            var streamUrl = streamBaseUrl + extraParams;
            var res = await fetch(streamUrl);
            if (!res.ok) throw new Error('流式导出请求失败');

            var reader = res.body.getReader();
            var decoder = new TextDecoder();
            var lineBuffer = '';
            var continuationInfo = null;

            while (true) {
              var _ref = await reader.read();
              var done = _ref.done;
              var value = _ref.value;
              if (done) break;

              var text = decoder.decode(value, { stream: true });
              lineBuffer += text;
              var lines = lineBuffer.split('\\n');
              lineBuffer = lines.pop();

              var pendingLines = [];
              for (var li = 0; li < lines.length; li++) {
                var line = lines[li];
                if (!line.trim()) continue;

                var isContinuation = false;
                try {
                  var parsed = JSON.parse(line);
                  if (parsed._type === 'continuation') {
                    continuationInfo = parsed;
                    isContinuation = true;
                  }
                } catch(e) {}

                if (isContinuation) continue;

                if (useStreamWrite) {
                  var lineBytes = encoder.encode(line + '\\n');
                  await writableStream.write(lineBytes);
                  streamBytes += lineBytes.byteLength;
                } else {
                  pendingLines.push(line + '\\n');
                  if (pendingLines.length >= 64) {
                    var batchBytes = encoder.encode(pendingLines.join(''));
                    chunks.push(batchBytes);
                    streamBytes += batchBytes.byteLength;
                    pendingLines = [];
                  }
                }
              }
              if (!useStreamWrite && pendingLines.length > 0) {
                var batchBytes = encoder.encode(pendingLines.join(''));
                chunks.push(batchBytes);
                streamBytes += batchBytes.byteLength;
              }
              streamPct += (90 - streamPct) * 0.03;
              showProgress(streamLabel, streamSubLabel + ' ' + (streamBytes / 1024 / 1024).toFixed(1) + ' MB', Math.round(streamPct));
            }

            if (lineBuffer.trim()) {
              var isLastContinuation = false;
              try {
                var lastParsed = JSON.parse(lineBuffer.trim());
                if (lastParsed._type === 'continuation') {
                  continuationInfo = lastParsed;
                  isLastContinuation = true;
                }
              } catch(e) {}

              if (!isLastContinuation) {
                var lastLineBytes = encoder.encode(lineBuffer.trim() + '\\n');
                if (useStreamWrite) {
                  await writableStream.write(lastLineBytes);
                } else {
                  chunks.push(lastLineBytes);
                }
                streamBytes += lastLineBytes.byteLength;
              }
            }

            if (continuationInfo) {
              continuationRound++;
              streamTodosCursor = continuationInfo.todosCursor || '';
              streamTemplatesCursor = continuationInfo.templatesCursor || '';
              streamSkipHeader = true;
              showProgress(streamLabel, '续传第 ' + continuationRound + ' 轮...', Math.round(streamPct));
            } else {
              break;
            }
          }

          if (useStreamWrite) {
            await writableStream.close();
            if (exportStrategy === 'opfs') {
              showProgress('生成文件', '准备下载...', 96);
              var opfsFile = await opfsFileHandle.getFile();
              var opfsUrl = URL.createObjectURL(opfsFile);
              var a = document.createElement('a');
              a.href = opfsUrl; a.download = fileName;
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              setTimeout(function() {
                URL.revokeObjectURL(opfsUrl);
                try { opfsRoot.removeEntry(fileName); } catch(e) {}
              }, 30000);
            }
          } else {
            showProgress('生成文件', '组装下载文件...', 96);
            var blob = new Blob(chunks, { type: 'application/json' });
            var blobUrl = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = blobUrl; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 30000);
            chunks = null;
          }

          try {
            await fetch('/api/export?mode=session&action=done&sessionId=' + sessionId);
          } catch(e) {}

          showProgress('导出完成', '文件已保存', 100);
          setTimeout(closeProgress, 2000);
        }
      } catch (e) {
        if (writableStream) {
          try { await writableStream.abort(); } catch(we) {}
        }
        if (opfsRoot && fileName) {
          try { opfsRoot.removeEntry(fileName); } catch(re) {}
        }
        closeProgress();
        await showAlert('导出失败：' + e.message);
      }
    }

    function importData(event) {
      var file = event.target.files[0];
      if (!file) return;

      var importId = crypto.randomUUID();

      var overlay = document.createElement('div');
      overlay.className = 'io-overlay';
      var box = document.createElement('div');
      box.className = 'io-dialog';
      var titleEl = document.createElement('div');
      titleEl.className = 'io-title';
      var subEl = document.createElement('div');
      subEl.className = 'io-sub';
      var barBg = document.createElement('div');
      barBg.className = 'io-bar-bg';
      var barFill = document.createElement('div');
      barFill.className = 'io-bar-fill';
      barBg.appendChild(barFill); box.appendChild(titleEl); box.appendChild(subEl); box.appendChild(barBg);
      overlay.appendChild(box); document.body.appendChild(overlay);

      var spinChars = ['\\u28FE','\\u28F7','\\u28EF','\\u28DF','\\u287F','\\u28BF','\\u28FB','\\u28FD'];
      var spinIdx = 0; var curTitle = ''; var targetPct = 0; var curPct = 0;
      var spinTimer = setInterval(function() { spinIdx = (spinIdx+1)%8; titleEl.textContent = spinChars[spinIdx]+' '+curTitle; if(curPct<targetPct){curPct=targetPct>=100?targetPct:curPct+Math.max(1,Math.round((targetPct-curPct)*0.1));if(curPct>targetPct)curPct=targetPct;barFill.style.width=Math.min(curPct,100)+'%';} }, 80);
      function showProgress(t,s,p) { curTitle=t; subEl.textContent=s||''; if(p!==undefined) targetPct=Math.min(Math.max(p,0),100); }
      function closeProgress() { clearInterval(spinTimer); if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }
      function showConfirm(title, msg, btnYesLabel, btnNoLabel) {
        return new Promise(function(resolve) {
          var co=document.createElement('div'); co.className='io-overlay io-overlay-high';
          var cb=document.createElement('div'); cb.className='io-dialog';
          var ct=document.createElement('div'); ct.className='io-title'; ct.textContent=title;
          var cm=document.createElement('div'); cm.className='io-sub io-sub-block'; cm.textContent=msg;
          var br=document.createElement('div'); br.className='io-btn-row';
          var by=document.createElement('button'); by.className='io-btn io-btn-primary'; by.textContent=btnYesLabel||'确定';
          var bn=document.createElement('button'); bn.className='io-btn io-btn-secondary'; bn.textContent=btnNoLabel||'取消';
          br.appendChild(bn); br.appendChild(by); cb.appendChild(ct); cb.appendChild(cm); cb.appendChild(br); co.appendChild(cb); document.body.appendChild(co);
          by.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(true); };
          bn.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(false); };
        });
      }
      function showAlert(msg) {
        return new Promise(function(resolve) {
          var ao=document.createElement('div'); ao.className='io-overlay io-overlay-high';
          var ab=document.createElement('div'); ab.className='io-dialog';
          var am=document.createElement('div'); am.className='io-msg'; am.textContent=msg;
          var bo=document.createElement('button'); bo.className='io-btn io-btn-primary'; bo.textContent='确定';
          ab.appendChild(am); ab.appendChild(bo); ao.appendChild(ab); document.body.appendChild(ao);
          bo.onclick=function(){ if(ao.parentNode) ao.parentNode.removeChild(ao); resolve(); };
        });
      }

      (async function() {
        try {
          var mode = 'merge';
          var isOverwrite = await showConfirm("是否使用【覆盖模式】？", "点击确定将清空云端的所有数据，然后完全替换为导入的新数据。\\n请确保导出数据时一定要全部勾选，否则执行时对于可能出现的问题后果自负。\\n点击取消将进入【合并模式】或取消导入操作。");
          if (isOverwrite) { mode = 'overwrite'; }
          else {
            var isMerge = await showConfirm("是否继续使用【合并模式】进行导入？", "将保留现有云端的所有数据，新增并覆盖更新 ID 相同的重叠事项。\\n请确保导出数据时一定要全部勾选，否则执行时对于可能出现的问题后果自负。\\n过程中出现异常将无法恢复。");
            if (!isMerge) { closeProgress(); event.target.value=''; return; }
          }

          showProgress('初始化导入会话', mode === 'overwrite' ? '备份并清空云端数据...' : '创建合并会话...', 8);
          await new Promise(function(r){ setTimeout(r,30); });
          var initRes = await fetch('/api/import', {
            method: 'POST',
            body: JSON.stringify({ phase: 'init', mode: mode, importId: importId }),
            headers: { 'Content-Type': 'application/json' }
          });

          if (!initRes.ok) {
            var errData1 = {};
            try { errData1 = await initRes.json(); } catch(ee){}

            if (initRes.status === 409 && errData1.conflict && errData1.importId) {
              var conflictMsg = '检测到未完成的导入会话 (' + errData1.importId + ')\\n\\n';
              if (errData1.mode === 'overwrite') {
                conflictMsg += '该会话为覆写模式，点击「恢复」将中止旧会话并恢复原始数据。\\n';
              } else {
                conflictMsg += '点击「恢复」将清除旧会话记录。\\n';
              }
              conflictMsg += '点击「确定」中止旧会话并继续当前导入。';

              var doAbortOld = await showConfirm("会话冲突", conflictMsg, "确定", "恢复");
              if (doAbortOld) {
                var abortOldRes = await fetch('/api/import', {
                  method: 'POST',
                  body: JSON.stringify({ phase: 'abort', importId: errData1.importId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (abortOldRes.ok) {
                  showProgress('重试初始化', mode === 'overwrite' ? '备份并清空云端数据...' : '创建合并会话...', 8);
                  await new Promise(function(r){ setTimeout(r,30); });
                  initRes = await fetch('/api/import', {
                    method: 'POST',
                    body: JSON.stringify({ phase: 'init', mode: mode, importId: importId }),
                    headers: { 'Content-Type': 'application/json' }
                  });
                  if (!initRes.ok) {
                    var errMsg1Retry = '重试初始化失败';
                    try { var ed1r = await initRes.json(); if(ed1r.error) errMsg1Retry+='：'+ed1r.error; } catch(ee){}
                    throw new Error(errMsg1Retry);
                  }
                } else {
                  throw new Error('中止旧会话失败，请刷新页面后重试');
                }
              } else {
                var restoreAbortRes = await fetch('/api/import', {
                  method: 'POST',
                  body: JSON.stringify({ phase: 'abort', importId: errData1.importId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                closeProgress();
                if (restoreAbortRes.ok) {
                  var restoreAbortData = await restoreAbortRes.json();
                  if (errData1.mode === 'overwrite' && restoreAbortData.recovered) {
                    await showAlert('原始数据已成功恢复。');
                  } else if (errData1.mode === 'overwrite') {
                    await showAlert('旧会话已清除，但未检测到备份数据。');
                  } else {
                    await showAlert('旧会话已清除。');
                  }
                } else {
                  await showAlert('恢复操作失败，可手动访问 /api/import-backup?action=restore 尝试恢复。');
                }
                return;
              }
            } else {
              var errMsg1 = '初始化失败';
              if(errData1.error) errMsg1 += '：' + errData1.error;
              throw new Error(errMsg1);
            }
          }

          var abortAndThrow = async function(msg) {
            if (mode === 'overwrite') {
              try {
                var abortRes = await fetch('/api/import', {
                  method: 'POST',
                  body: JSON.stringify({ phase: 'abort', importId: importId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (abortRes.ok) {
                  var abortData = await abortRes.json();
                  msg += abortData.recovered ? '\\n\\n已自动恢复原始备份数据' : '\\n\\n会话已清除，但未检测到备份数据';
                } else {
                  msg += '\\n\\n自动恢复失败，可手动访问 /api/import-backup?action=restore 尝试恢复';
                }
              } catch(abortErr) {
                msg += '\\n\\n自动恢复请求异常：' + abortErr.message;
              }
            }
            throw new Error(msg);
          };

          showProgress('读取文件', '正在读取...', 15);

          var useStream = typeof file.stream === 'function';
          var useChunked = document.getElementById('chunked-mode').checked;
          var isNdjson = false;
          var settingsBuf = {};
          var categoriesBuf = null;
          var customColorsBuf = null;

          if (useChunked) {
            var firstChunk = file.slice(0, 1024);
            var firstText = await new Promise(function(resolve) {
              var r = new FileReader();
              r.onload = function(e) { resolve(e.target.result); };
              r.onerror = function() { resolve(''); };
              r.readAsText(firstChunk);
            });
            var firstTrimmed = firstText.trim();
            if (firstTrimmed.startsWith('{') || firstTrimmed.startsWith('[')) {
              useChunked = false;
            }
          }

          if (useChunked) {
            var chunkBuf = [];
            var CHUNK_LINES = 500;
            var chunkIdx = 0;
            var uploadPct = 42;
            var streamReader = file.stream().getReader();
            var decoder = new TextDecoder();
            var lineBuffer = '';
            var firstLineChecked = false;
            var bytesRead = 0;
            var fileSize = file.size;

            async function flushChunk() {
              if (chunkBuf.length === 0) return;
              chunkIdx++;
              uploadPct += (88 - uploadPct) * 0.12;
              showProgress('分片导入', '上传第 ' + chunkIdx + ' 片...', Math.round(uploadPct));
              var chunkBody = chunkBuf.join('\\n') + '\\n';
              chunkBuf.length = 0;
              var chunkRes = await fetch('/api/import?importId=' + importId, {
                method: 'POST',
                body: chunkBody,
                headers: { 'Content-Type': 'application/x-ndjson' }
              });
              chunkBody = null;
              if (!chunkRes.ok) {
                var chunkErr = '第 ' + chunkIdx + ' 片上传失败';
                try { var ced = await chunkRes.json(); if (ced.error) chunkErr += '：' + ced.error; } catch(cee) {}
                await abortAndThrow(chunkErr);
              }
            }

            while (true) {
              var _cref = await streamReader.read();
              if (_cref.done) break;
              bytesRead += _cref.value.byteLength;
              var readPct = 15 + Math.round((bytesRead / Math.max(fileSize, 1)) * 25);
              showProgress('分片导入', '读取 ' + (bytesRead / 1024 / 1024).toFixed(1) + ' / ' + (fileSize / 1024 / 1024).toFixed(1) + ' MB', readPct);

              lineBuffer += decoder.decode(_cref.value, { stream: true });
              var lines = lineBuffer.split('\\n');
              lineBuffer = lines.pop() || '';

              for (var cli = 0; cli < lines.length; cli++) {
                var trimmed = lines[cli];
                lines[cli] = null;
                trimmed = trimmed.trim();
                if (!trimmed) continue;
                if (!firstLineChecked) {
                  firstLineChecked = true;
                  if (trimmed === 'ndjson') { isNdjson = true; continue; }
                }
                if (isNdjson && trimmed.indexOf('"_type"') !== -1) {
                  try {
                    var cobj = JSON.parse(trimmed);
                    if (cobj._type === 'settings') { settingsBuf.settings = cobj.data; continue; }
                    if (cobj._type === 'custom_header') { settingsBuf.custom_header = cobj.data; continue; }
                    if (cobj._type === 'custom_content') { settingsBuf.custom_content = cobj.data; continue; }
                    if (cobj._type === 'customColors') { customColorsBuf = cobj.data; continue; }
                    if (cobj._type === 'categories') { categoriesBuf = cobj.data; continue; }
                  } catch(cpe) {}
                }
                chunkBuf.push(trimmed);
                if (chunkBuf.length >= CHUNK_LINES) {
                  await flushChunk();
                }
              }
            }

            if (lineBuffer.trim()) {
              var trimmed = lineBuffer.trim();
              if (!firstLineChecked && trimmed === 'ndjson') {
              } else if (isNdjson && trimmed.indexOf('"_type"') !== -1) {
                try {
                  var cobj = JSON.parse(trimmed);
                  if (cobj._type === 'settings') { settingsBuf.settings = cobj.data; }
                  else if (cobj._type === 'custom_header') { settingsBuf.custom_header = cobj.data; }
                  else if (cobj._type === 'custom_content') { settingsBuf.custom_content = cobj.data; }
                  else if (cobj._type === 'customColors') { customColorsBuf = cobj.data; }
                  else if (cobj._type === 'categories') { categoriesBuf = cobj.data; }
                  else { chunkBuf.push(trimmed); }
                } catch(cpe) { chunkBuf.push(trimmed); }
              } else {
                chunkBuf.push(trimmed);
              }
            }

            await flushChunk();
          } else if (useStream) {
            var ts = new TransformStream();
            var writer = ts.writable.getWriter();
            var encoder = new TextEncoder();

            var uploadPromise = fetch('/api/import?importId=' + importId, {
              method: 'POST',
              body: ts.readable,
              headers: { 'Content-Type': 'application/x-ndjson' },
              duplex: 'half'
            });

            var streamReader = file.stream().getReader();
            var decoder = new TextDecoder();
            var lineBuffer = '';
            var firstLineChecked = false;
            var bytesRead = 0;
            var fileSize = file.size;

            while (true) {
              var _ref = await streamReader.read();
              if (_ref.done) break;
              bytesRead += _ref.value.byteLength;
            var readPct = 15 + Math.round((bytesRead / Math.max(fileSize, 1)) * 25);
              showProgress('流式导入', '读取 ' + (bytesRead / 1024 / 1024).toFixed(1) + ' / ' + (fileSize / 1024 / 1024).toFixed(1) + ' MB', readPct);

              lineBuffer += decoder.decode(_ref.value, { stream: true });
              var lines = lineBuffer.split('\\n');
              lineBuffer = lines.pop() || '';

              var output = '';
              for (var li = 0; li < lines.length; li++) {
                var trimmed = lines[li];
                lines[li] = null;
                trimmed = trimmed.trim();
                if (!trimmed) continue;

                if (!firstLineChecked) {
                  firstLineChecked = true;
                  if (trimmed === 'ndjson') { isNdjson = true; continue; }
                }

                if (isNdjson && trimmed.indexOf('"_type"') !== -1) {
                  try {
                    var obj = JSON.parse(trimmed);
                    if (obj._type === 'settings') { settingsBuf.settings = obj.data; continue; }
                    if (obj._type === 'custom_header') { settingsBuf.custom_header = obj.data; continue; }
                    if (obj._type === 'custom_content') { settingsBuf.custom_content = obj.data; continue; }
                    if (obj._type === 'customColors') { customColorsBuf = obj.data; continue; }
                    if (obj._type === 'categories') { categoriesBuf = obj.data; continue; }
                  } catch(pe) {}
                }

                output += trimmed + '\\n';
              }

              if (output) {
                await writer.write(encoder.encode(output));
              }
            }

            if (lineBuffer.trim()) {
              var trimmed = lineBuffer.trim();
              if (!firstLineChecked && trimmed === 'ndjson') {
                // skip
              } else if (isNdjson && trimmed.indexOf('"_type"') !== -1) {
                try {
                  var obj = JSON.parse(trimmed);
                  if (obj._type === 'settings') { settingsBuf.settings = obj.data; }
                  else if (obj._type === 'custom_header') { settingsBuf.custom_header = obj.data; }
                  else if (obj._type === 'custom_content') { settingsBuf.custom_content = obj.data; }
                  else if (obj._type === 'customColors') { customColorsBuf = obj.data; }
                  else if (obj._type === 'categories') { categoriesBuf = obj.data; }
                  else { await writer.write(encoder.encode(trimmed + '\\n')); }
                } catch(pe) { await writer.write(encoder.encode(trimmed + '\\n')); }
              } else {
                await writer.write(encoder.encode(trimmed + '\\n'));
              }
            }

            await writer.close();
            showProgress('流式导入', '上传数据中...', 42);
            var uploadRes = await uploadPromise;
            if (!uploadRes.ok) {
              var errMsg2 = '上传数据失败';
              try { var ed2 = await uploadRes.json(); if(ed2.error) errMsg2+='：'+ed2.error; } catch(ee){}
              await abortAndThrow(errMsg2);
            }
          } else {
            showProgress('读取文件', '兼容模式...', 15);
            var fileReader = new FileReader();
            var rawText = await new Promise(function(resolve, reject) {
              fileReader.onload = function(e) { resolve(e.target.result); };
              fileReader.onerror = function() { reject(new Error('文件读取失败')); };
              fileReader.readAsText(file);
            });

            showProgress('数据解析', '解析 JSON 中...', 40);

            var data;
            var firstLine = rawText.split('\\n')[0].trim();

            if (firstLine === 'ndjson') {
              isNdjson = true;
              var lines = rawText.split('\\n');
              var todos = [];
              var templates = [];
              data = {};
              for (var li = 1; li < lines.length; li++) {
                var line = lines[li].trim();
                if (!line) continue;
                var item = JSON.parse(line);
                if (item._type === 'template') { var tpl = Object.assign({}, item); delete tpl._type; templates.push(tpl); }
                else if (item._type === 'settings') { data.settings = item.data; }
                else if (item._type === 'custom_header') { data.custom_header = item.data; }
                else if (item._type === 'custom_content') { data.custom_content = item.data; }
                else if (item._type === 'customColors') { data.customColors = item.data; }
                else if (item._type === 'categories') { data.categories = item.data; }
                else { todos.push(item); }
              }
              data.todos = todos;
              data.todo_templates = templates;
            } else {
              data = JSON.parse(rawText);
            }
            rawText = null;

            var toImport = [];
            if (data.todos) toImport = toImport.concat(data.todos);
            if (data.trash) toImport = toImport.concat(data.trash);
            if (!data.todos && !data.trash && Array.isArray(data)) toImport = data;
            var toImportTemplates = data.todo_templates || [];

            if (toImport.length === 0 && toImportTemplates.length === 0 && !data.settings && data.custom_header === undefined && data.custom_content === undefined && !data.categories) {
              throw new Error("未在文件中找到有效的待办或设置数据。");
            }

            showProgress('上传数据', '', 45);
            var mixedItems = [];
            for (var mi = 0; mi < toImport.length; mi++) { mixedItems.push(toImport[mi]); }
            for (var ti = 0; ti < toImportTemplates.length; ti++) {
              var tplObj = Object.assign({ _type: 'template' }, toImportTemplates[ti]);
              mixedItems.push(tplObj);
            }
            toImport = null;
            toImportTemplates = null;

            var mIdx = 0;
            var mixedStream = new ReadableStream({
              pull: function(controller) {
                if (mIdx >= mixedItems.length) { controller.close(); return; }
                var chunk = '';
                for (var i = 0; i < 50 && mIdx < mixedItems.length; i++, mIdx++) {
                  chunk += JSON.stringify(mixedItems[mIdx]) + '\\n';
                }
                controller.enqueue(new TextEncoder().encode(chunk));
              }
            });
            mixedItems = null;

            var uploadRes = await fetch('/api/import?importId=' + importId, {
              method: 'POST',
              body: mixedStream,
              headers: { 'Content-Type': 'application/x-ndjson' },
              duplex: 'half'
            });
            if (!uploadRes.ok) {
              var errMsg2b = '上传数据失败';
              try { var ed2b = await uploadRes.json(); if(ed2b.error) errMsg2b+='：'+ed2b.error; } catch(ee){}
              await abortAndThrow(errMsg2b);
            }

            settingsBuf.settings = data.settings;
            settingsBuf.custom_header = data.custom_header;
            settingsBuf.custom_content = data.custom_content;
            categoriesBuf = data.categories;
            customColorsBuf = data.customColors;
          }

          if (settingsBuf.settings && document.getElementById('export-settings').checked) {
            showProgress('应用偏好设置', '', 85);
            await fetch('/api/settings', {
              method: 'POST',
              body: JSON.stringify(settingsBuf.settings),
              headers: { 'Content-Type': 'application/json' }
            });
          }

          showProgress('收尾处理', '清理并完成导入...', 90);
          var finalBody = { phase: 'finalize', mode: mode, importId: importId };
          if (settingsBuf.custom_header !== undefined && document.getElementById('export-settings').checked) finalBody.custom_header = settingsBuf.custom_header;
          if (settingsBuf.custom_content !== undefined && document.getElementById('export-settings').checked) finalBody.custom_content = settingsBuf.custom_content;
          if (categoriesBuf && Array.isArray(categoriesBuf) && document.getElementById('export-categories').checked) finalBody.categories = categoriesBuf;
          if (customColorsBuf && Array.isArray(customColorsBuf) && document.getElementById('export-settings').checked) finalBody.customColors = customColorsBuf;
          var finalRes = await fetch('/api/import', {
            method: 'POST',
            body: JSON.stringify(finalBody),
            headers: { 'Content-Type': 'application/json' }
          });
          if (!finalRes.ok) {
            var errMsg4 = '收尾处理失败';
            try { var ed4 = await finalRes.json(); if(ed4.error) errMsg4+='：'+ed4.error; } catch(ee){}
            throw new Error(errMsg4);
          }

          showProgress('导入完成', mode === 'overwrite' ? '原始数据备份保留10分钟，可手动恢复。界面即将重载...' : '界面即将重载...', 100);
          await new Promise(function(r){ setTimeout(r,1000); });
          closeProgress();
          location.reload();
        } catch (err) {
          closeProgress();
          await showAlert('导入失败：' + err.message);
        }
        event.target.value = '';
      })();
    }

    async function factoryReset() {
      if (!confirm("警告：此操作将彻底删除云端所有的待办事项、回收站记录和所有的云端偏好设置！\\n此操作不可逆，强烈建议先导出系统备份！\\n\\n是否继续？")) return;
      if (!confirm("最终确认：真的要彻底清空所有数据吗？")) return;
      
      try {
        await fetch('/api/trash-action', {
          method: 'POST', body: JSON.stringify({ action: 'CLEAR_ALL_DATA' }),
          headers: { 'Content-Type': 'application/json' }
        });
        alert("系统云端已完全清空，即将重置。");
        location.reload();
      } catch (e) {
        alert("数据清理执行失败");
      }
    }

    async function checkInterruptedImport() {
      try {
        var res = await fetch('/api/import', {
          method: 'POST',
          body: JSON.stringify({ phase: 'status' }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) return;
        var data = await res.json();
        if (!data.active) return;

        if (data.mode === 'overwrite' && data.hasBackup) {
          var doRecover = confirm(
            '检测到上次覆写导入中断，原始数据备份仍在。\\n\\n' +
            '会话 ID: ' + data.importId + '\\n' +
            '启动时间: ' + new Date(data.startedAt).toLocaleString() + '\\n\\n' +
            '点击「确定」恢复原始数据，点击「取消」放弃恢复（当前不完整数据将保留）。'
          );
          if (doRecover) {
            var abortRes = await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId }),
              headers: { 'Content-Type': 'application/json' }
            });
            if (abortRes.ok) {
              var abortData = await abortRes.json();
              if (abortData.recovered) {
                alert('原始数据已成功恢复，页面即将重载。');
                location.reload();
              } else {
                alert('会话已清除。');
              }
            } else {
              alert('恢复操作失败，可手动访问 /api/import-backup?action=restore 尝试恢复。');
            }
          } else {
            await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId, discard: true }),
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } else {
          var doCleanup = confirm(
            '检测到上次合并导入中断（会话 ID: ' + data.importId + '）。\\n\\n' +
            '合并模式无法自动恢复，部分新数据可能已写入。\\n' +
            '点击「确定」清除该会话记录。'
          );
          if (doCleanup) {
            await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId }),
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      } catch(e) {
        console.error('Check interrupted import error:', e);
      }
    }
`;
