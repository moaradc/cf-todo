export const trash = `
    function openTrash() {
      exitTrashBatchMode();
      const trashView = document.getElementById('trash-overlay');
      trashView.classList.remove('closing');
      trashView.classList.add('active');
      loadTrashData();
    }

    function closeTrash() {
      exitTrashBatchMode();
      const trashView = document.getElementById('trash-overlay'); 
      trashView.classList.add('closing');
      trashView.addEventListener('animationend', function handler() {
        trashView.classList.remove('active'); 
        trashView.classList.remove('closing'); 
        trashView.removeEventListener('animationend', handler);
      });
      loadTodos(); 
    }

    async function loadTrashData() {
      const list = document.getElementById('trash-list');
      list.innerHTML = '<div style="padding:20px;text-align:center;">数据拉取中...</div>';
      try {
        const res = await fetch('/api/trash');
        if (res.ok) {
          trashTodos = await res.json();
          renderTrashItems();
        }
      } catch(e) { list.innerHTML = '<div style="color:var(--warn);text-align:center;">加载失败</div>'; }
    }

    function renderTrashItems() {
      const list = document.getElementById('trash-list');
      list.innerHTML = '';
      if (trashTodos.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;border:1px dashed #666;">回收站为空</div>';
        return;
      }
      trashTodos.forEach((todo, index) => {
        const el = document.createElement('div');
        el.className = 'todo-item';
        
        let checkboxHtml = '';
        let actionsHtml = '';

        if (isTrashBatchMode) {
          const isSelected = selectedTrashTasks.has(index);
          checkboxHtml = \`<div class="checkbox \${isSelected ? 'batch-selected' : ''}" onclick="event.stopPropagation(); toggleTrashBatchSelect(\${index})"></div>\`;
        } else {
          actionsHtml = \`
            <button class="btn-ghost" style="padding:4px 8px; border:1px solid #666;" onclick="event.stopPropagation(); actionTrash('\${todo.id}', 'RESTORE')">恢复</button>
            <button class="btn-danger" style="padding:4px 8px; margin-left:8px;" onclick="event.stopPropagation(); actionTrash('\${todo.id}', 'DELETE_PERMANENT')">删除</button>
          \`;
        }

        el.innerHTML = \`
          \${checkboxHtml}
          <div class="item-meta" style="opacity:0.7;">
            <div class="item-title" style="text-decoration:line-through;">\${todo.text}</div>
            <div class="item-info">原日期: \${todo.date}</div>
          </div>
          \${actionsHtml}
        \`;

        if (isTrashBatchMode) {
            el.onclick = () => toggleTrashBatchSelect(index);
        } else {
            el.style.cursor = 'default';
        }

        list.appendChild(el);
      });
    }

    function toggleTrashBatchMode() {
      if (isTrashBatchMode) {
        exitTrashBatchMode();
      } else {
        isTrashBatchMode = true;
        selectedTrashTasks.clear();
        const bar = document.getElementById('trash-batch-bar');
        bar.classList.remove('hidden', 'closing');
        document.getElementById('btn-trash-batch').classList.add('active');
        renderTrashItems();
      }
    }

    function exitTrashBatchMode() {
      if (!isTrashBatchMode) return;
      isTrashBatchMode = false;
      selectedTrashTasks.clear();
      const bar = document.getElementById('trash-batch-bar');
      bar.classList.add('closing');
      bar.addEventListener('animationend', function handler() {
        bar.classList.add('hidden');
        bar.classList.remove('closing');
        bar.removeEventListener('animationend', handler);
      });
      document.getElementById('btn-trash-batch').classList.remove('active');
      renderTrashItems();
    }

    function toggleTrashBatchSelect(index) {
      if (selectedTrashTasks.has(index)) selectedTrashTasks.delete(index);
      else selectedTrashTasks.add(index);
      renderTrashItems();
    }

    function batchTrashSelectAll() {
      if (selectedTrashTasks.size === trashTodos.length && trashTodos.length > 0) {
        selectedTrashTasks.clear();
      } else {
        trashTodos.forEach((_, i) => selectedTrashTasks.add(i));
      }
      renderTrashItems();
    }

    async function batchTrashRestore() {
      if (selectedTrashTasks.size === 0) return;
      const ids = Array.from(selectedTrashTasks).map(idx => trashTodos[idx].id);
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_RESTORE', ids })
      });
      exitTrashBatchMode();
      loadTrashData();
    }

    async function batchTrashDelete() {
      if (selectedTrashTasks.size === 0) return;
      if (!confirm(\`你会永远失去 \${selectedTrashTasks.size} 个事项！\`)) return;
      const ids = Array.from(selectedTrashTasks).map(idx => trashTodos[idx].id);
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE_PERMANENT', ids })
      });
      exitTrashBatchMode();
      loadTrashData();
    }

    async function actionTrash(id, action) {
      if (action === 'DELETE_PERMANENT' && !confirm('你会永远失去它，确认？')) return;
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action, id }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTrashData();
    }

    async function clearTrash() {
      if (!confirm('确认清空？你会永远失去它们！')) return;
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'CLEAR_ALL' }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTrashData();
    }

`;
