/* ==========================================================================
   DNFL Standings & Seeding Engine (v5)
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */
(function (window, document) {
  'use strict';

  window.DNFL = window.DNFL || {};

  let retryCount = 0;
  const maxRetries = 50;

  const CONFIG = {
    containerId: 'dnfl-standings-container',
    titleId: 'dnfl-standings-title',
    confSelectId: 'dnfl-standings-select-conf',
    legendId: 'dnfl-standings-legend',
    tableWrapperId: 'dnfl-standings-table-wrapper',
    tableId: 'dnfl-standings-table',
    tbodyId: 'dnfl-standings-tbody'
  };

  let activeStandingsData = [];
  let rulesConfig = null;

  function getApiClient() {
    const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
    if (!client || typeof client.fetchData !== 'function') {
      throw new Error('[DNFL Standings] DNFL.Client API middleware is required but unavailable.');
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
      await loadStandingsData(client);
      bindEvents();
    } catch (err) {
      console.error('[DNFL Standings] Initialization error:', err);
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="dnfl-status-error"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load Standings data.</td></tr>';
      }
    }
  }

  function bindEvents() {
    const confSelect = document.getElementById(CONFIG.confSelectId);
    if (confSelect) {
      confSelect.removeEventListener('change', handleConfChange);
      confSelect.addEventListener('change', handleConfChange);
    }
  }

  function handleConfChange() {
    renderDashboard();
  }

  async function loadStandingsData(client) {
    const tbody = document.getElementById(CONFIG.tbodyId);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="dnfl-status-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading DNFL League Standings...</td></tr>';
    }

    const context = client.getContext ? client.getContext() : { leagueId: '', year: new Date().getFullYear().toString() };

    // 1. Fetch standings_rules.json (optional/graceful)
    try {
      const rulesRaw = await client.fetchRawText('https://dnfl.live/dnfl_standings/standings_rules.json', { ttl: client.TTL ? client.TTL.DAILY : 86400000 });
      if (rulesRaw && !rulesRaw.trim().startsWith('<')) {
        rulesConfig = JSON.parse(rulesRaw);
      }
    } catch (e) {
      console.warn('[DNFL Standings] Standings rules config not loaded, using native fallbacks:', e);
    }

    // 2. Fetch leagueStandings & league metadata
    const [standingsRes, leagueRes] = await Promise.all([
      client.fetchData('leagueStandings').catch(err => { console.error('[DNFL Standings] leagueStandings error:', err); return null; }),
      client.fetchData('league').catch(err => { console.error('[DNFL Standings] league error:', err); return null; })
    ]);

    let standingsList = [];
    if (standingsRes && standingsRes.leagueStandings && standingsRes.leagueStandings.franchise) {
      const fr = standingsRes.leagueStandings.franchise;
      standingsList = Array.isArray(fr) ? fr : [fr];
    }

    // Process Points Against (PA) fallback from weeklyResults if PA is 0
    let weeklyPaMap = {};
    const needsPaFallback = standingsList.some(item => !item.pa || Number(item.pa) === 0);
    if (needsPaFallback) {
      try {
        const weeklyRes = await client.fetchData('weeklyResults').catch(() => null);
        if (weeklyRes && weeklyRes.weeklyResults && weeklyRes.weeklyResults.matchup) {
          const matchups = Array.isArray(weeklyRes.weeklyResults.matchup) ? weeklyRes.weeklyResults.matchup : [weeklyRes.weeklyResults.matchup];
          matchups.forEach(m => {
            const frs = Array.isArray(m.franchise) ? m.franchise : [m.franchise];
            if (frs.length === 2) {
              const f1 = frs[0], f2 = frs[1];
              const f1Id = padId(f1.id), f2Id = padId(f2.id);
              const f1Score = Number(f1.score || 0), f2Score = Number(f2.score || 0);
              weeklyPaMap[f1Id] = (weeklyPaMap[f1Id] || 0) + f2Score;
              weeklyPaMap[f2Id] = (weeklyPaMap[f2Id] || 0) + f1Score;
            }
          });
        }
      } catch (e) {
        console.warn('[DNFL Standings] PA fallback error:', e);
      }
    }

    // Map Standings Data with Client Franchise Metadata
    const loggedInFid = client.getLoggedInFranchiseId ? client.getLoggedInFranchiseId() : null;

    activeStandingsData = standingsList.map((item, idx) => {
      const fId = padId(item.id);
      const fMeta = (client.getFranchise && client.getFranchise(fId)) || {};

      const wins = Number(item.h2hw || item.wins || 0);
      const losses = Number(item.h2hl || item.losses || 0);
      const ties = Number(item.h2ht || item.ties || 0);
      const record = `${wins}-${losses}-${ties}`;

      const pf = Number(item.pf || item.points_for || 0);
      let pa = Number(item.pa || item.points_against || 0);
      if (pa === 0 && weeklyPaMap[fId]) {
        pa = weeklyPaMap[fId];
      }

      const bbid = Number(item.bbidAvailableAmount || item.bbid_available || 100);

      const teamName = fMeta.name || item.name || `Franchise ${fId}`;
      const rawOwner = fMeta.owner || item.owner_name || '';
      const cleanOwner = (rawOwner && rawOwner.trim() !== 'Owner') ? rawOwner.trim() : '';

      return {
        id: fId,
        teamName: teamName,
        ownerName: cleanOwner,
        icon: fMeta.icon || '',
        conferenceId: fMeta.conference || '',
        conferenceName: getConferenceName(fMeta.conference, client),
        divisionId: fMeta.division || '',
        divisionName: getDivisionName(fMeta.division, client),
        wins: wins,
        losses: losses,
        ties: ties,
        record: record,
        pointsFor: pf,
        pointsAgainst: pa,
        bbidRemaining: bbid,
        seed: Number(item.seed || idx + 1),
        isDivisionLeader: item.is_division_winner === '1' || item.isDivisionLeader === true,
        isPlayoffQualified: item.is_playoff_team === '1' || item.isPlayoffQualified === true,
        isUserTeam: loggedInFid && (padId(loggedInFid) === fId)
      };
    });

    populateConferenceFilter(client);
    renderDashboard();
  }

  function padId(id) {
    if (!id) return '0001';
    return String(id).padStart(4, '0');
  }

  function getConferenceName(confId, client) {
    if (!confId) return 'League Standings';
    if (client.conferences && client.conferences[confId]) {
      return client.conferences[confId].name || `Conference ${confId}`;
    }
    return `Conference ${confId}`;
  }

  function getDivisionName(divId, client) {
    if (!divId) return 'Division Standings';
    if (client.divisions && client.divisions[divId]) {
      return client.divisions[divId].name || `Division ${divId}`;
    }
    return `Division ${divId}`;
  }

  function populateConferenceFilter(client) {
    const confSelect = document.getElementById(CONFIG.confSelectId);
    if (!confSelect) return;

    const confs = [...new Set(activeStandingsData.map(item => item.conferenceName).filter(Boolean))];
    let html = '<option value="ALL">All Conferences</option>';
    confs.forEach(conf => {
      html += `<option value="${conf}">${conf}</option>`;
    });
    confSelect.innerHTML = html;

    // Auto-default to logged in user's conference
    const userTeam = activeStandingsData.find(d => d.isUserTeam);
    if (userTeam && userTeam.conferenceName && confs.includes(userTeam.conferenceName)) {
      confSelect.value = userTeam.conferenceName;
    }
  }

  function renderDashboard() {
    const confSelect = document.getElementById(CONFIG.confSelectId);
    const selectedConf = confSelect ? confSelect.value : 'ALL';

    const filteredData = selectedConf === 'ALL'
      ? activeStandingsData
      : activeStandingsData.filter(d => d.conferenceName === selectedConf);

    // Update Title if specific conference selected
    const titleEl = document.getElementById(CONFIG.titleId);
    if (titleEl) {
      if (selectedConf !== 'ALL') {
        titleEl.innerHTML = `<i class="fa-solid fa-list"></i> ${selectedConf} Standings`;
      } else {
        titleEl.innerHTML = '<i class="fa-solid fa-list"></i> DNFL LEAGUE STANDINGS';
      }
    }

    renderLegend();
    renderTable(filteredData);
  }

  function renderLegend() {
    const legendEl = document.getElementById(CONFIG.legendId);
    if (!legendEl) return;

    legendEl.innerHTML = `
      <div class="dnfl-legend-group">
        <span class="dnfl-legend-item"><i class="fa-solid fa-crown dnfl-icon-blue"></i> Division Crown</span>
        <span class="dnfl-legend-item"><i class="fa-solid fa-trophy dnfl-icon-amber"></i> Playoff Bye / Qualified</span>
      </div>
    `;
  }

  function renderTable(data) {
    const tbody = document.getElementById(CONFIG.tbodyId);
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="dnfl-status-muted">No standings data available for this selection.</td></tr>';
      return;
    }

    // Group by Division Name (Title Case)
    const divisionGroups = {};
    data.forEach(item => {
      const divName = item.divisionName || 'League Standings';
      if (!divisionGroups[divName]) {
        divisionGroups[divName] = [];
      }
      divisionGroups[divName].push(item);
    });

    let html = '';

    for (const [divName, items] of Object.entries(divisionGroups)) {
      const divSlug = divName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      html += `
        <tr class="dnfl-division-header" id="dnfl-div-header-${divSlug}">
          <td colspan="6" class="dnfl-division-header-cell">
            <div class="dnfl-division-header-content">
              <h3>${divName}</h3>
              <button class="dnfl-btn dnfl-btn-secondary dnfl-btn-icon" onclick="DNFL.Standings.toggleDivision('${divSlug}')" title="Toggle Division Visibility">
                <i class="fa-solid fa-chevron-up" id="dnfl-div-icon-${divSlug}"></i> <span id="dnfl-div-btn-text-${divSlug}">Hide</span>
              </button>
            </div>
          </td>
        </tr>
        <tr class="dnfl-table-subheader dnfl-div-group-${divSlug}">
          <th class="dnfl-col-seed">Seed</th>
          <th class="dnfl-col-franchise">Franchise</th>
          <th class="dnfl-col-record">Record</th>
          <th class="dnfl-col-pf">PF</th>
          <th class="dnfl-col-pa">PA</th>
          <th class="dnfl-col-bbid dnfl-hide-mobile">BBID</th>
        </tr>
      `;

      items.forEach((item, idx) => {
        const seedBadgeHtml = `<span class="dnfl-seed-badge">${item.seed || (idx + 1)}</span>`;
        let iconsHtml = '';
        if (item.isDivisionLeader) {
          iconsHtml += '<i class="fa-solid fa-crown dnfl-icon-blue" title="Division Winner"></i>';
        }
        if (item.isPlayoffQualified) {
          iconsHtml += '<i class="fa-solid fa-trophy dnfl-icon-amber" title="Playoff Bye / Qualified"></i>';
        }

        const seedCellContent = `${seedBadgeHtml}${iconsHtml}`;
        const ownerSubtextHtml = item.ownerName ? `<div class="dnfl-owner-name">${item.ownerName}</div>` : '';

        const context = (window.DNFL && window.DNFL.Client && window.DNFL.Client.getContext) ? window.DNFL.Client.getContext() : {};
        const activeHost = window.location.hostname || 'www48.myfantasyleague.com';
        const targetYear = context.year || '2026';
        const activeLeagueId = context.leagueId || '22883';
        const franchiseUrl = `https://${activeHost}/${targetYear}/options?L=${activeLeagueId}&F=${item.id}&O=01`;

        html += `
          <tr class="dnfl-row-${idx % 2 === 0 ? 'even' : 'odd'} ${item.isUserTeam ? 'dnfl-my-team myfranchise' : ''} dnfl-div-group-${divSlug}">
            <td class="dnfl-col-seed">${seedCellContent}</td>
            <td class="dnfl-col-franchise">
              <a href="${franchiseUrl}" class="dnfl-team-name">${item.teamName}</a>
              ${ownerSubtextHtml}
            </td>
            <td class="dnfl-col-record">
              <span class="dnfl-pill dnfl-pill-blue">${item.record}</span>
            </td>
            <td class="dnfl-col-pf">
              <span class="dnfl-badge dnfl-badge-green">${item.pointsFor.toFixed(1)}</span>
            </td>
            <td class="dnfl-col-pa">
              <span class="dnfl-badge dnfl-badge-gray">${item.pointsAgainst.toFixed(1)}</span>
            </td>
            <td class="dnfl-col-bbid dnfl-hide-mobile">$${item.bbidRemaining.toFixed(2)}</td>
          </tr>
        `;
      });
    }

    tbody.innerHTML = html;
  }

  function toggleDivision(divSlug) {
    const groupRows = document.querySelectorAll(`.dnfl-div-group-${divSlug}`);
    const icon = document.getElementById(`dnfl-div-icon-${divSlug}`);
    const btnText = document.getElementById(`dnfl-div-btn-text-${divSlug}`);

    groupRows.forEach(row => {
      row.classList.toggle('dnfl-is-hidden');
    });

    if (icon && btnText) {
      if (icon.classList.contains('fa-chevron-up')) {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        btnText.textContent = 'Show';
      } else {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        btnText.textContent = 'Hide';
      }
    }
  }

  window.DNFL.Standings = {
    init: init,
    toggleDivision: toggleDivision
  };

  window.addEventListener('dnfl:ready', init);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
