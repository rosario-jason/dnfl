/* ==========================================================================
   DNFL Power Rankings Engine (v6)
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */
(function (window, document) {
  'use strict';

  window.DNFL = window.DNFL || {};

  let retryCount = 0;
  const maxRetries = 50;

  const CONFIG = {
    containerId: 'dnfl-rankings-container',
    titleId: 'dnfl-rankings-title',
    weekSelectId: 'dnfl-rankings-select-week',
    confSelectId: 'dnfl-rankings-select-conf',
    toggleBtnId: 'dnfl-rankings-toggle-chart-btn',
    chartWrapperId: 'dnfl-rankings-chart-wrapper',
    chartCanvasId: 'dnfl-rankings-chart',
    legendId: 'dnfl-rankings-legend',
    tableId: 'dnfl-rankings-table',
    tbodyId: 'dnfl-rankings-tbody'
  };

  let chartInstance = null;
  let activeRankingsData = [];
  let isChartVisible = true;
  let weeksManifest = [];
  let prevWeekRankMap = {};

  function getApiClient() {
    const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
    if (!client || typeof client.fetchData !== 'function') {
      throw new Error('[DNFL Rankings] DNFL.Client API middleware is required but unavailable.');
    }
    return client;
  }

  async function init() {
    const tbody = document.getElementById(CONFIG.tbodyId);
    const container = document.getElementById(CONFIG.containerId);

    if (!container || !tbody) {
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(init, 100);
      }
      return;
    }

    try {
      const client = getApiClient();
      bindEvents();
      await loadWeekOptions(client);
    } catch (err) {
      console.error('[DNFL Rankings] Initialization error:', err);
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load Power Rankings data.</td></tr>';
      }
    }
  }

  function bindEvents() {
    const weekSelect = document.getElementById(CONFIG.weekSelectId);
    if (weekSelect) {
      weekSelect.removeEventListener('change', handleWeekChange);
      weekSelect.addEventListener('change', handleWeekChange);
    }

    const confSelect = document.getElementById(CONFIG.confSelectId);
    if (confSelect) {
      confSelect.removeEventListener('change', handleConfChange);
      confSelect.addEventListener('change', handleConfChange);
    }

    const toggleBtn = document.getElementById(CONFIG.toggleBtnId);
    if (toggleBtn) {
      toggleBtn.removeEventListener('click', toggleChartVisibility);
      toggleBtn.addEventListener('click', toggleChartVisibility);
    }
  }

  function handleWeekChange(e) {
    const client = getApiClient();
    loadRankingsData(client, e.target.value);
  }

  function handleConfChange() {
    renderDashboard();
  }

  function toggleChartVisibility() {
    const wrapper = document.getElementById(CONFIG.chartWrapperId);
    const toggleBtn = document.getElementById(CONFIG.toggleBtnId);
    if (!wrapper || !toggleBtn) return;

    isChartVisible = !isChartVisible;
    if (isChartVisible) {
      wrapper.classList.remove('dnfl-is-hidden');
      toggleBtn.innerHTML = '<i class="fa-solid fa-chart-bar"></i> Hide Chart';
    } else {
      wrapper.classList.add('dnfl-is-hidden');
      toggleBtn.innerHTML = '<i class="fa-solid fa-chart-bar"></i> Show Chart';
    }
  }

  async function loadWeekOptions(client) {
    const weekSelect = document.getElementById(CONFIG.weekSelectId);
    if (!weekSelect) return;

    try {
      const weeksRaw = await client.fetchRawText('https://dnfl.live/dnfl_rankings/weeks.json', { ttl: client.TTL ? client.TTL.DAILY : 86400000 });
      if (weeksRaw && !weeksRaw.trim().startsWith('<')) {
        weeksManifest = JSON.parse(weeksRaw);
      }
    } catch (e) {
      console.warn('[DNFL Rankings] Failed to load weeks.json, using fallback weeks:', e);
      weeksManifest = [
        { id: '01', name: 'Week 1' },
        { id: '02', name: 'Week 2' },
        { id: '03', name: 'Week 3' }
      ];
    }

    if (weeksManifest && weeksManifest.length > 0) {
      weekSelect.innerHTML = weeksManifest.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
      const currentWeekObj = weeksManifest[weeksManifest.length - 1];
      const currentWeek = currentWeekObj ? currentWeekObj.id : '01';
      weekSelect.value = currentWeek;
      await loadRankingsData(client, currentWeek);
    }
  }

  async function loadRankingsData(client, weekId) {
    const tbody = document.getElementById(CONFIG.tbodyId);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="dnfl-status-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading Power Rankings Data...</td></tr>';
    }

    // 1. Fetch PapaParse if not present
    if (!window.Papa) {
      try {
        await client.loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');
      } catch (e) {
        console.warn('[DNFL Rankings] PapaParse script load warning:', e);
      }
    }

    // 2. Fetch CSV for target week
    let currentCsvText = '';
    const selectedWeekObj = weeksManifest.find(w => w.id === weekId) || { file: `data_${weekId}.csv` };
    const csvFileName = selectedWeekObj.file || `data_${weekId}.csv`;

    try {
      currentCsvText = await client.fetchRawText(`https://dnfl.live/dnfl_rankings/${csvFileName}`, { ttl: client.TTL ? client.TTL.HOURLY : 3600000 });
    } catch (e) {
      console.error('[DNFL Rankings] Error fetching CSV:', e);
    }

    if (!currentCsvText || currentCsvText.trim().startsWith('<')) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Rankings data file unavailable for this week.</td></tr>';
      }
      return;
    }

    // 3. Parse CSV
    let parsedRows = [];
    if (window.Papa) {
      const parsed = window.Papa.parse(currentCsvText, { header: true, skipEmptyLines: true });
      parsedRows = parsed.data || [];
    } else {
      parsedRows = parseCsvSimple(currentCsvText);
    }

    // 4. Fetch previous week CSV for change tracking
    prevWeekRankMap = {};
    const weekIndex = weeksManifest.findIndex(w => w.id === weekId);
    if (weekIndex > 0) {
      const prevWeekObj = weeksManifest[weekIndex - 1];
      const prevFileName = prevWeekObj.file || `data_${prevWeekObj.id}.csv`;
      try {
        const prevCsvText = await client.fetchRawText(`https://dnfl.live/dnfl_rankings/${prevFileName}`, { ttl: client.TTL ? client.TTL.HOURLY : 3600000 });
        if (prevCsvText && !prevCsvText.trim().startsWith('<')) {
          let prevRows = window.Papa ? window.Papa.parse(prevCsvText, { header: true, skipEmptyLines: true }).data : parseCsvSimple(prevCsvText);
          prevRows.forEach((r, idx) => {
            const fId = padId(r['Franchise ID'] || r['Franchise'] || r['ID']);
            if (fId) {
              prevWeekRankMap[fId] = Number(r['Rank'] || idx + 1);
            }
          });
        }
      } catch (e) {
        console.warn('[DNFL Rankings] Previous week CSV fetch error:', e);
      }
    }

    // 5. Fetch MFL API metadata (league & leagueStandings)
    const [leagueRes, standingsRes] = await Promise.all([
      client.fetchData('league').catch(() => null),
      client.fetchData('leagueStandings').catch(() => null)
    ]);

    let standingsMap = {};
    if (standingsRes && standingsRes.leagueStandings && standingsRes.leagueStandings.franchise) {
      const frs = Array.isArray(standingsRes.leagueStandings.franchise) ? standingsRes.leagueStandings.franchise : [standingsRes.leagueStandings.franchise];
      frs.forEach(f => {
        const fId = padId(f.id);
        const w = Number(f.h2hw || f.wins || 0);
        const l = Number(f.h2hl || f.losses || 0);
        const t = Number(f.h2ht || f.ties || 0);
        const pf = Number(f.pf || f.points_for || 0);
        standingsMap[fId] = {
          record: `${w}-${l}-${t}`,
          pointsFor: pf
        };
      });
    }

    const loggedInFid = client.getLoggedInFranchiseId ? client.getLoggedInFranchiseId() : null;

    // 6. Map combined dataset: CSV only supplies Franchise ID, Power Index, Comments
    activeRankingsData = parsedRows.map((row, idx) => {
      const fId = padId(row['Franchise ID'] || row['Franchise'] || row['ID']);
      const fMeta = (client.getFranchise && client.getFranchise(fId)) || {};
      const stMeta = standingsMap[fId] || {};

      const currentRank = Number(row['Rank'] || idx + 1);
      const prevRank = prevWeekRankMap[fId];
      let rankChange = 0;
      if (prevRank !== undefined) {
        rankChange = prevRank - currentRank; // Positive = moved UP
      }

      const rawPowerIndex = row['Power Index'] || row['Index'] || row['Power'] || '0.0';
      const powerIndex = Number(rawPowerIndex);

      const commentsText = row['Comments'] || row['Commentary'] || row['Notes'] || '';

      const teamName = fMeta.name || `Franchise ${fId}`;
      const rawOwner = fMeta.owner || '';
      const cleanOwner = (rawOwner && rawOwner.trim() !== 'Owner') ? rawOwner.trim() : '';

      const confId = fMeta.conference || '';
      const confName = getConferenceName(confId, client);
      const confSlot = getConferenceSlot(confId, client);

      return {
        rank: currentRank,
        change: rankChange,
        hasPrevRank: prevRank !== undefined,
        franchiseId: fId,
        teamName: teamName,
        ownerName: cleanOwner,
        icon: fMeta.icon || '',
        conferenceId: confId,
        conferenceName: confName,
        confSlot: confSlot,
        powerIndex: powerIndex,
        record: stMeta.record || row['Record'] || '0-0-0',
        pointsFor: stMeta.pointsFor !== undefined ? stMeta.pointsFor : Number(row['Points For'] || row['PF'] || 0),
        comments: commentsText,
        isUserTeam: loggedInFid && (padId(loggedInFid) === fId)
      };
    });

    populateConferenceFilter(client);
    renderDashboard();
  }

  function parseCsvSimple(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length === headers.length) {
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx]; });
        rows.push(row);
      }
    }
    return rows;
  }

  function padId(id) {
    if (!id) return '0001';
    return String(id).padStart(4, '0');
  }

  function getConferenceName(confId, client) {
    if (!confId) return 'All Conferences';
    if (client.conferences && client.conferences[confId]) {
      return client.conferences[confId].name || `Conference ${confId}`;
    }
    return `Conference ${confId}`;
  }

  function getConferenceSlot(confId, client) {
    if (!confId) return 1;
    const keys = Object.keys(client.conferences || {});
    const idx = keys.indexOf(confId);
    return idx >= 0 ? (idx % 6) + 1 : ((Number(confId) || 1) % 6) + 1;
  }

  function populateConferenceFilter(client) {
    const confSelect = document.getElementById(CONFIG.confSelectId);
    if (!confSelect) return;

    const confs = [...new Set(activeRankingsData.map(item => item.conferenceName).filter(Boolean))];
    let html = '<option value="ALL">All Conferences</option>';
    confs.forEach(conf => {
      html += `<option value="${conf}">${conf}</option>`;
    });
    confSelect.innerHTML = html;

    // Auto-default to logged in user's conference
    const userTeam = activeRankingsData.find(d => d.isUserTeam);
    if (userTeam && userTeam.conferenceName && confs.includes(userTeam.conferenceName)) {
      confSelect.value = userTeam.conferenceName;
    }
  }

  function renderDashboard() {
    const confSelect = document.getElementById(CONFIG.confSelectId);
    const selectedConf = confSelect ? confSelect.value : 'ALL';

    const filteredData = selectedConf === 'ALL'
      ? activeRankingsData
      : activeRankingsData.filter(d => d.conferenceName === selectedConf);

    renderLegend();
    renderTable(filteredData);
    renderChart(filteredData);
  }

  function renderLegend() {
    const legendEl = document.getElementById(CONFIG.legendId);
    if (!legendEl) return;

    const confs = [...new Set(activeRankingsData.map(item => item.conferenceName).filter(Boolean))];
    let legendHtml = '<div class="dnfl-legend-group">';
    confs.forEach((conf, idx) => {
      const colorClass = `color-${(idx % 6) + 1}`;
      legendHtml += `<span class="dnfl-legend-item"><span class="dnfl-legend-swatch ${colorClass}"></span>${conf}</span>`;
    });
    legendHtml += '</div>';

    legendHtml += `
      <div class="dnfl-legend-group">
        <span class="dnfl-legend-item">
          <i class="fa-solid fa-comment-dots dnfl-icon-blue"></i> Click icon for Commentary
        </span>
      </div>
    `;

    legendEl.innerHTML = legendHtml;
  }

  function renderTable(data) {
    const tbody = document.getElementById(CONFIG.tbodyId);
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="dnfl-status-muted">No rankings data available for this selection.</td></tr>';
      return;
    }

    let html = '';
    data.forEach((item, idx) => {
      const confSlot = item.confSlot || ((idx % 6) + 1);
      const rankBadgeHtml = `<span class="dnfl-rank-badge color-${confSlot}">${item.rank}</span>`;
      const commentIconHtml = `<i class="fa-solid fa-comment-dots dnfl-comment-icon" onclick="DNFL.Rankings.toggleCommentRow('${item.franchiseId}')" title="Click to view commentary"></i>`;
      const rankCellWrap = `<div class="dnfl-rank-cell-wrap">${rankBadgeHtml}${commentIconHtml}</div>`;

      let changeBadgeClass = 'dnfl-badge-gray';
      let changeText = '—';
      if (item.hasPrevRank) {
        if (item.change > 0) {
          changeBadgeClass = 'dnfl-badge-green';
          changeText = `▲ +${item.change}`;
        } else if (item.change < 0) {
          changeBadgeClass = 'dnfl-badge-red';
          changeText = `▼ ${Math.abs(item.change)}`;
        }
      } else {
        changeBadgeClass = 'dnfl-badge-amber';
        changeText = 'NEW';
      }

      const ownerSubtextHtml = item.ownerName ? `<div class="dnfl-owner-name">${item.ownerName}</div>` : '';

      const context = (window.DNFL && window.DNFL.Client && window.DNFL.Client.getContext) ? window.DNFL.Client.getContext() : {};
      const activeHost = window.location.hostname || 'www48.myfantasyleague.com';
      const targetYear = context.year || '2026';
      const activeLeagueId = context.leagueId || '22883';
      const franchiseUrl = `https://${activeHost}/${targetYear}/options?L=${activeLeagueId}&F=${item.franchiseId}&O=01`;

      const formattedComment = (item.comments && item.comments.trim()) ? item.comments.trim() : 'Comments pending...';

      html += `
        <tr class="dnfl-row-${idx % 2 === 0 ? 'even' : 'odd'} ${item.isUserTeam ? 'dnfl-my-team myfranchise' : ''}" id="dnfl-rank-row-${item.franchiseId}">
          <td class="dnfl-col-rank">${rankCellWrap}</td>
          <td class="dnfl-col-change dnfl-hide-mobile"><span class="dnfl-badge ${changeBadgeClass}">${changeText}</span></td>
          <td class="dnfl-col-franchise">
            <a href="${franchiseUrl}" class="dnfl-team-name">${item.teamName}</a>
            ${ownerSubtextHtml}
          </td>
          <td class="dnfl-col-index"><span class="dnfl-pill dnfl-pill-blue">${item.powerIndex.toFixed(1)}</span></td>
          <td class="dnfl-col-record dnfl-hide-mobile">${item.record}</td>
          <td class="dnfl-col-pf dnfl-hide-mobile">${item.pointsFor.toFixed(1)}</td>
        </tr>
        <tr id="dnfl-comment-row-${item.franchiseId}" class="dnfl-comment-row dnfl-is-hidden">
          <td colspan="6" class="dnfl-comment-cell">
            <div class="dnfl-comment-box">
              <i class="fa-solid fa-quote-left"></i> ${formattedComment}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function toggleCommentRow(franchiseId) {
    const row = document.getElementById(`dnfl-comment-row-${franchiseId}`);
    if (row) {
      row.classList.toggle('dnfl-is-hidden');
    }
  }

  function renderChart(data) {
    const canvas = document.getElementById(CONFIG.chartCanvasId);
    if (!canvas || !window.Chart) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const labels = data.map(d => d.teamName);
    const datasetData = data.map(d => d.powerIndex);
    const backgroundColors = data.map(d => {
      const idx = d.confSlot || 1;
      const palette = [
        'rgba(54, 162, 235, 0.85)',
        'rgba(255, 99, 132, 0.85)',
        'rgba(75, 192, 192, 0.85)',
        'rgba(255, 205, 86, 0.85)',
        'rgba(153, 102, 255, 0.85)',
        'rgba(255, 159, 64, 0.85)'
      ];
      return palette[idx - 1];
    });

    chartInstance = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Power Index',
          data: datasetData,
          backgroundColor: backgroundColors,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                const item = data[context.dataIndex];
                const ownerStr = item && item.ownerName ? ` (${item.ownerName})` : '';
                return `Power Index: ${context.parsed.x.toFixed(1)}${ownerStr}`;
              }
            }
          }
        },
        scales: {
          x: { min: 50, max: 100 },
          y: {
            ticks: {
              font: { size: 11, weight: 'bold' }
            }
          }
        }
      }
    });
  }

  window.DNFL.Rankings = {
    init: init,
    toggleCommentRow: toggleCommentRow,
    toggleChartVisibility: toggleChartVisibility
  };

  window.addEventListener('dnfl:ready', init);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
