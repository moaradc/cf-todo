export const calendar = `
    function openCalendar() { calendarMode = 'navigate'; calDate = new Date(currentDate); calMode = 'date'; renderCalendar(); document.getElementById('modal-calendar').classList.add('active'); }
    function calChange(offset) {
      if (calendarMode === 'repeat_end') { calDate.setMonth(calDate.getMonth() + offset); renderCalendarForRepeatEnd(); return; }
      if (calMode === 'date') { calDate.setMonth(calDate.getMonth() + offset); renderCalendar(); } 
      else if (calMode === 'year') { yearPickerStart += offset * 12; openYearPicker(yearPickerStart); } 
      else if (calMode === 'month') { calDate.setFullYear(calDate.getFullYear() + offset); openMonthPicker(); }
    }
    
    function openCalendarForAdd() { calendarMode = 'select'; calDate = new Date(tempAddDate || currentDate); renderCalendar(); document.getElementById('modal-calendar').classList.add('active');
    }
    function openCalendarForEdit() { calendarMode = 'edit_date'; calDate = new Date(tempEditDate || currentDate); renderCalendar(); document.getElementById('modal-calendar').classList.add('active'); }

    let calendarRepeatEndTarget = '';
    function openCalendarForRepeatEnd(mode) {
      calendarRepeatEndTarget = mode;
      calendarMode = 'repeat_end';
      calDate = tempRepeatEnd ? new Date(tempRepeatEnd) : new Date(tempAddDate || currentDate);
      renderCalendarForRepeatEnd();
      document.getElementById('modal-calendar').classList.add('active');
    }

    function renderCalendarForRepeatEnd() {
      calMode = 'date';
      const year = calDate.getFullYear(); const month = calDate.getMonth();
      const actionBtn = document.getElementById('cal-action-btn');
      actionBtn.innerText = '清除截止日期'; actionBtn.onclick = function() {
        tempRepeatEnd = '';
        if (calendarRepeatEndTarget === 'add') {
          document.getElementById('add-repeat-end-display').innerText = '循环截止: 永不';
        } else {
          document.getElementById('edit-repeat-end-display').innerText = '循环截止: 永不';
        }
        document.getElementById('modal-calendar').classList.remove('active');
      };
      document.getElementById('cal-prev').innerText = '< 上月'; document.getElementById('cal-next').innerText = '下月 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn" onclick="openYearPicker()">\${year}年</span> <span class="cal-title-btn" onclick="openMonthPicker()">\${month + 1}月</span>\`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(7, 1fr)'; grid.innerHTML = '';
      const days = ['日','一','二','三','四','五','六']; days.forEach(d => grid.innerHTML += \`<div class="cal-day-name">\${d}</div>\`);
      const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
      const selectedStr = tempRepeatEnd || '';
      for(let i=0; i<firstDay; i++) grid.innerHTML += \`<div class="cal-date empty"></div>\`;
      for(let i=1; i<=daysInMonth; i++) {
        const d = new Date(year, month, i); const dStr = formatDate(d);
        let className = 'cal-date';
        if (dStr === selectedStr) className += ' selected';
        const el = document.createElement('div'); el.className = className; el.innerText = i;
        el.onclick = () => {
          tempRepeatEnd = formatDate(new Date(year, month, i));
          if (calendarRepeatEndTarget === 'add') {
            document.getElementById('add-repeat-end-display').innerText = '循环截止: ' + tempRepeatEnd;
          } else {
            document.getElementById('edit-repeat-end-display').innerText = '循环截止: ' + tempRepeatEnd;
          }
          document.getElementById('modal-calendar').classList.remove('active');
        };
        grid.appendChild(el);
      }
    }

    function renderCalendar() {
      calMode = 'date';
      const year = calDate.getFullYear(); const month = calDate.getMonth();
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回今日'; actionBtn.onclick = jumpToToday;
      
      document.getElementById('cal-prev').innerText = '< 上月'; document.getElementById('cal-next').innerText = '下月 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn" onclick="openYearPicker()">\${year}年</span> <span class="cal-title-btn" onclick="openMonthPicker()">\${month + 1}月</span>\`;
      
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(7, 1fr)'; grid.innerHTML = '';
      const days = ['日','一','二','三','四','五','六']; days.forEach(d => grid.innerHTML += \`<div class="cal-day-name">\${d}</div>\`);
      const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayStr = formatDate(new Date()); const selectedStr = (calendarMode === 'select' || calendarMode === 'edit_date') ? formatDate(calDate) : formatDate(currentDate);

      for(let i=0; i<firstDay; i++) grid.innerHTML += \`<div class="cal-date empty"></div>\`;
      for(let i=1; i<=daysInMonth; i++) {
        const d = new Date(year, month, i); const dStr = formatDate(d);
        let className = 'cal-date';
        if (dStr === todayStr) className += ' today'; if (dStr === selectedStr) className += ' selected';
        const el = document.createElement('div'); el.className = className; el.innerText = i;
        el.onclick = () => {
          if (calendarMode === 'select') {
            tempAddDate = formatDate(new Date(year, month, i));
            document.getElementById('add-date-display').innerText = tempAddDate;
            document.getElementById('modal-calendar').classList.remove('active');
            calendarMode = 'navigate';
          } else if (calendarMode === 'edit_date') {
            tempEditDate = formatDate(new Date(year, month, i));
            document.getElementById('edit-date-display').innerText = tempEditDate;
            document.getElementById('modal-calendar').classList.remove('active');
            calendarMode = 'navigate';
          } else {
            currentDate = new Date(year, month, i);
            document.getElementById('modal-calendar').classList.remove('active');
            exitBatchMode();
            loadTodos();
          }
        };
        grid.appendChild(el);
      }
    }

    function openMonthPicker() {
      calMode = 'month';
      var backFn = (calendarMode === 'repeat_end') ? renderCalendarForRepeatEnd : renderCalendar;
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回'; actionBtn.onclick = backFn;
      document.getElementById('cal-prev').innerText = '< 上年'; document.getElementById('cal-next').innerText = '下年 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn" onclick="openYearPicker()">\${calDate.getFullYear()}年</span> <span class="cal-title-btn">选择月份</span>\`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(4, 1fr)'; grid.innerHTML = '';
      for(let i=0; i<12; i++) {
        const el = document.createElement('div'); el.className = 'cal-date' + (calDate.getMonth() === i ? ' selected' : ''); el.innerText = (i+1) + '月';
        el.onclick = () => { calDate.setMonth(i); if (calendarMode === 'repeat_end') renderCalendarForRepeatEnd(); else renderCalendar(); }; grid.appendChild(el);
      }
    }

    function openYearPicker(startYear) {
      calMode = 'year';
      if (!startYear) startYear = calDate.getFullYear() - 4; yearPickerStart = startYear;
      var backFn = (calendarMode === 'repeat_end') ? renderCalendarForRepeatEnd : renderCalendar;
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回'; actionBtn.onclick = backFn;
      document.getElementById('cal-prev').innerText = '< 上页'; document.getElementById('cal-next').innerText = '下页 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn">选择年份</span> <span class="cal-title-btn" onclick="openMonthPicker()">\${calDate.getMonth() + 1}月</span>\`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(4, 1fr)'; grid.innerHTML = '';
      for(let i=0; i<12; i++) {
        const y = startYear + i; const el = document.createElement('div');
        el.className = 'cal-date' + (calDate.getFullYear() === y ? ' selected' : ''); el.innerText = y;
        el.onclick = () => { calDate.setFullYear(y); if (calendarMode === 'repeat_end') renderCalendarForRepeatEnd(); else renderCalendar(); }; grid.appendChild(el);
      }
    }

    function changeDate(offset) { exitBatchMode(); currentDate.setDate(currentDate.getDate() + offset); loadTodos(); }
    function jumpToToday() {
      if (calendarMode === 'select') {
        tempAddDate = formatDate(new Date());
        document.getElementById('add-date-display').innerText = tempAddDate;
        document.getElementById('modal-calendar').classList.remove('active');
        calendarMode = 'navigate';
      } else if (calendarMode === 'edit_date') {
        tempEditDate = formatDate(new Date());
        document.getElementById('edit-date-display').innerText = tempEditDate;
        document.getElementById('modal-calendar').classList.remove('active');
        calendarMode = 'navigate';
      } else if (calendarMode === 'repeat_end') {
        calDate = new Date();
        renderCalendarForRepeatEnd();
      } else {
        exitBatchMode();
        currentDate = new Date();
        document.getElementById('modal-calendar').classList.remove('active');
        loadTodos();
      }
    }
    
    function closeCalendar() {
      document.getElementById('modal-calendar').classList.remove('active');
      calendarMode = 'navigate';
    }

    if (!CSS.supports || !CSS.supports('selector(:has(*))')) {
      new MutationObserver(function() {
        var locked = !!document.querySelector('.modal-overlay.active, .detail-overlay.active');
        document.body.style.overflow = locked ? 'hidden' : '';
        document.body.style.touchAction = locked ? 'none' : '';
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    
`;
