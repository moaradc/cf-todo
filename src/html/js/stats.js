export const stats = `
    async function openStats() {
      var statsView = document.getElementById('stats-overlay');
      statsView.classList.remove('closing');
      statsView.classList.add('active');

      currentStatsTab = 'weekly';
      updateStatsHeader();
      loadWeeklyStats();
    }

    async function loadWeeklyStats() {
      document.getElementById('stats-loading').classList.remove('hidden');
      document.getElementById('stats-content').classList.add('hidden');

      if(chartInstanceBar) chartInstanceBar.destroy();
      if(chartInstancePri) chartInstancePri.destroy();
      if(chartInstanceStat) chartInstanceStat.destroy();

      const endDt = new Date();
      const startDt = new Date();
      startDt.setDate(startDt.getDate() - 6);

      const endStr = formatDate(endDt);
      const startStr = formatDate(startDt);

      const datesArray = [];
      let tempDt = new Date(startDt);
      while(tempDt <= endDt) {
        datesArray.push(formatDate(tempDt));
        tempDt.setDate(tempDt.getDate() + 1);
      }

      try {
        const res = await fetch(\`/api/stats?start=\${startStr}&end=\${endStr}\`);
        if(res.ok) {
          const rawData = await res.json();
          renderStatsCharts(rawData, datesArray);
          document.getElementById('stats-loading').classList.add('hidden');
          document.getElementById('stats-content').classList.remove('hidden');
        } else {
          document.getElementById('stats-loading').innerText = '数据拉取失败。';
        }
      } catch(e) {
        document.getElementById('stats-loading').innerText = '网络请求异常。';
      }
    }

    function closeStats() {
      const statsView = document.getElementById('stats-overlay');
      statsView.classList.add('closing');
      statsView.addEventListener('animationend', function handler() {
        statsView.classList.remove('active');
        statsView.classList.remove('closing');
        statsView.removeEventListener('animationend', handler);
      });
    }

    function switchStatsTab() {
      if (currentStatsTab === 'weekly') {
        if (getAnnualReportYear() === null) return;
        currentStatsTab = 'annual';
        document.getElementById('stats-weekly').classList.add('hidden');
        document.getElementById('stats-annual').classList.remove('hidden');
        loadAnnualReport();
      } else {
        currentStatsTab = 'weekly';
        document.getElementById('stats-annual').classList.add('hidden');
        document.getElementById('stats-weekly').classList.remove('hidden');
      }
      updateStatsHeader();
    }

    // 年度报告出现时间 0=1月, 1=2月, ..., 11=12月
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

      if (currentStatsTab === 'weekly') {
        titleEl.innerText = '7天统计';
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

    async function loadAnnualReport() {
      var reportYear = getAnnualReportYear();
      if (reportYear === null) return;
      annualYear = reportYear;

      var loading = document.getElementById('annual-loading');
      var content = document.getElementById('annual-content');
      loading.classList.remove('hidden');
      content.classList.add('hidden');
      loading.innerText = '年度数据加载中...';

      var startStr = annualYear + '-01-01';
      var endStr = annualYear + '-12-31';

      try {
        var res = await fetch('/api/stats?start=' + startStr + '&end=' + endStr);
        if (res.ok) {
          var rawData = await res.json();
          renderAnnualReport(rawData);
          loading.classList.add('hidden');
          content.classList.remove('hidden');
        } else {
          loading.innerText = '年度数据拉取失败。';
        }
      } catch(e) {
        loading.innerText = '网络请求异常。';
      }
    }

    function renderAnnualReport(rawData) {
      const content = document.getElementById('annual-content');

      const totalTasks = rawData.length;
      const doneTasks = rawData.filter(function(r){ return r.done === 1; }).length;
      const undoneTasks = totalTasks - doneTasks;
      const doneRate = totalTasks > 0 ? (doneTasks / totalTasks * 100) : 0;

      const highPri = rawData.filter(function(r){ return r.priority === 'high'; }).length;
      const medPri = rawData.filter(function(r){ return r.priority === 'med'; }).length;
      const lowPri = rawData.filter(function(r){ return r.priority === 'low'; }).length;
      const highPriRate = totalTasks > 0 ? (highPri / totalTasks * 100) : 0;
      const medPriRate = totalTasks > 0 ? (medPri / totalTasks * 100) : 0;
      const lowPriRate = totalTasks > 0 ? (lowPri / totalTasks * 100) : 0;

      var monthData = [];
      for (var mi = 0; mi < 12; mi++) monthData.push({ total: 0, done: 0 });
      rawData.forEach(function(r) {
        var month = parseInt(r.date.slice(5, 7)) - 1;
        if (month >= 0 && month < 12) {
          monthData[month].total++;
          if (r.done === 1) monthData[month].done++;
        }
      });

      var busiestMonth = 0;
      monthData.forEach(function(m, i) { if (m.total > monthData[busiestMonth].total) busiestMonth = i; });

      var dateCount = {};
      rawData.forEach(function(r) { dateCount[r.date] = (dateCount[r.date] || 0) + 1; });
      var busiestDate = '--';
      var busiestDateCount = 0;
      for (var dk in dateCount) {
        if (dateCount[dk] > busiestDateCount) { busiestDate = dk; busiestDateCount = dateCount[dk]; }
      }

      var firstHalf = 0, secondHalf = 0;
      monthData.forEach(function(m, i) { if (i < 6) firstHalf += m.total; else secondHalf += m.total; });

      var activeDays = Object.keys(dateCount).length;

      var ending = determineEnding(totalTasks, doneRate, highPriRate, firstHalf, secondHalf, monthData, activeDays, medPriRate, lowPriRate);

      var monthMax = 1;
      monthData.forEach(function(m) { if (m.total > monthMax) monthMax = m.total; });
      var monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

      var monthBarsHtml = '';
      for (var bi = 0; bi < 12; bi++) {
        var m = monthData[bi];
        var totalW = (m.total / monthMax * 100);
        var doneW = (m.done / monthMax * 100);
        monthBarsHtml += '<div class="annual-month-row">' +
          '<div class="annual-month-label">' + monthLabels[bi] + '</div>' +
          '<div class="annual-month-bar-bg">' +
            '<div class="annual-month-bar-total" style="width:' + totalW + '%"></div>' +
            '<div class="annual-month-bar-done" style="width:' + doneW + '%"></div>' +
          '</div>' +
          '<div class="annual-month-count">' + m.total + '</div>' +
        '</div>';
      }

      var priMax = Math.max(highPri, medPri, lowPri, 1);
      var priColors = ['var(--accent)', 'var(--warn)', '#666'];
      var priLabels = ['高', '中', '低'];
      var priValues = [highPri, medPri, lowPri];
      var priRates = [highPriRate, medPriRate, lowPriRate];
      var priBarsHtml = '';
      for (var pi = 0; pi < 3; pi++) {
        priBarsHtml += '<div class="annual-pri-row">' +
          '<div class="annual-pri-label">' + priLabels[pi] + '</div>' +
          '<div class="annual-pri-bar-bg">' +
            '<div class="annual-pri-bar-fill" style="width:' + (priValues[pi] / priMax * 100) + '%; background:' + priColors[pi] + ';"></div>' +
          '</div>' +
          '<div class="annual-pri-count">' + priValues[pi] + ' (' + priRates[pi].toFixed(0) + '%)</div>' +
        '</div>';
      }

      var narrative = generateNarrative(totalTasks, doneTasks, doneRate, busiestMonth, busiestDate, busiestDateCount, highPri, medPri, lowPri, activeDays, firstHalf, secondHalf, monthData, annualYear);

      content.innerHTML =
        '<div class="annual-year-title"><span>' + annualYear + ' 年度报告</span></div>' +
        '<div class="annual-hero">' +
          '<div class="annual-ending-title">' + ending.title + '</div>' +
          '<div class="annual-ending-subtitle">' + ending.subtitle + '</div>' +
          '<div class="annual-ending-desc">' + ending.desc + '</div>' +
        '</div>' +
        '<div class="annual-divider">◆ ◆ ◆</div>' +
        '<div class="annual-section-title">核心数据</div>' +
        '<div class="annual-stats-grid">' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + totalTasks + '</div><div class="annual-stat-label">总事项数</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + doneTasks + '</div><div class="annual-stat-label">已完成</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + doneRate.toFixed(1) + '%</div><div class="annual-stat-label">完成率</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + activeDays + '</div><div class="annual-stat-label">活跃天数</div></div>' +
        '</div>' +
        '<div class="annual-section-title">月度活跃度</div>' +
        '<div class="annual-month-chart">' + monthBarsHtml + '</div>' +
        '<div class="annual-section-title">优先级分布</div>' +
        '<div style="margin-bottom:25px;">' + priBarsHtml + '</div>' +
        '<div class="annual-divider">◆ ◆ ◆</div>' +
        '<div class="annual-section-title">年度叙事</div>' +
        '<div class="annual-narrative">' + narrative + '<div class="annual-report-time">统计周期：' + annualYear + '-01-01 至 ' + annualYear + '-12-31<br>显示截止：' + getAnnualExpiryTime() + '</div></div>';
    }

    function determineEnding(totalTasks, doneRate, highPriRate, firstHalf, secondHalf, monthData, activeDays, medPriRate, lowPriRate) {
      if (totalTasks < 5) {
        return {
          title: '空白画布',
          subtitle: 'THE BLANK CANVAS',
          desc: '这一年，你选择了留下大片空白。也许是没有什么需要记录，也许是最好的待办就是没有待办。空白不是虚无——它是等待被书写的可能性。下一年，你会落笔吗？'
        };
      }
      if (doneRate >= 80 && totalTasks >= 50) {
        return {
          title: '效率引擎',
          subtitle: 'THE EFFICIENCY ENGINE',
          desc: '你将待办清单视为战场，80%以上的任务被你无情终结。每一条划掉的待办，都是一次对混沌的宣战。你是秩序的信徒，效率的化身。在你面前，没有任何一条待办能活过明天。'
        };
      }
      if (doneRate < 30 && totalTasks >= 20) {
        return {
          title: '拖延哲学家',
          subtitle: 'THE PROCRASTINATION PHILOSOPHER',
          desc: '你不是在拖延——你是在思考。那些未完成的待办，每一个都承载着深邃的犹豫与无限的可能。也许明天，也许下辈子，它们终将被完成。至少，你写下了它们。'
        };
      }
      if (highPriRate > 40 && doneRate >= 60) {
        return {
          title: '战略规划师',
          subtitle: 'THE STRATEGIC PLANNER',
          desc: '你只关注真正重要的事。高优先级是你的武器，完成率是你的战绩。无关紧要的事？不配出现在你的清单上。你不是在做待办——你是在指挥战役。'
        };
      }
      if (totalTasks < 30 && doneRate >= 70) {
        return {
          title: '精准打击者',
          subtitle: 'THE PRECISION STRIKER',
          desc: '少即是多。你不贪多，但每一发都命中靶心。你的待办清单短小精悍，却弹无虚发。真正的高手，从不需要满屏的红点来证明自己的存在。'
        };
      }
      if (totalTasks >= 100 && doneRate < 50) {
        return {
          title: '待办收藏家',
          subtitle: 'THE TODO COLLECTOR',
          desc: '你的待办清单是一座博物馆。每一项都被精心收藏，却鲜有人问津。但谁知道呢？也许某天你会打开它，然后惊叹于自己曾经的野心和想象。'
        };
      }
      if (firstHalf > 0 && secondHalf >= 0 && firstHalf > secondHalf * 2) {
        return {
          title: '开局王者',
          subtitle: 'THE QUICK STARTER',
          desc: '年初的你意气风发，雄心万丈。但时间是最好的稀释剂。你的故事总是从"这次一定"开始，然后以"下次再说"收尾。但至少，你的开局总是漂亮的。'
        };
      }
      if (secondHalf > firstHalf * 2 && firstHalf > 0) {
        return {
          title: '后发制人',
          subtitle: 'THE LATE BLOOMER',
          desc: '上半年还在酝酿，下半年突然爆发。你用实际行动证明了：重要的不是何时开始，而是何时发力。厚积薄发，大器晚成——说的就是你。'
        };
      }
      var priArr = [highPriRate, medPriRate, lowPriRate];
      var maxPriDiff = Math.max.apply(null, priArr) - Math.min.apply(null, priArr);
      if (maxPriDiff < 20 && doneRate >= 55 && doneRate <= 85) {
        return {
          title: '均衡大师',
          subtitle: 'THE BALANCE MASTER',
          desc: '高、中、低优先级在你手中均匀分布。你不偏废，不冒进，以中庸之道驾驭时间。这世上没有你特别在意的事，也没有你愿意放弃的事——也许这就是最大的智慧。'
        };
      }
      if (doneRate >= 50 && doneRate < 80 && totalTasks >= 30 && totalTasks < 100) {
        return {
          title: '从容行者',
          subtitle: 'THE STEADY WALKER',
          desc: '不急不躁，按自己的节奏前行。你完成的每一件事都有分量，未完成的也不过是留给未来的礼物。你不需要被定义——你的待办清单，就是你自己。'
        };
      }
      if (doneRate >= 30 && doneRate < 50 && totalTasks >= 30) {
        return {
          title: '半途旅人',
          subtitle: 'THE HALFWAY TRAVELER',
          desc: '你开始了，但经常没有到达。这不丢人——每一段旅程都有意义，即使没有走到终点。你的清单上写满了"进行中"，而"进行中"本身就是一种态度。'
        };
      }
      return {
        title: '待办探索者',
        subtitle: 'THE TODO EXPLORER',
        desc: '你在待办的世界里漫游，不为征服，只为探索。每一条记录都是一次尝试，每一次完成都是一次惊喜。没有KPI，没有目标——只有你和你的清单。'
      };
    }

    function generateNarrative(totalTasks, doneTasks, doneRate, busiestMonth, busiestDate, busiestDateCount, highPri, medPri, lowPri, activeDays, firstHalf, secondHalf, monthData, year) {
      var monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
      var n = '';

      n += '<strong>' + year + '</strong> 年，你一共创建了 <em>' + totalTasks + '</em> 条待办事项。';

      if (totalTasks === 0) {
        n += '这一年你的清单空空如也。也许你活在当下，从不需要计划——又或者，你本身就是最好的计划。';
        return n;
      }

      n += '其中 <em>' + doneTasks + '</em> 条被你亲手终结，完成率 <em>' + doneRate.toFixed(1) + '%</em>。';

      if (doneRate >= 90) n += '这是一个令人敬畏的数字。你的清单上几乎没有逃脱者。';
      else if (doneRate >= 70) n += '大多数任务没能逃过你的追击，少数幸存者大概在瑟瑟发抖。';
      else if (doneRate >= 50) n += '一半做了，一半没做。这大概是世界上最诚实的比例。';
      else if (doneRate >= 30) n += '虽然完成的不多，但每一条都是诚意之作……大概吧。';
      else n += '你的待办清单更像是一个许愿池——扔进去的硬币，偶尔会发光。';

      n += '<br><br>';
      n += '你在 <em>' + activeDays + '</em> 个不同的日子里打开了这个应用。';

      if (activeDays >= 300) n += '几乎没有一天缺席——你比打卡机还准时。';
      else if (activeDays >= 200) n += '一年三分之二的时间你都在这里，这已经不是习惯，是信仰。';
      else if (activeDays >= 100) n += '三天打鱼两天晒网？不，你只是选择在重要的日子出现。';
      else if (activeDays >= 30) n += '偶尔来看看，确认清单还在，然后离开。这也是一种使用方式。';
      else n += '你来去如风，像一位神秘的访客。清单记得你来过。';

      n += '<br><br>';

      if (busiestMonth >= 0 && monthData[busiestMonth].total > 0) {
        n += '<strong>' + monthNames[busiestMonth] + '</strong> 是你最忙碌的月份，一共 <em>' + monthData[busiestMonth].total + '</em> 条事项涌入';
        var bDoneRate = monthData[busiestMonth].total > 0 ? (monthData[busiestMonth].done / monthData[busiestMonth].total * 100).toFixed(0) : 0;
        n += '，当月完成率 <em>' + bDoneRate + '%</em>。';
        if (monthData[busiestMonth].total >= 30) n += '那段时间你一定忙得不可开措。';
        else if (monthData[busiestMonth].total >= 15) n += '虽然忙碌，但你扛过来了。';
      }

      if (busiestDate !== '--') {
        n += '而 <strong>' + busiestDate + '</strong> 是你最充实的一天，单日创建 <em>' + busiestDateCount + '</em> 条待办。';
      }

      n += '<br><br>';

      var total = highPri + medPri + lowPri;
      if (total > 0) {
        if (highPri > medPri && highPri > lowPri) {
          n += '你的清单中高优先级事项占了 <em>' + (highPri/total*100).toFixed(0) + '%</em>——你总是先处理最紧急的事，或者说，你制造了太多紧急的事。';
        } else if (lowPri > highPri && lowPri > medPri) {
          n += '低优先级事项占了 <em>' + (lowPri/total*100).toFixed(0) + '%</em>——看起来你的大多数待办都"不那么重要"。但谁知道呢，也许"不重要"才是最诚实的标签。';
        } else if (medPri >= highPri && medPri >= lowPri) {
          n += '中优先级事项占据了 <em>' + (medPri/total*100).toFixed(0) + '%</em>——大多数事情既不紧急也不可忽略。这就是生活的真相：平淡而持续。';
        } else {
          n += '高、中、低优先级均匀分布，你对待每一件事都一视同仁……或者说，你对优先级这个功能有些随意。';
        }
      }

      n += '<br><br>';

      if (firstHalf > 0 || secondHalf > 0) {
        if (firstHalf > secondHalf * 1.5 && secondHalf > 0) {
          n += '上半年你意气风发，产出了 <em>' + firstHalf + '</em> 条事项；下半年只有 <em>' + secondHalf + '</em> 条。经典的三分钟热度曲线。';
        } else if (secondHalf > firstHalf * 1.5 && firstHalf > 0) {
          n += '下半年你突然发力，产出了 <em>' + secondHalf + '</em> 条事项，远超上半年的 <em>' + firstHalf + '</em> 条。后发制人，大器晚成。';
        } else if (firstHalf === secondHalf && firstHalf > 0) {
          n += '上下半年各产出 <em>' + firstHalf + '</em> 条事项，节奏稳定如钟。你是时间的朋友。';
        } else if (firstHalf > 0 && secondHalf > 0) {
          n += '上下半年各产出 <em>' + firstHalf + '</em> 和 <em>' + secondHalf + '</em> 条事项，节奏基本稳定。';
        } else if (firstHalf > 0 && secondHalf === 0) {
          n += '所有的事项都集中在上半年。下半年？大概是在享受上半年的劳动成果。';
        } else {
          n += '所有的事项都集中在下半年。上半年？大概是在积蓄力量。';
        }
      }

      n += '<br><br>';

      // 找出有数据的月份数
      var activeMonths = 0;
      monthData.forEach(function(m) { if (m.total > 0) activeMonths++; });
      n += '这一年有 <em>' + activeMonths + '</em> 个月份留下了你的记录。';

      if (activeMonths >= 10) n += '你几乎全年无休，是真正的待办常驻居民。';
      else if (activeMonths >= 6) n += '大半年的时间你都在与清单为伴。';
      else if (activeMonths >= 3) n += '你只在某些时段出现，像候鸟一样有规律地迁徙。';
      else n += '你的记录零星而珍贵，像夜空中偶尔闪过的流星。';

      n += '<br><br>';
      n += '这就是你的 <strong>' + year + '</strong> 年待办故事。无论结局如何，每一条记录都是你认真活过的证据。';

      return n;
    }

    function getAnnualExpiryTime() {
      var y = annualYear + 1;
      return y + '-01-07 23:59:59';
    }

    function renderStatsCharts(rawData, datesArray) {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const cText = isLight ? '#111111' : '#ffffff';
      const cBg = isLight ? '#F0EEE2' : '#0a0a0a';
      const cPanel = isLight ? '#E5E5E5' : '#222222';
      const cBorder = isLight ? '#1B1915' : '#555555';
      const cAccent = isLight ? '#CE2424' : '#ff3300';
      const cWarn = isLight ? '#E1AC07' : '#ff9900';
      const cGray = isLight ? '#999999' : '#666666';

      const cFont = getComputedStyle(document.documentElement).getPropertyValue('--font-main').trim() || 'Courier New';

      Chart.defaults.color = cText;
      Chart.defaults.font.family = cFont;
      Chart.defaults.font.weight = 'bold';
      Chart.defaults.plugins.tooltip.backgroundColor = isLight ? '#ffffff' : '#141414';
      Chart.defaults.plugins.tooltip.titleColor = cAccent;
      Chart.defaults.plugins.tooltip.bodyColor = cText;
      Chart.defaults.plugins.tooltip.borderColor = cBorder;
      Chart.defaults.plugins.tooltip.borderWidth = 1;

      let dailyDoneCounts = {};
      let dailyTotalCounts = {};
      datesArray.forEach(d => {
        dailyDoneCounts[d] = 0;
        dailyTotalCounts[d] = 0;
      });
      let totalDone = 0;

      let priCounts = { high: 0, med: 0, low: 0 };
      let statusCounts = { done: 0, undone: 0 };

      rawData.forEach(row => {
        if (row.done === 1) statusCounts.done++;
        else statusCounts.undone++;

        if (row.priority === 'high') priCounts.high++;
        else if (row.priority === 'med') priCounts.med++;
        else priCounts.low++;

        if (dailyTotalCounts[row.date] !== undefined) {
          dailyTotalCounts[row.date]++;
          if (row.done === 1) {
            dailyDoneCounts[row.date]++;
            totalDone++;
          }
        }
      });

      document.getElementById('stats-total-info').innerText = "近7天总完成数: " + totalDone;
      document.getElementById('stats-total-info').style.color = cText;

      // 柱状图 (每日总数 vs 完成数)
      const ctxBar = document.getElementById('chart-bar').getContext('2d');
      chartInstanceBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: datesArray.map(d => d.slice(5)), // 仅显示 MM-DD
          datasets: [
            {
              label: '当日总事项',
              data: datesArray.map(d => dailyTotalCounts[d]),
              backgroundColor: cPanel,
              borderColor: cBorder,
              borderWidth: 1
            },
            {
              label: '当日完成事项',
              data: datesArray.map(d => dailyDoneCounts[d]),
              backgroundColor: cAccent,
              borderColor: cBorder,
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutQuart' },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: cText }, grid: { color: cPanel } },
            x: { ticks: { color: cText }, grid: { color: cPanel } }
          },
          plugins: {
            legend: { labels: { color: cText, font: { weight: 'bold' } } }
          }
        }
      });

      // 圆环图 (优先级占比)
      const ctxPri = document.getElementById('chart-pie-priority').getContext('2d');
      chartInstancePri = new Chart(ctxPri, {
        type: 'doughnut',
        data: {
          labels: ['高', '中', '低'],
          datasets: [{
            data: [priCounts.high, priCounts.med, priCounts.low],
            backgroundColor: [cAccent, cWarn, cGray],
            borderColor: cBg,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutQuart' },
          plugins: {
            legend: { position: 'bottom', labels: { color: cText, padding: 10, boxWidth: 12, font: { weight: 'bold' } } },
            title: { display: true, text: '优先级占比', color: cText, font: { size: 14, weight: 'bold' } },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let dataArr = context.dataset.data;
                  let total = 0;
                  for (let i = 0; i < dataArr.length; i++) {
                    total += dataArr[i];
                  }
                  let percentage = total === 0 ? 0 : Math.round((context.raw / total) * 100);
                  return context.raw + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });

      // 圆环图 (完成率占比)
      const ctxStat = document.getElementById('chart-pie-status').getContext('2d');
      chartInstanceStat = new Chart(ctxStat, {
        type: 'doughnut',
        data: {
          labels: ['已完成', '未完成'],
          datasets: [{
            data: [statusCounts.done, statusCounts.undone],
            backgroundColor:[cGray, cAccent],
            borderColor: cBg,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutQuart' },
          plugins: {
            legend: { position: 'bottom', labels: { color: cText, padding: 10, boxWidth: 12, font: { weight: 'bold' } } },
            title: { display: true, text: '事项完成率', color: cText, font: { size: 14, weight: 'bold' } },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let dataArr = context.dataset.data;
                  let total = 0;
                  for (let i = 0; i < dataArr.length; i++) {
                    total += dataArr[i];
                  }
                  let percentage = total === 0 ? 0 : Math.round((context.raw / total) * 100);
                  return context.raw + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });
    }
`;
