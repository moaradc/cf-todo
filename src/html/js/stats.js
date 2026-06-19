export const stats = `
    // ==================== 统计页：ECharts 实现 ====================
    // 设计原则：
    // 1) 单次 API 拉取 + 客户端聚合，避免增加 D1 行读
    // 2) ECharts 实例集中管理，切换/关闭时统一 dispose 释放内存
    // 3) 主题变化时仅在 stats 面板打开时重绘，且仅当主题键变化才触发

    // ---------- 工具 ----------
    function _statsParseDate(s) {
      if (!s || typeof s !== 'string') return new Date(NaN);
      var parts = s.split('-');
      if (parts.length < 3) return new Date(NaN);
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }

    function _statsTheme() {
      var isLight = document.documentElement.getAttribute('data-theme') === 'light';
      var font = (getComputedStyle(document.documentElement).getPropertyValue('--font-main').trim()) || 'Courier New';
      return {
        isLight: isLight,
        text: isLight ? '#1B1915' : '#ffffff',
        bg: isLight ? '#F0EEE2' : '#0a0a0a',
        panel: isLight ? '#F0F0F0' : '#222222',
        border: isLight ? '#1B1915' : '#555555',
        accent: isLight ? '#CE2424' : '#ff3300',
        warn: isLight ? '#E1AC07' : '#ff9900',
        gray: isLight ? '#999999' : '#666666',
        success: isLight ? '#5C960B' : '#33cc66',
        heat0: isLight ? '#eeeeee' : '#1a1a1a',
        heat1: isLight ? '#ffd4a8' : '#3a1d0d',
        heat2: isLight ? '#ff9b5c' : '#7a2d10',
        heat3: isLight ? '#ff5c1c' : '#cc3300',
        heat4: isLight ? '#a30000' : '#ff6600',
        splitLine: isLight ? '#dddddd' : '#222222',
        font: font
      };
    }

    // ---------- ECharts 实例管理 ----------
    function _getChart(key, domId) {
      var dom = document.getElementById(domId);
      if (!dom) return null;
      if (chartInstances[key]) {
        // 已存在实例：若 dom 被复用则直接返回；否则 dispose 重建
        try {
          if (chartInstances[key].getDom() === dom) return chartInstances[key];
        } catch(e) {}
        try { chartInstances[key].dispose(); } catch(e) {}
        delete chartInstances[key];
      }
      try {
        var inst = echarts.init(dom, null, { renderer: 'canvas' });
        chartInstances[key] = inst;
        return inst;
      } catch(e) { return null; }
    }

    function _disposeAllCharts() {
      Object.keys(chartInstances).forEach(function(key) {
        try { if (chartInstances[key]) chartInstances[key].dispose(); } catch(e) {}
        delete chartInstances[key];
      });
      chartInstances = {};
    }

    // ---------- 时间范围 ----------
    // 'week'  = 本周（周一至今天）
    // '12w'   = 近 12 周（含本周）= 84 天
    // '6m'    = 近 6 月（含本月）
    // 'year'  = 今年（1/1 起）
    function _rangeBounds(range) {
      var end = new Date(); end.setHours(0, 0, 0, 0);
      var start = new Date(end);
      var bucket = 'day';
      if (range === 'week') {
        // 本周：周一为起点（若今天是周一则仅今天）
        var wd = end.getDay();
        var back = (wd === 0 ? 6 : wd - 1);
        start.setDate(start.getDate() - back);
        bucket = 'day';
      } else if (range === '12w') {
        // 近 12 周（含本周）= 84 天
        start.setDate(start.getDate() - 83);
        bucket = 'week';
      } else if (range === '6m') {
        // 近 6 月（含本月），从当月 1 日向前推 5 个月
        start.setMonth(start.getMonth() - 5);
        start.setDate(1);
        bucket = 'month';
      } else if (range === 'year') {
        start = new Date(end.getFullYear(), 0, 1);
        bucket = 'month';
      } else {
        // 兜底：本周
        var wd2 = end.getDay();
        var back2 = (wd2 === 0 ? 6 : wd2 - 1);
        start.setDate(start.getDate() - back2);
        bucket = 'day';
      }
      return { start: start, end: end, bucket: bucket };
    }

    function _rangeLabel(range) {
      return { 'week': '本周', '12w': '12周', '6m': '6月', 'year': '今年' }[range] || '本周';
    }

    // ---------- 入口 ----------
    async function openStats() {
      var statsView = document.getElementById('stats-overlay');
      statsView.classList.remove('closing');
      statsView.classList.add('active');

      currentStatsTab = 'weekly';
      currentStatsRange = 'week';
      _applyRangeTabActive('week');
      updateStatsHeader();
      _loadRangeStats('week');
      _navPush('stats-overlay', closeStats, '/stats');
    }

    function _applyRangeTabActive(range) {
      var tabs = document.querySelectorAll('.stats-range-tab');
      if (!tabs || !tabs.length) return;
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', tabs[i].getAttribute('data-range') === range);
      }
    }

    async function _loadRangeStats(range) {
      var loading = document.getElementById('stats-loading');
      var content = document.getElementById('stats-content');
      if (!loading || !content) return;
      loading.classList.remove('hidden');
      loading.innerText = '数据拉取中...';
      content.classList.add('hidden');

      _disposeAllCharts();

      var b = _rangeBounds(range);
      var startStr = formatDate(b.start);
      var endStr = formatDate(b.end);

      try {
        var res = await fetch('/api/stats?start=' + startStr + '&end=' + endStr);
        if (!res.ok) { loading.innerText = '数据拉取失败。'; return; }
        var rawData = await res.json();
        if (!cachedCategories) {
          try {
            var cres = await fetch('/api/categories');
            cachedCategories = cres.ok ? (await cres.json()) : [];
          } catch(e) { cachedCategories = []; }
        }
        // 先让容器可见，ECharts 才能正确测量宽高
        loading.classList.add('hidden');
        content.classList.remove('hidden');
        _renderRangeStats(rawData, range, b);
        // 渲染后兜底 resize，避免任何隐藏残留导致 canvas 尺寸为 0
        _resizeAllCharts();
      } catch(e) {
        loading.innerText = '网络请求异常。';
      }
    }

    function _resizeAllCharts() {
      Object.keys(chartInstances).forEach(function(key) {
        try { if (chartInstances[key]) chartInstances[key].resize(); } catch(e) {}
      });
    }

    function switchStatsRange(range) {
      if (range === currentStatsRange) return;
      currentStatsRange = range;
      _applyRangeTabActive(range);
      updateStatsHeader();
      _loadRangeStats(range);
    }

    function closeStats() {
      // 关闭面板时统一释放所有 ECharts 实例
      _disposeAllCharts();
      if (_isNavClosing) {
        var statsView = document.getElementById('stats-overlay');
        statsView.classList.add('closing');
        statsView.addEventListener('animationend', function handler() {
          statsView.classList.remove('active');
          statsView.classList.remove('closing');
          statsView.removeEventListener('animationend', handler);
        });
        return;
      }
      _navClose('stats-overlay');
    }

    function switchStatsTab() {
      if (currentStatsTab === 'weekly') {
        if (getAnnualReportYear() === null) return;
        currentStatsTab = 'annual';
        _disposeAllCharts();
        document.getElementById('stats-weekly').classList.add('hidden');
        document.getElementById('stats-annual').classList.remove('hidden');
        loadAnnualReport();
      } else {
        currentStatsTab = 'weekly';
        _disposeAllCharts();
        document.getElementById('stats-annual').classList.add('hidden');
        document.getElementById('stats-weekly').classList.remove('hidden');
        _loadRangeStats(currentStatsRange);
      }
      updateStatsHeader();
    }

    // 年度报告出现时间：仅 12/31 当天 + 次年 1/1-1/7
    function getAnnualReportYear() {
      var now = new Date();
      var month = now.getMonth();
      var day = now.getDate();
      if (month === 11 && day === 31) return now.getFullYear();
      if (month === 0 && day >= 1 && day <= 7) return now.getFullYear() - 1;
      return null;
    }

    function updateStatsHeader() {
      var titleEl = document.getElementById('stats-title-text');
      var switchBtn = document.getElementById('stats-switch-btn');
      if (!titleEl || !switchBtn) return;
      if (currentStatsTab === 'weekly') {
        titleEl.innerText = _rangeLabel(currentStatsRange) + '统计';
        if (getAnnualReportYear() !== null) {
          switchBtn.classList.remove('hidden');
          switchBtn.innerText = '年度报告';
        } else {
          switchBtn.classList.add('hidden');
        }
      } else {
        titleEl.innerText = '年度报告';
        switchBtn.classList.remove('hidden');
        switchBtn.innerText = '7天统计';
      }
    }

    // ---------- 客户端聚合 ----------
    function _aggregate(rawData, range, bounds) {
      var r = {
        total: 0, done: 0, undone: 0,
        priCounts: { high: 0, med: 0, low: 0 },
        weekdayCounts: [0,0,0,0,0,0,0],
        hourBuckets: [0,0,0,0],
        dailyCounts: {},
        categoryCounts: {},
        noCategoryCount: { total: 0, done: 0 },
        range: range, bounds: bounds
      };
      if (!Array.isArray(rawData)) return r;

      for (var i = 0; i < rawData.length; i++) {
        var row = rawData[i];
        r.total++;
        if (row.done === 1) r.done++; else r.undone++;

        if (row.priority === 'high') r.priCounts.high++;
        else if (row.priority === 'med') r.priCounts.med++;
        else r.priCounts.low++;

        var d = _statsParseDate(row.date);
        if (!isNaN(d.getTime())) {
          var wday = d.getDay();
          r.weekdayCounts[wday]++;
        }

        var hb = _parseHourBucket(row.time);
        if (hb >= 0) r.hourBuckets[hb]++;

        if (!r.dailyCounts[row.date]) r.dailyCounts[row.date] = { total: 0, done: 0 };
        r.dailyCounts[row.date].total++;
        if (row.done === 1) r.dailyCounts[row.date].done++;

        var catId = row.category_id || '';
        if (!catId) {
          r.noCategoryCount.total++;
          if (row.done === 1) r.noCategoryCount.done++;
        } else {
          if (!r.categoryCounts[catId]) r.categoryCounts[catId] = { total: 0, done: 0 };
          r.categoryCounts[catId].total++;
          if (row.done === 1) r.categoryCounts[catId].done++;
        }
      }
      r.trendBuckets = _buildTrendBuckets(bounds, rawData);
      return r;
    }

    function _parseHourBucket(timeStr) {
      if (!timeStr || typeof timeStr !== 'string') return -1;
      var m = /^(\\d{1,2}):/.exec(timeStr);
      if (!m) return -1;
      var h = parseInt(m[1], 10);
      if (isNaN(h) || h < 0 || h > 23) return -1;
      if (h < 6) return 0;
      if (h < 12) return 1;
      if (h < 18) return 2;
      return 3;
    }

    function _buildTrendBuckets(bounds, rawData) {
      var buckets = [];
      var bucket = bounds.bucket;

      if (bucket === 'day') {
        var cur = new Date(bounds.start);
        while (cur <= bounds.end) {
          var key = formatDate(cur);
          buckets.push({ label: key.slice(5), key: key, start: new Date(cur), end: new Date(cur), total: 0, done: 0 });
          cur.setDate(cur.getDate() + 1);
        }
      } else if (bucket === 'week') {
        // 本周一为最后一桶的起点
        var endMonday = new Date(bounds.end);
        var wd = endMonday.getDay();
        var diff = (wd === 0 ? -6 : 1 - wd);
        endMonday.setDate(endMonday.getDate() + diff);
        for (var i = 11; i >= 0; i--) {
          var ws = new Date(endMonday);
          ws.setDate(ws.getDate() - i * 7);
          var we = new Date(ws);
          we.setDate(we.getDate() + 6);
          buckets.push({
            label: (ws.getMonth() + 1) + '/' + ws.getDate(),
            start: ws, end: we, total: 0, done: 0
          });
        }
      } else {
        // month: 近 12 月 或 今年 12 月
        var isYear = (bounds.start.getMonth() === 0 && bounds.start.getDate() === 1);
        var baseY = bounds.end.getFullYear();
        var baseM = bounds.end.getMonth();
        var count = 12;
        for (var j = count - 1; j >= 0; j--) {
          var y = baseY;
          var mo = baseM - j;
          while (mo < 0) { mo += 12; y--; }
          var ms = new Date(y, mo, 1);
          var me = new Date(y, mo + 1, 0);
          buckets.push({
            label: isYear ? ((mo + 1) + '月') : ((mo + 1) + '/' + y),
            start: ms, end: me, total: 0, done: 0
          });
        }
      }

      // 填充
      var bStart = buckets[0] && buckets[0].start;
      var bEnd = buckets[buckets.length - 1] && buckets[buckets.length - 1].end;
      if (!bStart || !bEnd) return buckets;

      for (var k = 0; k < rawData.length; k++) {
        var row = rawData[k];
        var d = _statsParseDate(row.date);
        if (isNaN(d.getTime())) continue;
        if (d < bStart || d > bEnd) continue;
        // 二分定位最近桶（buckets 是按时间递增的）
        var lo = 0, hi = buckets.length - 1, idx = -1;
        while (lo <= hi) {
          var mid = (lo + hi) >> 1;
          if (d >= buckets[mid].start && d <= buckets[mid].end) { idx = mid; break; }
          if (d < buckets[mid].start) hi = mid - 1; else lo = mid + 1;
        }
        if (idx >= 0) {
          buckets[idx].total++;
          if (row.done === 1) buckets[idx].done++;
        }
      }
      return buckets;
    }

    // ---------- 渲染：时间范围统计 ----------
    function _renderRangeStats(rawData, range, bounds) {
      var t = _statsTheme();
      cachedThemeKey = t.isLight ? 'light' : 'dark';

      var agg = _aggregate(rawData, range, bounds);

      _renderSummary(agg, range);
      // 本周：显示每日柱状图，不显示热力图（数据量太小不直观）
      // 12周/6月/今年：显示热力图，隐藏每日柱状图
      var showHeatmap = (range !== 'week');
      _toggleVisible('chart-heatmap-wrap', showHeatmap);
      if (showHeatmap) _renderHeatmap(agg, t, range, bounds);
      _renderTrend(agg, t, range);
      _toggleVisible('chart-bar-wrap', range === 'week');
      if (range === 'week') _renderDailyBar(agg, t);
      _renderWeekday(agg, t, 'chart-weekday');
      _renderHour(agg, t, 'chart-hour');
      _renderPriorityPie(agg, t);
      _renderStatusPie(agg, t);
      _renderCategoryRank(agg, t);
    }

    function _toggleVisible(wrapId, visible) {
      var el = document.getElementById(wrapId);
      if (el) el.classList.toggle('hidden-by-range', !visible);
    }

    function _renderSummary(agg, range) {
      var doneRate = agg.total > 0 ? (agg.done / agg.total * 100) : 0;
      var activeDays = Object.keys(agg.dailyCounts).length;
      var el = document.getElementById('stats-summary-row');
      if (!el) return;
      el.innerHTML =
        _summaryCard(agg.total, '总事项') +
        _summaryCard(agg.done, '已完成') +
        _summaryCard(doneRate.toFixed(1) + '%', '完成率') +
        _summaryCard(activeDays, '活跃天数');
    }

    function _summaryCard(value, label) {
      return '<div class="stats-summary-card">' +
        '<div class="stats-summary-value">' + value + '</div>' +
        '<div class="stats-summary-label">' + label + '</div>' +
      '</div>';
    }

    function _renderHeatmap(agg, t, range, bounds) {
      var inst = _getChart('heatmap', 'chart-heatmap');
      if (!inst) return;
      var data = [];
      var cur = new Date(bounds.start);
      while (cur <= bounds.end) {
        var key = formatDate(cur);
        var c = agg.dailyCounts[key] ? agg.dailyCounts[key].total : 0;
        data.push([key, c]);
        cur.setDate(cur.getDate() + 1);
      }
      var maxV = 1;
      for (var i = 0; i < data.length; i++) if (data[i][1] > maxV) maxV = data[i][1];

      // 响应式：根据容器宽度选择 cellSize，避免在窄屏挤压
      var wrap = document.getElementById('chart-heatmap');
      var wrapW = wrap ? wrap.clientWidth : 600;
      var isNarrow = wrapW < 420;
      // 6m/year 数据较多时 cellSize 自动缩小
      var cellSize = 13;
      if (range === '12w') cellSize = isNarrow ? 11 : 14;
      else if (range === '6m') cellSize = isNarrow ? 9 : 11;
      else if (range === 'year') cellSize = isNarrow ? 7 : 10;
      else cellSize = isNarrow ? 11 : 13;

      inst.setOption({
        tooltip: {
          formatter: function(p) { return p.data[0] + '<br/>事项数：' + p.data[1]; },
          confine: true,           // 限制在容器内，避免溢出
          appendToBody: false
        },
        visualMap: {
          min: 0, max: maxV, calculable: false, orient: 'horizontal',
          left: 'center', bottom: 0, show: !isNarrow,   // 窄屏隐藏图例避免遮挡
          itemWidth: 12, itemHeight: 50,
          inRange: { color: [t.heat0, t.heat1, t.heat2, t.heat3, t.heat4] },
          textStyle: { color: t.text, fontSize: 10 }
        },
        calendar: {
          top: 20, left: isNarrow ? 25 : 40, right: isNarrow ? 8 : 20, bottom: isNarrow ? 10 : 30,
          range: [formatDate(bounds.start), formatDate(bounds.end)],
          cellSize: cellSize,
          itemStyle: { color: t.heat0, borderColor: t.isLight ? '#cccccc' : '#0a0a0a', borderWidth: 1 },
          splitLine: { show: false },
          yearLabel: { show: false },
          monthLabel: { color: t.gray, fontSize: isNarrow ? 9 : 10, nameMap: 'cn' },
          dayLabel: { color: t.gray, fontSize: isNarrow ? 8 : 9, firstDay: 1, nameMap: 'cn' }
        },
        series: [{
          type: 'heatmap', coordinateSystem: 'calendar', data: data,
          itemStyle: { borderColor: t.isLight ? '#cccccc' : '#0a0a0a', borderWidth: 1 }
        }]
      }, true);
    }

    // 容器宽度判断：用于响应式字号/边距
    function _isNarrowView() {
      var root = document.getElementById('stats-overlay');
      if (!root) return false;
      return root.clientWidth < 480;
    }

    function _renderTrend(agg, t, range) {
      var inst = _getChart('trend', 'chart-trend');
      if (!inst) return;
      var labels = [], totals = [], dones = [], rates = [];
      for (var i = 0; i < agg.trendBuckets.length; i++) {
        var b = agg.trendBuckets[i];
        labels.push(b.label);
        totals.push(b.total);
        dones.push(b.done);
        rates.push(b.total > 0 ? Math.round(b.done / b.total * 100) : 0);
      }
      var isNarrow = _isNarrowView();
      // 窄屏：减少标签数量避免拥挤（隔点显示）
      var xInterval = isNarrow ? Math.max(0, Math.floor(labels.length / 6) - 1) : 0;
      inst.setOption({
        tooltip: { trigger: 'axis', confine: true },
        legend: { data: ['总事项', '已完成', '完成率'], top: 0, textStyle: { color: t.text, fontSize: isNarrow ? 10 : 11 }, itemWidth: 12, itemHeight: 8 },
        grid: { top: 30, left: isNarrow ? 32 : 40, right: isNarrow ? 32 : 40, bottom: 25 },
        xAxis: {
          type: 'category', data: labels,
          axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10, interval: xInterval },
          axisLine: { lineStyle: { color: t.border } }
        },
        yAxis: [
          {
            type: 'value', name: '事项数', nameTextStyle: { color: t.gray, fontSize: 9 },
            axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10 },
            splitLine: { lineStyle: { color: t.splitLine } },
            axisLine: { show: false }
          },
          {
            type: 'value', name: '完成率(%)', min: 0, max: 100,
            nameTextStyle: { color: t.gray, fontSize: 9 },
            axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10, formatter: '{value}%' },
            splitLine: { show: false }, axisLine: { show: false }
          }
        ],
        series: [
          { name: '总事项', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: totals,
            lineStyle: { color: t.gray, width: 2 }, itemStyle: { color: t.gray } },
          { name: '已完成', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: dones,
            lineStyle: { color: t.accent, width: 2 }, itemStyle: { color: t.accent } },
          { name: '完成率', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'diamond', symbolSize: 5, data: rates,
            lineStyle: { color: t.success, width: 2, type: 'dashed' }, itemStyle: { color: t.success } }
        ]
      }, true);
    }

    function _renderDailyBar(agg, t) {
      var inst = _getChart('bar', 'chart-bar');
      if (!inst) return;
      var labels = [], totals = [], dones = [];
      var keys = Object.keys(agg.dailyCounts).sort();
      for (var i = 0; i < keys.length; i++) {
        labels.push(keys[i].slice(5));
        totals.push(agg.dailyCounts[keys[i]].total);
        dones.push(agg.dailyCounts[keys[i]].done);
      }
      var isNarrow = _isNarrowView();
      inst.setOption({
        tooltip: { trigger: 'axis', confine: true },
        legend: { data: ['当日总事项', '当日完成事项'], top: 0, textStyle: { color: t.text, fontSize: isNarrow ? 10 : 11 }, itemWidth: 12, itemHeight: 8 },
        grid: { top: 30, left: isNarrow ? 30 : 35, right: 12, bottom: 25 },
        xAxis: { type: 'category', data: labels, axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10 }, axisLine: { lineStyle: { color: t.border } } },
        yAxis: { type: 'value', minInterval: 1, axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10 }, splitLine: { lineStyle: { color: t.splitLine } }, axisLine: { show: false } },
        series: [
          { name: '当日总事项', type: 'bar', data: totals, itemStyle: { color: t.panel, borderColor: t.border, borderWidth: 1 } },
          { name: '当日完成事项', type: 'bar', data: dones, itemStyle: { color: t.accent } }
        ]
      }, true);
    }

    function _renderWeekday(agg, t, domId) {
      var inst = _getChart(domId, domId);
      if (!inst) return;
      var labels = ['周一','周二','周三','周四','周五','周六','周日'];
      var data = [];
      for (var i = 1; i <= 7; i++) {
        var idx = (i === 7) ? 0 : i;
        data.push(agg.weekdayCounts[idx]);
      }
      var isNarrow = _isNarrowView();
      inst.setOption({
        tooltip: { trigger: 'axis', confine: true },
        grid: { top: 15, left: isNarrow ? 28 : 35, right: 10, bottom: 25 },
        xAxis: { type: 'category', data: labels, axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10 }, axisLine: { lineStyle: { color: t.border } } },
        yAxis: { type: 'value', minInterval: 1, axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10 }, splitLine: { lineStyle: { color: t.splitLine } }, axisLine: { show: false } },
        series: [{ type: 'bar', data: data, itemStyle: { color: t.accent }, label: { show: !isNarrow, position: 'top', color: t.text, fontSize: 10 } }]
      }, true);
    }

    function _renderHour(agg, t, domId) {
      var inst = _getChart(domId, domId);
      if (!inst) return;
      var isNarrow = _isNarrowView();
      // 窄屏：标签更紧凑
      var labels = isNarrow
        ? ['凌晨', '上午', '下午', '晚上']
        : ['凌晨\\n0-6', '上午\\n6-12', '下午\\n12-18', '晚上\\n18-24'];
      var data = agg.hourBuckets.slice();
      var colorList = [t.gray, t.accent, t.warn, t.success];
      inst.setOption({
        tooltip: { trigger: 'item', confine: true },
        grid: { top: 15, left: isNarrow ? 28 : 35, right: 10, bottom: isNarrow ? 25 : 35 },
        xAxis: { type: 'category', data: labels, axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 9 }, axisLine: { lineStyle: { color: t.border } } },
        yAxis: { type: 'value', minInterval: 1, axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10 }, splitLine: { lineStyle: { color: t.splitLine } }, axisLine: { show: false } },
        series: [{
          type: 'bar', data: data,
          itemStyle: { color: function(p) { return colorList[p.dataIndex] || t.accent; } },
          label: { show: !isNarrow, position: 'top', color: t.text, fontSize: 10 }
        }]
      }, true);
    }

    function _renderPriorityPie(agg, t) {
      var inst = _getChart('pri', 'chart-pie-priority');
      if (!inst) return;
      var total = agg.priCounts.high + agg.priCounts.med + agg.priCounts.low;
      var data = [
        { name: '高', value: agg.priCounts.high, itemStyle: { color: t.accent } },
        { name: '中', value: agg.priCounts.med, itemStyle: { color: t.warn } },
        { name: '低', value: agg.priCounts.low, itemStyle: { color: t.gray } }
      ];
      var isNarrow = _isNarrowView();
      inst.setOption({
        tooltip: { trigger: 'item', confine: true, formatter: function(p) {
          var pct = total === 0 ? 0 : Math.round(p.value / total * 100);
          return p.name + '优先<br/>数量：' + p.value + '<br/>占比：' + pct + '%';
        }},
        legend: { bottom: 0, textStyle: { color: t.text, fontSize: isNarrow ? 10 : 11 }, itemWidth: 12, itemHeight: 8 },
        series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'], avoidLabelOverlap: true, label: { show: false }, labelLine: { show: false }, data: data }]
      }, true);
    }

    function _renderStatusPie(agg, t) {
      var inst = _getChart('status', 'chart-pie-status');
      if (!inst) return;
      var total = agg.done + agg.undone;
      var data = [
        { name: '已完成', value: agg.done, itemStyle: { color: t.success } },
        { name: '未完成', value: agg.undone, itemStyle: { color: t.gray } }
      ];
      var isNarrow = _isNarrowView();
      inst.setOption({
        tooltip: { trigger: 'item', confine: true, formatter: function(p) {
          var pct = total === 0 ? 0 : Math.round(p.value / total * 100);
          return p.name + '<br/>数量：' + p.value + '<br/>占比：' + pct + '%';
        }},
        legend: { bottom: 0, textStyle: { color: t.text, fontSize: isNarrow ? 10 : 11 }, itemWidth: 12, itemHeight: 8 },
        series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'], label: { show: false }, labelLine: { show: false }, data: data }]
      }, true);
    }

    function _renderCategoryRank(agg, t) {
      var el = document.getElementById('chart-category-list');
      if (!el) return;
      var items = [];
      var cats = Array.isArray(cachedCategories) ? cachedCategories : [];
      for (var i = 0; i < cats.length; i++) {
        var c = cats[i];
        var s = agg.categoryCounts[c.id];
        if (!s || s.total === 0) continue;
        items.push({
          name: c.name || '未命名',
          color: c.color || t.gray,
          total: s.total, done: s.done,
          rate: s.total > 0 ? (s.done / s.total * 100) : 0
        });
      }
      if (agg.noCategoryCount.total > 0) {
        items.push({
          name: '未分类', color: t.gray,
          total: agg.noCategoryCount.total,
          done: agg.noCategoryCount.done,
          rate: agg.noCategoryCount.total > 0 ? (agg.noCategoryCount.done / agg.noCategoryCount.total * 100) : 0
        });
      }
      items.sort(function(a, b) { return b.total - a.total; });

      if (items.length === 0) {
        el.innerHTML = '<div class="category-rank-empty">该时段内暂无分类事项。</div>';
        return;
      }
      var maxTotal = 1;
      for (var k = 0; k < items.length; k++) if (items[k].total > maxTotal) maxTotal = items[k].total;

      var html = '';
      var top = items.slice(0, 10);
      for (var m = 0; m < top.length; m++) {
        var it = top[m];
        var totalW = (it.total / maxTotal * 100);
        var doneW = (it.done / maxTotal * 100);
        html += '<div class="category-rank-item">' +
          '<div class="category-rank-rank">' + (m + 1) + '</div>' +
          '<div class="category-rank-name">' +
            '<span class="category-rank-dot" style="background:' + it.color + '"></span>' +
            '<span>' + escapeHtml(it.name) + '</span>' +
          '</div>' +
          '<div class="category-rank-count">' + it.done + '/' + it.total + ' (' + it.rate.toFixed(0) + '%)</div>' +
          '<div class="category-rank-bar-wrap">' +
            '<div class="category-rank-bar-total" style="width:' + totalW + '%"></div>' +
            '<div class="category-rank-bar-done" style="width:' + doneW + '%"></div>' +
          '</div>' +
        '</div>';
      }
      el.innerHTML = html;
    }

    // ==================== 年度报告 ====================
    async function loadAnnualReport() {
      var reportYear = getAnnualReportYear();
      if (reportYear === null) return;
      annualYear = reportYear;
      var loading = document.getElementById('annual-loading');
      var content = document.getElementById('annual-content');
      if (!loading || !content) return;
      loading.classList.remove('hidden');
      content.classList.add('hidden');
      loading.innerText = '年度数据加载中...';

      var startStr = annualYear + '-01-01';
      var endStr = annualYear + '-12-31';

      try {
        var res = await fetch('/api/stats?start=' + startStr + '&end=' + endStr);
        if (!res.ok) { loading.innerText = '年度数据拉取失败。'; return; }
        var rawData = await res.json();
        if (!cachedCategories) {
          try {
            var cres = await fetch('/api/categories');
            cachedCategories = cres.ok ? (await cres.json()) : [];
          } catch(e) { cachedCategories = []; }
        }
        // 先让容器可见，再渲染 ECharts，避免 canvas 尺寸为 0
        loading.classList.add('hidden');
        content.classList.remove('hidden');
        _renderAnnualReport(rawData);
        _resizeAllCharts();
      } catch(e) {
        loading.innerText = '网络请求异常。';
      }
    }

    function _aggregateAnnual(rawData) {
      var agg = {
        total: 0, done: 0, undone: 0, doneRate: 0,
        priCounts: { high: 0, med: 0, low: 0 },
        priDone: { high: 0, med: 0, low: 0 },
        monthData: [], quarterTotals: [0,0,0,0], quarterDones: [0,0,0,0],
        weekdayCounts: [0,0,0,0,0,0,0],
        hourBuckets: [0,0,0,0],
        dailyCounts: {},
        categoryCounts: {}, noCategoryCount: { total: 0, done: 0 },
        firstHalf: 0, secondHalf: 0,
        weekdayTotal: 0, weekdayDone: 0,
        weekendTotal: 0, weekendDone: 0,
        busiestMonth: -1, busiestMonthCount: 0,
        busiestDate: '--', busiestDateCount: 0,
        activeDays: 0, maxStreak: 0, avgPerActiveDay: 0,
        categoryRanking: []
      };
      for (var mi = 0; mi < 12; mi++) agg.monthData.push({ total: 0, done: 0 });
      if (!Array.isArray(rawData)) return agg;

      for (var i = 0; i < rawData.length; i++) {
        var row = rawData[i];
        agg.total++;
        if (row.done === 1) agg.done++; else agg.undone++;
        if (row.priority === 'high') { agg.priCounts.high++; if (row.done === 1) agg.priDone.high++; }
        else if (row.priority === 'med') { agg.priCounts.med++; if (row.done === 1) agg.priDone.med++; }
        else { agg.priCounts.low++; if (row.done === 1) agg.priDone.low++; }

        var month = parseInt((row.date || '').slice(5, 7), 10) - 1;
        if (month >= 0 && month < 12) {
          agg.monthData[month].total++;
          if (row.done === 1) agg.monthData[month].done++;
          var q = Math.floor(month / 3);
          agg.quarterTotals[q]++;
          if (row.done === 1) agg.quarterDones[q]++;
          if (month < 6) agg.firstHalf++; else agg.secondHalf++;
        }

        var d = _statsParseDate(row.date);
        if (!isNaN(d.getTime())) {
          var wday = d.getDay();
          agg.weekdayCounts[wday]++;
          if (wday === 0 || wday === 6) { agg.weekendTotal++; if (row.done === 1) agg.weekendDone++; }
          else { agg.weekdayTotal++; if (row.done === 1) agg.weekdayDone++; }
        }

        var hb = _parseHourBucket(row.time);
        if (hb >= 0) agg.hourBuckets[hb]++;

        if (!agg.dailyCounts[row.date]) agg.dailyCounts[row.date] = { total: 0, done: 0 };
        agg.dailyCounts[row.date].total++;
        if (row.done === 1) agg.dailyCounts[row.date].done++;

        var catId = row.category_id || '';
        if (!catId) {
          agg.noCategoryCount.total++;
          if (row.done === 1) agg.noCategoryCount.done++;
        } else {
          if (!agg.categoryCounts[catId]) agg.categoryCounts[catId] = { total: 0, done: 0 };
          agg.categoryCounts[catId].total++;
          if (row.done === 1) agg.categoryCounts[catId].done++;
        }
      }

      agg.doneRate = agg.total > 0 ? (agg.done / agg.total * 100) : 0;
      agg.activeDays = Object.keys(agg.dailyCounts).length;
      agg.avgPerActiveDay = agg.activeDays > 0 ? (agg.total / agg.activeDays) : 0;

      for (var mi2 = 0; mi2 < 12; mi2++) {
        if (agg.monthData[mi2].total > agg.busiestMonthCount) {
          agg.busiestMonthCount = agg.monthData[mi2].total;
          agg.busiestMonth = mi2;
        }
      }
      for (var dk in agg.dailyCounts) {
        if (agg.dailyCounts[dk].total > agg.busiestDateCount) {
          agg.busiestDateCount = agg.dailyCounts[dk].total;
          agg.busiestDate = dk;
        }
      }
      agg.maxStreak = _computeMaxStreak(agg.dailyCounts);

      var cats = Array.isArray(cachedCategories) ? cachedCategories : [];
      for (var ci = 0; ci < cats.length; ci++) {
        var c = cats[ci];
        var s = agg.categoryCounts[c.id];
        if (!s || s.total === 0) continue;
        agg.categoryRanking.push({
          id: c.id, name: c.name || '未命名', color: c.color || '#888',
          total: s.total, done: s.done
        });
      }
      if (agg.noCategoryCount.total > 0) {
        agg.categoryRanking.push({
          id: '', name: '未分类', color: '#888',
          total: agg.noCategoryCount.total, done: agg.noCategoryCount.done
        });
      }
      agg.categoryRanking.sort(function(a, b) { return b.total - a.total; });
      return agg;
    }

    function _computeMaxStreak(dailyCounts) {
      var dates = Object.keys(dailyCounts).sort();
      if (dates.length === 0) return 0;
      var max = 1, cur = 1;
      for (var i = 1; i < dates.length; i++) {
        var prev = _statsParseDate(dates[i - 1]);
        var now = _statsParseDate(dates[i]);
        var diff = Math.round((now - prev) / 86400000);
        if (diff === 1) { cur++; if (cur > max) max = cur; }
        else cur = 1;
      }
      return max;
    }

    function _renderAnnualReport(rawData) {
      var t = _statsTheme();
      cachedThemeKey = t.isLight ? 'light' : 'dark';
      var content = document.getElementById('annual-content');
      if (!content) return;
      var agg = _aggregateAnnual(rawData);
      var ending = _determineAnnualEnding(agg);
      var narrative = _generateAnnualNarrative(agg);

      var html = '';
      html += '<div class="annual-year-title"><span>' + annualYear + ' 年度报告</span></div>';
      html += '<div class="annual-hero">';
      html += '<div class="annual-ending-title">' + ending.title + '</div>';
      html += '<div class="annual-ending-subtitle">' + ending.subtitle + '</div>';
      html += '<div class="annual-ending-desc">' + ending.desc + '</div>';
      html += '</div>';
      html += '<div class="annual-divider">◆ ◆ ◆</div>';

      // 核心数据 6 卡片
      html += '<div class="annual-section-title">核心数据</div>';
      html += '<div class="annual-stats-grid">';
      html += '<div class="annual-stat-card"><div class="annual-stat-value">' + agg.total + '</div><div class="annual-stat-label">总事项</div></div>';
      html += '<div class="annual-stat-card"><div class="annual-stat-value">' + agg.done + '</div><div class="annual-stat-label">已完成</div></div>';
      html += '<div class="annual-stat-card"><div class="annual-stat-value">' + agg.doneRate.toFixed(1) + '%</div><div class="annual-stat-label">完成率</div></div>';
      html += '<div class="annual-stat-card"><div class="annual-stat-value">' + agg.activeDays + '</div><div class="annual-stat-label">活跃天数</div></div>';
      html += '<div class="annual-stat-card"><div class="annual-stat-value">' + agg.maxStreak + '</div><div class="annual-stat-label">最长连续</div></div>';
      html += '<div class="annual-stat-card"><div class="annual-stat-value">' + agg.avgPerActiveDay.toFixed(1) + '</div><div class="annual-stat-label">日均事项</div></div>';
      html += '</div>';

      // 季度对比
      html += '<div class="annual-section-title">季度对比</div>';
      html += '<div class="annual-compare-grid">';
      var qMax = Math.max(agg.quarterTotals[0], agg.quarterTotals[1], agg.quarterTotals[2], agg.quarterTotals[3], 1);
      var qNames = ['第一季度', '第二季度', '第三季度', '第四季度'];
      for (var qi = 0; qi < 4; qi++) {
        var qt = agg.quarterTotals[qi];
        var qd = agg.quarterDones[qi];
        var isWin = (qt === qMax && qt > 0);
        html += _compareCard(qNames[qi], qt, qd, isWin, qMax);
      }
      html += '</div>';

      // 上下半年对比
      html += '<div class="annual-section-title">上下半年对比</div>';
      html += '<div class="annual-compare-grid">';
      var fhDone = 0, shDone = 0;
      for (var fmi = 0; fmi < 6; fmi++) fhDone += agg.monthData[fmi].done;
      for (var smi = 6; smi < 12; smi++) shDone += agg.monthData[smi].done;
      var halfMax = Math.max(agg.firstHalf, agg.secondHalf, 1);
      html += _compareCard('上半年', agg.firstHalf, fhDone, agg.firstHalf >= agg.secondHalf && agg.firstHalf > 0, halfMax);
      html += _compareCard('下半年', agg.secondHalf, shDone, agg.secondHalf > agg.firstHalf && agg.secondHalf > 0, halfMax);
      html += '</div>';

      // 工作日 vs 周末
      html += '<div class="annual-section-title">工作日 vs 周末</div>';
      html += '<div class="annual-compare-grid">';
      var wdMax = Math.max(agg.weekdayTotal, agg.weekendTotal, 1);
      html += _compareCard('工作日 (周一至周五)', agg.weekdayTotal, agg.weekdayDone, agg.weekdayTotal >= agg.weekendTotal && agg.weekdayTotal > 0, wdMax);
      html += _compareCard('周末 (周六、周日)', agg.weekendTotal, agg.weekendDone, agg.weekendTotal > agg.weekdayTotal && agg.weekendTotal > 0, wdMax);
      html += '</div>';

      // 优先级完成率对比
      html += '<div class="annual-section-title">优先级完成率对比</div>';
      html += '<div class="annual-compare-grid">';
      var priList = [
        { label: '高优先级', counts: agg.priCounts.high, done: agg.priDone.high, color: t.accent },
        { label: '中优先级', counts: agg.priCounts.med, done: agg.priDone.med, color: t.warn },
        { label: '低优先级', counts: agg.priCounts.low, done: agg.priDone.low, color: t.gray }
      ];
      var priMax2 = Math.max(priList[0].counts, priList[1].counts, priList[2].counts, 1);
      for (var pi = 0; pi < priList.length; pi++) {
        var p = priList[pi];
        var isWin = (p.counts === priMax2 && p.counts > 0);
        html += _compareCard(p.label, p.counts, p.done, isWin, priMax2, p.color);
      }
      html += '</div>';

      // 月度活跃度
      html += '<div class="annual-section-title">月度活跃度</div>';
      html += '<div class="annual-chart-block">';
      html += '<div class="annual-chart-title">月度事项总数 vs 完成数</div>';
      html += '<div id="annual-chart-month" class="chart-canvas"></div>';
      html += '</div>';

      // 全年热力图
      html += '<div class="annual-section-title">全年活跃热力图</div>';
      html += '<div class="annual-chart-block">';
      html += '<div class="annual-chart-title">GitHub 风格贡献图</div>';
      html += '<div id="annual-chart-heatmap" class="chart-canvas" style="height:200px;"></div>';
      html += '</div>';

      // 周日分布 + 时段分布
      html += '<div class="annual-section-title">习惯分布</div>';
      html += '<div class="stats-row-bottom">';
      html += '<div class="annual-chart-block" style="margin-bottom:0;">';
      html += '<div class="annual-chart-title">周日分布</div>';
      html += '<div id="annual-chart-weekday" class="chart-canvas"></div>';
      html += '</div>';
      html += '<div class="annual-chart-block" style="margin-bottom:0;">';
      html += '<div class="annual-chart-title">时段分布</div>';
      html += '<div id="annual-chart-hour" class="chart-canvas"></div>';
      html += '</div>';
      html += '</div>';

      // 分类排行 Top 5
      if (agg.categoryRanking.length > 0) {
        html += '<div class="annual-section-title">分类排行 Top 5</div>';
        html += '<div class="annual-rank-list">';
        var top5 = agg.categoryRanking.slice(0, 5);
        for (var ri = 0; ri < top5.length; ri++) {
          var it = top5[ri];
          var r = it.total > 0 ? (it.done / it.total * 100).toFixed(0) : '0';
          html += '<div class="annual-rank-item">';
          html += '<div class="annual-rank-rank">' + (ri + 1) + '</div>';
          html += '<div class="annual-rank-name"><span class="category-rank-dot" style="background:' + it.color + '; margin-right:6px;"></span>' + escapeHtml(it.name) + '</div>';
          html += '<div class="annual-rank-count">' + it.done + '/' + it.total + ' (' + r + '%)</div>';
          html += '</div>';
        }
        html += '</div>';
      }

      html += '<div class="annual-divider">◆ ◆ ◆</div>';
      html += '<div class="annual-section-title">年度叙事</div>';
      html += '<div class="annual-narrative">' + narrative +
        '<div class="annual-report-time">统计周期：' + annualYear + '-01-01 至 ' + annualYear + '-12-31<br>显示截止：' + getAnnualExpiryTime() + '</div></div>';

      content.innerHTML = html;

      _renderAnnualMonthChart(agg, t);
      _renderAnnualHeatmap(agg, t);
      _renderWeekday(agg, t, 'annual-chart-weekday');
      _renderHour(agg, t, 'annual-chart-hour');
    }

    function _compareCard(label, total, done, isWinner, maxV, color) {
      var r = total > 0 ? (done / total * 100) : 0;
      var w = maxV > 0 ? (total / maxV * 100) : 0;
      var fillStyle = color ? ('background:' + color + ';') : '';
      return '<div class="annual-compare-card' + (isWinner ? ' winner' : '') + '">' +
        '<div class="annual-compare-card-label">' + label + '</div>' +
        '<div class="annual-compare-card-value">' + total + '</div>' +
        '<div class="annual-compare-card-sub">完成 ' + done + ' (' + r.toFixed(0) + '%)</div>' +
        '<div class="annual-compare-card-bar"><div class="annual-compare-card-bar-fill" style="width:' + w + '%;' + fillStyle + '"></div></div>' +
      '</div>';
    }

    function _determineAnnualEnding(agg) {
      var totalTasks = agg.total;
      var doneRate = agg.doneRate;
      var highPriRate = agg.total > 0 ? (agg.priCounts.high / agg.total * 100) : 0;
      var medPriRate = agg.total > 0 ? (agg.priCounts.med / agg.total * 100) : 0;
      var lowPriRate = agg.total > 0 ? (agg.priCounts.low / agg.total * 100) : 0;

      if (totalTasks < 5) {
        return { title: '空白画布', subtitle: 'THE BLANK CANVAS',
          desc: '这一年，你选择了留下大片空白。也许是没有什么需要记录，也许是最好的待办就是没有待办。空白不是虚无——它是等待被书写的可能性。下一年，你会落笔吗？' };
      }
      if (doneRate >= 80 && totalTasks >= 50) {
        return { title: '效率引擎', subtitle: 'THE EFFICIENCY ENGINE',
          desc: '你将待办清单视为战场，80%以上的任务被你无情终结。每一条划掉的待办，都是一次对混沌的宣战。你是秩序的信徒，效率的化身。在你面前，没有任何一条待办能活过明天。' };
      }
      if (doneRate < 30 && totalTasks >= 20) {
        return { title: '拖延哲学家', subtitle: 'THE PROCRASTINATION PHILOSOPHER',
          desc: '你不是在拖延——你是在思考。那些未完成的待办，每一个都承载着深邃的犹豫与无限的可能。也许明天，也许下辈子，它们终将被完成。至少，你写下了它们。' };
      }
      if (highPriRate > 40 && doneRate >= 60) {
        return { title: '战略规划师', subtitle: 'THE STRATEGIC PLANNER',
          desc: '你只关注真正重要的事。高优先级是你的武器，完成率是你的战绩。无关紧要的事？不配出现在你的清单上。你不是在做待办——你是在指挥战役。' };
      }
      if (totalTasks < 30 && doneRate >= 70) {
        return { title: '精准打击者', subtitle: 'THE PRECISION STRIKER',
          desc: '少即是多。你不贪多，但每一发都命中靶心。你的待办清单短小精悍，却弹无虚发。真正的高手，从不需要满屏的红点来证明自己的存在。' };
      }
      if (totalTasks >= 100 && doneRate < 50) {
        return { title: '待办收藏家', subtitle: 'THE TODO COLLECTOR',
          desc: '你的待办清单是一座博物馆。每一项都被精心收藏，却鲜有人问津。但谁知道呢？也许某天你会打开它，然后惊叹于自己曾经的野心和想象。' };
      }
      if (agg.firstHalf > 0 && agg.firstHalf > agg.secondHalf * 2) {
        return { title: '开局王者', subtitle: 'THE QUICK STARTER',
          desc: '年初的你意气风发，雄心万丈。但时间是最好的稀释剂。你的故事总是从"这次一定"开始，然后以"下次再说"收尾。但至少，你的开局总是漂亮的。' };
      }
      if (agg.secondHalf > agg.firstHalf * 2 && agg.firstHalf > 0) {
        return { title: '后发制人', subtitle: 'THE LATE BLOOMER',
          desc: '上半年还在酝酿，下半年突然爆发。你用实际行动证明了：重要的不是何时开始，而是何时发力。厚积薄发，大器晚成——说的就是你。' };
      }
      var priArr = [highPriRate, medPriRate, lowPriRate];
      var maxPriDiff = Math.max.apply(null, priArr) - Math.min.apply(null, priArr);
      if (maxPriDiff < 20 && doneRate >= 55 && doneRate <= 85) {
        return { title: '均衡大师', subtitle: 'THE BALANCE MASTER',
          desc: '高、中、低优先级在你手中均匀分布。你不偏废，不冒进，以中庸之道驾驭时间。这世上没有你特别在意的事，也没有你愿意放弃的事——也许这就是最大的智慧。' };
      }
      if (doneRate >= 50 && doneRate < 80 && totalTasks >= 30 && totalTasks < 100) {
        return { title: '从容行者', subtitle: 'THE STEADY WALKER',
          desc: '不急不躁，按自己的节奏前行。你完成的每一件事都有分量，未完成的也不过是留给未来的礼物。你不需要被定义——你的待办清单，就是你自己。' };
      }
      if (doneRate >= 30 && doneRate < 50 && totalTasks >= 30) {
        return { title: '半途旅人', subtitle: 'THE HALFWAY TRAVELER',
          desc: '你开始了，但经常没有到达。这不丢人——每一段旅程都有意义，即使没有走到终点。你的清单上写满了"进行中"，而"进行中"本身就是一种态度。' };
      }
      return { title: '待办探索者', subtitle: 'THE TODO EXPLORER',
        desc: '你在待办的世界里漫游，不为征服，只为探索。每一条记录都是一次尝试，每一次完成都是一次惊喜。没有KPI，没有目标——只有你和你的清单。' };
    }

    function _generateAnnualNarrative(agg) {
      var monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
      var n = '';
      n += '<strong>' + annualYear + '</strong> 年，你一共创建了 <em>' + agg.total + '</em> 条待办事项。';
      if (agg.total === 0) {
        n += '这一年你的清单空空如也。也许你活在当下，从不需要计划——又或者，你本身就是最好的计划。';
        return n;
      }
      n += '其中 <em>' + agg.done + '</em> 条被你亲手终结，完成率 <em>' + agg.doneRate.toFixed(1) + '%</em>。';
      if (agg.doneRate >= 90) n += '这是一个令人敬畏的数字。你的清单上几乎没有逃脱者。';
      else if (agg.doneRate >= 70) n += '大多数任务没能逃过你的追击，少数幸存者大概在瑟瑟发抖。';
      else if (agg.doneRate >= 50) n += '一半做了，一半没做。这大概是世界上最诚实的比例。';
      else if (agg.doneRate >= 30) n += '虽然完成的不多，但每一条都是诚意之作……大概吧。';
      else n += '你的待办清单更像是一个许愿池——扔进去的硬币，偶尔会发光。';

      n += '<br><br>';
      n += '你在 <em>' + agg.activeDays + '</em> 个不同的日子里打开了这个应用，';
      n += '平均每个活跃日 <em>' + agg.avgPerActiveDay.toFixed(1) + '</em> 条事项，';
      n += '最长的一次连续活跃 <em>' + agg.maxStreak + '</em> 天。';
      if (agg.activeDays >= 300) n += '几乎没有一天缺席——你比打卡机还准时。';
      else if (agg.activeDays >= 200) n += '一年三分之二的时间你都在这里，这已经不是习惯，是信仰。';
      else if (agg.activeDays >= 100) n += '三天打鱼两天晒网？不，你只是选择在重要的日子出现。';
      else if (agg.activeDays >= 30) n += '偶尔来看看，确认清单还在，然后离开。这也是一种使用方式。';
      else n += '你来去如风，像一位神秘的访客。清单记得你来过。';

      n += '<br><br>';
      // 季度对比叙事
      var qMax = 0, qMaxIdx = -1, qMin = Infinity, qMinIdx = -1;
      for (var qi = 0; qi < 4; qi++) {
        if (agg.quarterTotals[qi] > qMax) { qMax = agg.quarterTotals[qi]; qMaxIdx = qi; }
        if (agg.quarterTotals[qi] > 0 && agg.quarterTotals[qi] < qMin) { qMin = agg.quarterTotals[qi]; qMinIdx = qi; }
      }
      var qNames = ['一季度','二季度','三季度','四季度'];
      if (qMaxIdx >= 0) {
        n += '从季度对比看，<strong>' + qNames[qMaxIdx] + '</strong> 是你最忙的时段，共 <em>' + qMax + '</em> 条事项。';
        if (qMinIdx >= 0 && qMinIdx !== qMaxIdx) {
          n += '相比之下，<strong>' + qNames[qMinIdx] + '</strong> 仅 <em>' + qMin + '</em> 条，差了 <em>' + (qMax - qMin) + '</em> 条。';
        }
      }

      n += '<br><br>';
      if (agg.firstHalf > 0 || agg.secondHalf > 0) {
        if (agg.firstHalf > agg.secondHalf * 1.5 && agg.secondHalf > 0) {
          n += '上半年你意气风发，产出了 <em>' + agg.firstHalf + '</em> 条事项；下半年只有 <em>' + agg.secondHalf + '</em> 条。经典的三分钟热度曲线。';
        } else if (agg.secondHalf > agg.firstHalf * 1.5 && agg.firstHalf > 0) {
          n += '下半年你突然发力，产出了 <em>' + agg.secondHalf + '</em> 条事项，远超上半年的 <em>' + agg.firstHalf + '</em> 条。后发制人，大器晚成。';
        } else if (agg.firstHalf === agg.secondHalf && agg.firstHalf > 0) {
          n += '上下半年各产出 <em>' + agg.firstHalf + '</em> 条事项，节奏稳定如钟。你是时间的朋友。';
        } else if (agg.firstHalf > 0 && agg.secondHalf > 0) {
          n += '上下半年各产出 <em>' + agg.firstHalf + '</em> 和 <em>' + agg.secondHalf + '</em> 条事项，节奏基本稳定。';
        } else if (agg.firstHalf > 0 && agg.secondHalf === 0) {
          n += '所有的事项都集中在上半年。下半年？大概是在享受上半年的劳动成果。';
        } else {
          n += '所有的事项都集中在下半年。上半年？大概是在积蓄力量。';
        }
      }

      n += '<br><br>';
      if (agg.weekdayTotal > 0 || agg.weekendTotal > 0) {
        var wdRate = agg.weekdayTotal > 0 ? (agg.weekdayDone / agg.weekdayTotal * 100).toFixed(0) : 0;
        var weRate = agg.weekendTotal > 0 ? (agg.weekendDone / agg.weekendTotal * 100).toFixed(0) : 0;
        n += '工作日你创建了 <em>' + agg.weekdayTotal + '</em> 条事项（完成率 <em>' + wdRate + '%</em>），';
        n += '周末创建了 <em>' + agg.weekendTotal + '</em> 条（完成率 <em>' + weRate + '%</em>）。';
        if (agg.weekdayTotal > agg.weekendTotal * 2) {
          n += '看起来你是工作日的战士，周末更愿意放空。';
        } else if (agg.weekendTotal > agg.weekdayTotal) {
          n += '反直觉地，你周末反而更勤奋。也许这才是真正的你。';
        } else {
          n += '工作日与周末的产出基本相当，你保持着稳定的节奏。';
        }
      }

      n += '<br><br>';
      var highR = agg.priCounts.high > 0 ? (agg.priDone.high / agg.priCounts.high * 100).toFixed(0) : 0;
      var lowR = agg.priCounts.low > 0 ? (agg.priDone.low / agg.priCounts.low * 100).toFixed(0) : 0;
      if (agg.priCounts.high > 0 && agg.priCounts.low > 0) {
        n += '高优先级完成率 <em>' + highR + '%</em>，低优先级完成率 <em>' + lowR + '%</em>。';
        if (parseInt(highR, 10) > parseInt(lowR, 10) + 20) {
          n += '你确实"急事先做"——重要的先消化，不重要的慢慢拖。';
        } else if (parseInt(lowR, 10) > parseInt(highR, 10) + 20) {
          n += '有趣的反差：低优先级反而完成率更高。也许它们没那么"低"，又也许高优先级本身就是个伪命题。';
        } else {
          n += '不同优先级的完成率差距不大，你对待每一件事都一视同仁。';
        }
      }

      n += '<br><br>';
      if (agg.busiestMonth >= 0 && agg.monthData[agg.busiestMonth].total > 0) {
        n += '<strong>' + monthNames[agg.busiestMonth] + '</strong> 是你最忙碌的月份，一共 <em>' + agg.monthData[agg.busiestMonth].total + '</em> 条事项涌入';
        var bDoneRate = agg.monthData[agg.busiestMonth].total > 0 ? (agg.monthData[agg.busiestMonth].done / agg.monthData[agg.busiestMonth].total * 100).toFixed(0) : 0;
        n += '，当月完成率 <em>' + bDoneRate + '%</em>。';
      }
      if (agg.busiestDate !== '--') {
        n += '而 <strong>' + agg.busiestDate + '</strong> 是你最充实的一天，单日创建 <em>' + agg.busiestDateCount + '</em> 条待办。';
      }

      n += '<br><br>';
      if (agg.categoryRanking.length > 0) {
        var top = agg.categoryRanking[0];
        n += '你最常使用的分类是 <strong>' + escapeHtml(top.name) + '</strong>，全年共 <em>' + top.total + '</em> 条事项，完成 <em>' + top.done + '</em> 条。';
        if (agg.categoryRanking.length >= 2) {
          var t2 = agg.categoryRanking[1];
          n += '紧随其后的是 <strong>' + escapeHtml(t2.name) + '</strong>，<em>' + t2.total + '</em> 条。';
        }
      }

      n += '<br><br>';
      var activeMonths = 0;
      for (var mi3 = 0; mi3 < 12; mi3++) if (agg.monthData[mi3].total > 0) activeMonths++;
      n += '这一年有 <em>' + activeMonths + '</em> 个月份留下了你的记录。';
      if (activeMonths >= 10) n += '你几乎全年无休，是真正的待办常驻居民。';
      else if (activeMonths >= 6) n += '大半年的时间你都在与清单为伴。';
      else if (activeMonths >= 3) n += '你只在某些时段出现，像候鸟一样有规律地迁徙。';
      else n += '你的记录零星而珍贵，像夜空中偶尔闪过的流星。';

      n += '<br><br>';
      n += '这就是你的 <strong>' + annualYear + '</strong> 年待办故事。无论结局如何，每一条记录都是你认真活过的证据。';
      return n;
    }

    function getAnnualExpiryTime() {
      var y = annualYear + 1;
      return y + '-01-07 23:59:59';
    }

    // ---------- 年度报告图表渲染 ----------
    function _renderAnnualMonthChart(agg, t) {
      var inst = _getChart('annual_month', 'annual-chart-month');
      if (!inst) return;
      var labels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      var totals = [], dones = [];
      for (var i = 0; i < 12; i++) { totals.push(agg.monthData[i].total); dones.push(agg.monthData[i].done); }
      var isNarrow = _isNarrowView();
      inst.setOption({
        tooltip: { trigger: 'axis', confine: true },
        legend: { data: ['总事项', '已完成'], top: 0, textStyle: { color: t.text, fontSize: isNarrow ? 10 : 11 }, itemWidth: 12, itemHeight: 8 },
        grid: { top: 30, left: isNarrow ? 30 : 35, right: 12, bottom: 25 },
        xAxis: { type: 'category', data: labels, axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10 }, axisLine: { lineStyle: { color: t.border } } },
        yAxis: { type: 'value', minInterval: 1, axisLabel: { color: t.text, fontSize: isNarrow ? 9 : 10 }, splitLine: { lineStyle: { color: t.splitLine } }, axisLine: { show: false } },
        series: [
          { name: '总事项', type: 'bar', data: totals, itemStyle: { color: t.panel, borderColor: t.border, borderWidth: 1 } },
          { name: '已完成', type: 'bar', data: dones, itemStyle: { color: t.accent } }
        ]
      }, true);
    }

    function _renderAnnualHeatmap(agg, t) {
      var inst = _getChart('annual_heatmap', 'annual-chart-heatmap');
      if (!inst) return;
      var data = [];
      for (var dk in agg.dailyCounts) data.push([dk, agg.dailyCounts[dk].total]);
      var maxV = 1;
      for (var i = 0; i < data.length; i++) if (data[i][1] > maxV) maxV = data[i][1];
      var wrap = document.getElementById('annual-chart-heatmap');
      var wrapW = wrap ? wrap.clientWidth : 600;
      var isNarrow = wrapW < 420;
      var cellSize = isNarrow ? 7 : 11;
      inst.setOption({
        tooltip: { formatter: function(p) { return p.data[0] + '<br/>事项数：' + p.data[1]; }, confine: true },
        visualMap: { min: 0, max: maxV, show: false, inRange: { color: [t.heat0, t.heat1, t.heat2, t.heat3, t.heat4] } },
        calendar: {
          top: 20, left: isNarrow ? 25 : 35, right: isNarrow ? 8 : 15, bottom: isNarrow ? 15 : 30,
          range: String(annualYear), cellSize: cellSize,
          itemStyle: { color: t.heat0, borderColor: t.isLight ? '#cccccc' : '#0a0a0a', borderWidth: 1 },
          splitLine: { show: false },
          yearLabel: { show: false },
          monthLabel: { color: t.gray, fontSize: 10, nameMap: 'cn' },
          dayLabel: { color: t.gray, fontSize: 9, firstDay: 1, nameMap: 'cn' }
        },
        series: [{
          type: 'heatmap', coordinateSystem: 'calendar', data: data,
          itemStyle: { borderColor: t.isLight ? '#cccccc' : '#0a0a0a', borderWidth: 1 }
        }]
      }, true);
    }

    // ---------- 主题切换 hook ----------
    // applyTheme 在 core.js 中每 60s 调用一次，主题不变时仅刷新按钮文案。
    // 仅当面板处于 active 且主题键真正变化时才触发刷新。
    function _refreshStatsOnThemeChange() {
      var overlay = document.getElementById('stats-overlay');
      if (!overlay || !overlay.classList.contains('active')) return;
      var newKey = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      if (newKey === cachedThemeKey) return;
      cachedThemeKey = newKey;
      if (currentStatsTab === 'weekly') {
        _loadRangeStats(currentStatsRange);
      } else if (currentStatsTab === 'annual') {
        loadAnnualReport();
      }
    }

    // 窗口尺寸变化时同步 ECharts 实例（仅在 stats 面板打开时）
    var _statsResizeTimer = null;
    window.addEventListener('resize', function() {
      var overlay = document.getElementById('stats-overlay');
      if (!overlay || !overlay.classList.contains('active')) return;
      if (_statsResizeTimer) clearTimeout(_statsResizeTimer);
      _statsResizeTimer = setTimeout(_resizeAllCharts, 200);
    });
`;
