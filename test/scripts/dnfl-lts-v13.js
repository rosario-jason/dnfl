/* ==========================================================================
   DNFL Last Team Standing (LTS) Module Logic Engine (v13)
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */
(function(window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};

    let retryCount = 0;
    const maxRetries = 50;
    let moduleState = {
        leagueData: null,
        weeklyResultsData: null,
        rulesConfig: {},
        selectedConference: null,
        activeYear: null,
        leagueId: null
    };

    const DEFAULT_CONFERENCE_RULES = {
        lts_isEnabled: true,
        highScore_isEnabled: true,
        startWeek: 'auto'
    };

    function norm(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    function normFranchiseId(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function getApiClient() {
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("[DNFL LTS] DNFL.Client API middleware is unavailable.");
        }
        return client;
    }

    function getLoggedInFranchiseId() {
        let fid = (window.DNFL && window.DNFL.currentFranchiseId) || window.franchise_id || window.mflFranchiseId || window.login_franchise_id || window.current_franchise_id;
        if (!fid && window.DNFLClient && typeof window.DNFLClient.getFranchiseId === 'function') {
            fid = window.DNFLClient.getFranchiseId();
        }
        if (!fid && window.location && window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            fid = urlParams.get('F') || urlParams.get('FRANCHISE_ID') || urlParams.get('f');
        }
        if (!fid && document.cookie) {
            const cookieMatch = document.cookie.match(/(?:MFL_USER_ID|MFL_FRANCHISE_ID|franchise_id)=([^;]+)/i);
            if (cookieMatch && cookieMatch[1]) {
                const rawCookieVal = decodeURIComponent(cookieMatch[1]);
                const idMatch = rawCookieVal.match(/(?:u%3D|u=)?(\d{4})/i);
                if (idMatch && idMatch[1]) fid = idMatch[1];
            }
        }
        if (!fid) {
            const myTeamLink = document.querySelector('a[href*="O=01"], a[href*="O=02"], a[href*="F="]');
            if (myTeamLink && myTeamLink.href) {
                const hrefMatch = myTeamLink.href.match(/[?&]F=(\d{4})/i);
                if (hrefMatch && hrefMatch[1]) fid = hrefMatch[1];
            }
        }
        if (!fid) {
            const inputEl = document.querySelector('input[name="FRANCHISE_ID"], select[name="FRANCHISE_ID"]');
            if (inputEl) fid = inputEl.value;
        }
        return normFranchiseId(fid);
    }

    async function init() {
        const container = document.getElementById('dnfl-lts-container');
        if (!container) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        try {
            const client = getApiClient();
            const ctx = (client.getContext && typeof client.getContext === 'function') ? client.getContext() : {};

            let yearVal = ctx.year || window.current_year || window.year;
            if (!yearVal && window.location && window.location.pathname) {
                const yearMatch = window.location.pathname.match(new RegExp('/(20\\d{2})/'));
                if (yearMatch) yearVal = yearMatch[1];
            }
            moduleState.activeYear = String(yearVal || new Date().getFullYear());
            moduleState.leagueId = String(ctx.leagueId || window.league_id || '22883');

            // 1. Fetch League Structure (7 Days TTL)
            const leagueData = await client.fetchData('league', {
                L: moduleState.leagueId
            }, {
                ttl: client.TTL.WEEKLY
            });
            moduleState.leagueData = leagueData;

            // 2. Fetch Weekly Results (1 Hour TTL)
            let weeklyResultsData = null;
            try {
                weeklyResultsData = await client.fetchData('weeklyResults', {
                    W: 'ALL',
                    L: moduleState.leagueId
                }, {
                    ttl: client.TTL.HOURLY
                });
            } catch (err) {
                console.warn("[DNFL LTS] Fetching W=ALL failed, attempting fallback...", err);
            }

            let extractedWeeks = extractMatchupWeeks(weeklyResultsData);
            if (!extractedWeeks || extractedWeeks.length === 0) {
                const endWeek = parseInt(leagueData?.league?.lastRegularSeasonWeek || '14', 10);
                const weekPromises = [];
                for (let w = 1; w <= endWeek; w++) {
                    weekPromises.push(
                        client.fetchData('weeklyResults', { W: String(w), L: moduleState.leagueId }, { ttl: client.TTL.HOURLY })
                            .catch(() => null)
                    );
                }
                const results = await Promise.all(weekPromises);
                const compiledWeeks = [];
                results.forEach((res, idx) => {
                    if (res) {
                        const parsed = extractMatchupWeeks(res);
                        if (parsed.length > 0) {
                            compiledWeeks.push(...parsed);
                        } else if (res.weeklyResults) {
                            compiledWeeks.push({ week: String(idx + 1), ...res.weeklyResults });
                        }
                    }
                });
                weeklyResultsData = { weeklyResults: compiledWeeks };
            }
            moduleState.weeklyResultsData = weeklyResultsData;

            // 3. Fetch Sparse Exception Overrides via API Middleware
            let rawRules = {};
            const rulesPath = 'dnfl_lts/' + moduleState.activeYear + '/lts_rules.json';
            try {
                const jsonText = await client.fetchRawText(rulesPath, {
                    ttl: client.TTL.DAILY
                });
                if (jsonText && typeof jsonText === 'string') {
                    rawRules = JSON.parse(jsonText);
                }
            } catch (err1) {
                try {
                    const cdnUrl = 'https://dnfl.live/' + rulesPath;
                    const jsonTextFallback = await client.fetchRawText(cdnUrl, {
                        ttl: client.TTL.DAILY
                    });
                    if (jsonTextFallback && typeof jsonTextFallback === 'string') {
                        rawRules = JSON.parse(jsonTextFallback);
                    }
                } catch (err2) {
                    console.info("[DNFL LTS] No sparse rules JSON override found for " + moduleState.activeYear + ". Operating on built-in default rules.");
                }
            }
            moduleState.rulesConfig = buildRulesConfig(leagueData, rawRules);

            // 4. Resolve Initial Conference Selection
            setupConferenceSelection(client);

            // 5. Render Module Views
            renderLTS(container);

        } catch (err) {
            console.error("[DNFL LTS] Initialization error:", err);
            renderErrorState(container, err);
        }
    }

    function buildRulesConfig(leagueData, rawRules) {
        const config = {};
        const confs = toArray(leagueData?.league?.conferences?.conference);

        confs.forEach(c => {
            const cid = norm(c.id);
            config[cid] = {
                ...DEFAULT_CONFERENCE_RULES,
                conference_name: c.name || ('Conference ' + cid)
            };
        });

        if (Object.keys(config).length === 0) {
            config['00'] = {
                ...DEFAULT_CONFERENCE_RULES,
                conference_name: 'Main Conference'
            };
        }

        if (rawRules) {
            if (typeof rawRules.lts_isEnabled === 'boolean') {
                Object.keys(config).forEach(k => config[k].lts_isEnabled = rawRules.lts_isEnabled);
            }
            if (typeof rawRules.highScore_isEnabled === 'boolean') {
                Object.keys(config).forEach(k => config[k].highScore_isEnabled = rawRules.highScore_isEnabled);
            }
            if (rawRules.startWeek !== undefined) {
                Object.keys(config).forEach(k => config[k].startWeek = rawRules.startWeek);
            }

            if (rawRules.exceptions && typeof rawRules.exceptions === 'object') {
                Object.keys(rawRules.exceptions).forEach(cid => {
                    const paddedCid = norm(cid);
                    if (config[paddedCid]) {
                        config[paddedCid] = {
                            ...config[paddedCid],
                            ...rawRules.exceptions[cid]
                        };
                    }
                });
            }
        }
        return config;
    }

    function setupConferenceSelection(client) {
        const userFranchiseId = getLoggedInFranchiseId();
        const league = moduleState.leagueData?.league;
        
        const divToConfMap = {};
        const divisions = toArray(league?.divisions?.division);
        divisions.forEach(d => {
            divToConfMap[norm(d.id)] = norm(d.conference);
        });

        const franchises = toArray(league?.franchises?.franchise);
        const userFranchise = userFranchiseId ? franchises.find(f => normFranchiseId(f.id) === userFranchiseId) : null;
        
        let defaultConf = '00';
        if (userFranchise) {
            const fDivNorm = norm(userFranchise.division || userFranchise.div);
            const fConfNorm = norm(userFranchise.conference || userFranchise.conf || divToConfMap[fDivNorm]);
            if (fConfNorm) defaultConf = fConfNorm;
        }

        const confKeys = Object.keys(moduleState.rulesConfig);
        if (confKeys.length > 0 && !confKeys.includes(defaultConf)) {
            defaultConf = confKeys[0];
        }
        moduleState.selectedConference = defaultConf;
    }

    function extractMatchupWeeks(weeklyResultsData) {
        if (!weeklyResultsData) return [];
        let weeksRaw = null;

        if (weeklyResultsData.allWeeklyResults?.weeklyResults) {
            weeksRaw = weeklyResultsData.allWeeklyResults.weeklyResults;
        } else if (weeklyResultsData.weeklyResults) {
            weeksRaw = weeklyResultsData.weeklyResults.matchupWeek || weeklyResultsData.weeklyResults.matchUpWeek || weeklyResultsData.weeklyResults.matchup || weeklyResultsData.weeklyResults.matchUp || weeklyResultsData.weeklyResults;
        } else if (weeklyResultsData.matchupWeek || weeklyResultsData.matchUpWeek) {
            weeksRaw = weeklyResultsData.matchupWeek || weeklyResultsData.matchUpWeek;
        } else if (Array.isArray(weeklyResultsData)) {
            weeksRaw = weeklyResultsData;
        }

        return toArray(weeksRaw).filter(mw => mw && mw.week !== undefined && mw.week !== null);
    }

    function calculateLTSData(confId) {
        const client = getApiClient();
        const league = moduleState.leagueData?.league;
        const confRules = moduleState.rulesConfig[confId] || DEFAULT_CONFERENCE_RULES;

        const divToConfMap = {};
        const divisions = toArray(league?.divisions?.division);
        divisions.forEach(d => {
            divToConfMap[norm(d.id)] = norm(d.conference);
        });

        const allFranchises = toArray(league?.franchises?.franchise);
        const franchises = allFranchises.filter(f => {
            const fDivNorm = norm(f.division || f.div);
            const fConfNorm = norm(f.conference || f.conf || divToConfMap[fDivNorm]);
            return fConfNorm === norm(confId);
        });

        const totalTeams = franchises.length;
        const endWeek = parseInt(league?.lastRegularSeasonWeek || '14', 10);

        let startWeek = confRules.startWeek;
        if (startWeek === 'auto' || !startWeek) {
            startWeek = Math.max(1, endWeek - (totalTeams - 1) + 1);
        } else {
            startWeek = parseInt(startWeek, 10);
        }

        const scoresMap = {};
        let maxCompletedWeek = 0;

        const matchWeeks = extractMatchupWeeks(moduleState.weeklyResultsData);
        if (matchWeeks && matchWeeks.length > 0) {
            matchWeeks.forEach(mw => {
                const w = parseInt(mw.week, 10);
                if (!w) return;
                scoresMap[w] = scoresMap[w] || {};

                const rawMatchups = mw.matchup || mw.matchUp || mw.schedule?.matchup || mw.schedule?.matchUp;
                if (rawMatchups) {
                    if (w > maxCompletedWeek) maxCompletedWeek = w;
                    const matchups = toArray(rawMatchups);
                    matchups.forEach(m => {
                        const frs = toArray(m.franchise);
                        frs.forEach(f => {
                            const fid = normFranchiseId(f.id);
                            if (fid) scoresMap[w][fid] = parseFloat(f.score || '0.00');
                        });
                    });
                } else if (mw.franchise) {
                    if (w > maxCompletedWeek) maxCompletedWeek = w;
                    const frs = toArray(mw.franchise);
                    frs.forEach(f => {
                        const fid = normFranchiseId(f.id);
                        if (fid) scoresMap[w][fid] = parseFloat(f.score || '0.00');
                    });
                }
            });
        }

        const activeTeams = new Set(franchises.map(f => normFranchiseId(f.id)));
        const eliminations = {};
        const weeklySummaries = [];
        const highScorersMap = {};
        const lowScorersMap = {};

        for (let w = 1; w <= maxCompletedWeek; w++) {
            if (!scoresMap[w]) continue;
            const weekScores = scoresMap[w];
            const confTeamIds = franchises.map(f => normFranchiseId(f.id));

            // Identify High Scorer
            let maxScore = -1;
            let maxScorerFid = null;
            confTeamIds.forEach(fid => {
                const score = weekScores[fid] !== undefined ? weekScores[fid] : -1;
                if (score > maxScore) {
                    maxScore = score;
                    maxScorerFid = fid;
                }
            });
            if (maxScorerFid) {
                highScorersMap[w] = maxScorerFid;
            }

            // Identify Low Scorer (across all conference teams)
            let minScoreWeek = Infinity;
            let lowScorerFid = null;
            confTeamIds.forEach(fid => {
                const score = weekScores[fid] !== undefined ? weekScores[fid] : Infinity;
                if (score < minScoreWeek) {
                    minScoreWeek = score;
                    lowScorerFid = fid;
                }
            });
            if (lowScorerFid) {
                lowScorersMap[w] = lowScorerFid;
            }

            const isLTSWeek = confRules.lts_isEnabled && w >= startWeek;
            let eliminatedThisWeek = null;
            let eliminatedScore = 0;

            if (isLTSWeek && activeTeams.size > 1) {
                let minScore = Infinity;
                let lowestScorers = [];

                activeTeams.forEach(fid => {
                    const score = weekScores[fid] !== undefined ? weekScores[fid] : 0;
                    if (score < minScore) {
                        minScore = score;
                        lowestScorers = [fid];
                    } else if (score === minScore) {
                        lowestScorers.push(fid);
                    }
                });

                if (lowestScorers.length === 1) {
                    eliminatedThisWeek = lowestScorers[0];
                    eliminatedScore = minScore;
                } else if (lowestScorers.length > 1) {
                    let lowestYTD = Infinity;
                    let ytdTiedScorers = [];

                    lowestScorers.forEach(fid => {
                        let cumulativeYTD = 0;
                        for (let k = 1; k <= w; k++) {
                            cumulativeYTD += (scoresMap[k] && scoresMap[k][fid] !== undefined) ? scoresMap[k][fid] : 0;
                        }
                        if (cumulativeYTD < lowestYTD) {
                            lowestYTD = cumulativeYTD;
                            ytdTiedScorers = [fid];
                        } else if (cumulativeYTD === lowestYTD) {
                            ytdTiedScorers.push(fid);
                        }
                    });

                    if (ytdTiedScorers.length === 1) {
                        eliminatedThisWeek = ytdTiedScorers[0];
                        eliminatedScore = minScore;
                    } else {
                        let lowestPriorScore = Infinity;
                        let finalEliminated = ytdTiedScorers[0];

                        ytdTiedScorers.forEach(fid => {
                            const priorScore = (w > 1 && scoresMap[w - 1] && scoresMap[w - 1][fid] !== undefined) ? scoresMap[w - 1][fid] : 0;
                            if (priorScore < lowestPriorScore) {
                                lowestPriorScore = priorScore;
                                finalEliminated = fid;
                            }
                        });
                        eliminatedThisWeek = finalEliminated;
                        eliminatedScore = minScore;
                    }
                }

                if (eliminatedThisWeek) {
                    activeTeams.delete(eliminatedThisWeek);
                    eliminations[eliminatedThisWeek] = {
                        week: w,
                        score: eliminatedScore
                    };
                }
            }

            weeklySummaries.push({
                week: w,
                isLTSWeek: isLTSWeek,
                eliminatedFid: eliminatedThisWeek,
                eliminatedScore: eliminatedScore,
                highScoreFid: maxScorerFid,
                highScore: maxScore
            });
        }

        return {
            franchises,
            confRules,
            startWeek,
            endWeek,
            maxCompletedWeek,
            scoresMap,
            activeTeams,
            eliminations,
            highScorersMap,
            lowScorersMap,
            weeklySummaries
        };
    }

    function renderLTS(container) {
        const confId = moduleState.selectedConference;
        const data = calculateLTSData(confId);

        let contentEl = container.querySelector('#dnfl-lts-content');
        if (!contentEl) contentEl = container;

        let gridContainer = container.querySelector('#dnfl-lts-grid-container');
        let summaryContainer = container.querySelector('#dnfl-lts-summary-container');

        if (!gridContainer || !summaryContainer) {
            contentEl.innerHTML = `
                <div id="dnfl-lts-grid-section" class="dnfl-lts-section">
                    <div id="dnfl-lts-grid-container" class="dnfl-lts-view"></div>
                </div>
                <div id="dnfl-lts-summary-section" class="dnfl-lts-section">
                    <div id="dnfl-lts-summary-container" class="dnfl-lts-view"></div>
                </div>
            `;
            gridContainer = container.querySelector('#dnfl-lts-grid-container');
            summaryContainer = container.querySelector('#dnfl-lts-summary-container');
        }

        // Render Conference Select Dropdown Options
        const confSelect = container.querySelector('#dnfl-lts-conference-select');
        if (confSelect) {
            let optionsHtml = '';
            Object.keys(moduleState.rulesConfig).forEach(cid => {
                const cfg = moduleState.rulesConfig[cid];
                const isSelected = cid === confId ? 'selected' : '';
                optionsHtml += `<option value="${cid}" ${isSelected}>${cfg.conference_name}</option>`;
            });
            confSelect.innerHTML = optionsHtml;
        }

        // Render Dynamic Legend
        renderLegend(container, data);

        // Offseason / Pre-Season Check
        if (data.maxCompletedWeek === 0) {
            const preSeasonHtml = `
                <div class="dnfl-status-loading">
                    <i class="fa-solid fa-clock-rotate-left dnfl-icon-amber dnfl-mr-2"></i>
                    <span>Survival eliminations will activate once Week 1 scores are finalized.</span>
                </div>
            `;
            if (gridContainer) gridContainer.innerHTML = preSeasonHtml;
            if (summaryContainer) summaryContainer.innerHTML = '';
            return;
        }

        // Render View A: Cross-Grid Matrix
        renderScoresGrid(container, data);

        // Render View B: Summary Table
        renderSummaryTable(container, data);
    }

    function renderLegend(container, data) {
        let legendEl = container.querySelector('#dnfl-lts-legend');
        if (!legendEl) return;

        const ltsOn = !!data.confRules.lts_isEnabled;
        const hsOn = !!data.confRules.highScore_isEnabled;

        let itemsHtml = '<div class="dnfl-legend-items">';
        if (hsOn) {
            itemsHtml += `
                <div class="dnfl-legend-item">
                    <span class="dnfl-pill dnfl-pill-green">145.20 <i class="fa-solid fa-star"></i></span>
                    <span class="dnfl-legend-label">Weekly High Score</span>
                </div>
            `;
        } else {
            itemsHtml += `
                <div class="dnfl-legend-item">
                    <span class="dnfl-badge dnfl-badge-green">145.20</span>
                    <span class="dnfl-legend-label">Weekly High Score</span>
                </div>
            `;
        }

        if (ltsOn) {
            itemsHtml += `
                <div class="dnfl-legend-item">
                    <span class="dnfl-pill dnfl-pill-red">88.50 <i class="fa-solid fa-skull"></i></span>
                    <span class="dnfl-legend-label">LTS Knockout</span>
                </div>
                <div class="dnfl-legend-item">
                    <span class="dnfl-badge dnfl-badge-red">88.50</span>
                    <span class="dnfl-legend-label">Low Score (Pre-LTS / LTS Disabled)</span>
                </div>
                <div class="dnfl-legend-item">
                    <span class="dnfl-text-muted">72.30 <i class="fa-solid fa-skull"></i></span>
                    <span class="dnfl-legend-label">Post-Elimination</span>
                </div>
            `;
        } else {
            itemsHtml += `
                <div class="dnfl-legend-item">
                    <span class="dnfl-badge dnfl-badge-red">88.50</span>
                    <span class="dnfl-legend-label">Low Score</span>
                </div>
            `;
        }
        itemsHtml += '</div>';

        if (ltsOn) {
            const endW = data.endWeek || 14;
            itemsHtml += `<div class="dnfl-legend-note">*LTS eliminations active Weeks ${data.startWeek}-${endW}</div>`;
        }

        legendEl.innerHTML = itemsHtml;
    }

    function buildFranchiseCell(f, client) {
        const fid = normFranchiseId(f ? f.id : '');
        const franchise = (client && client.getFranchise && fid) ? client.getFranchise(fid) : null;
        const teamName = f?.name || (franchise ? franchise.name : ('Franchise ' + fid));
        const ownerName = f?.owner_name || f?.owner || (franchise ? (franchise.owner || franchise.owner_name) : '');
        const iconUrl = f?.icon || (franchise ? franchise.icon : '') || 'https://dnfl.live/images/ficon-dnfl.png';
        const activeYear = moduleState.activeYear || new Date().getFullYear();
        const leagueId = moduleState.leagueId || '22883';
        const teamUrl = `https://www.myfantasyleague.com/${activeYear}/options?L=${leagueId}&F=${fid}&O=01`;

        return `
            <div class="dnfl-franchise-cell">
                <a href="${teamUrl}" target="_blank">
                    <img src="${iconUrl}" class="franchiseicon" alt="icon" onError="this.onerror=null;this.src='https://dnfl.live/images/ficon-dnfl.png';">
                </a>
                <div class="dnfl-franchise-info">
                    <a class="dnfl-team-name" href="${teamUrl}" target="_blank">${teamName}</a>
                    <span class="dnfl-owner-name">${ownerName}</span>
                </div>
            </div>
        `;
    }

    function renderScoresGrid(container, data) {
        const client = getApiClient();
        const gridContainer = container.querySelector('#dnfl-lts-grid-container');
        if (!gridContainer) return;

        const userFid = getLoggedInFranchiseId();
        const activeFids = Array.from(data.activeTeams);
        const eliminatedFids = Object.keys(data.eliminations);

        const activeFranchises = data.franchises.filter(f => activeFids.includes(normFranchiseId(f.id)));
        const eliminatedFranchises = data.franchises.filter(f => eliminatedFids.includes(normFranchiseId(f.id)));

        const endWeek = data.endWeek || 14;
        const totalCols = endWeek + 1;

        let html = `
            <div id="dnfl-lts-grid-wrapper" class="dnfl-table-wrapper">
                <table class="dnfl-table dnfl-lts-grid-table">
                    <thead>
                        <tr class="dnfl-table-section-header">
                            <td colspan="${totalCols}" class="dnfl-table-section-header-cell">
                                <div class="dnfl-table-section-header-content">
                                    <h3>Survival Cross-Grid Matrix</h3>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <th class="dnfl-col-franchise dnfl-sticky-col">Franchise</th>
        `;

        for (let w = 1; w <= endWeek; w++) {
            const isLTSWeek = data.confRules.lts_isEnabled && w >= data.startWeek;
            html += `<th class="dnfl-text-center">W${w}${isLTSWeek ? ' <i class="fa-solid fa-skull dnfl-text-red dnfl-ml-1"></i>' : ''}</th>`;
        }
        html += `</tr></thead><tbody>`;

        let rowCounter = 0;
        function buildRow(f, isEliminated) {
            rowCounter++;
            const fid = normFranchiseId(f.id);
            const isMyTeam = (fid === userFid) ? 'dnfl-my-team myfranchise' : '';
            const rowStriping = (rowCounter % 2 === 1) ? 'dnfl-row-odd' : 'dnfl-row-even';
            const mutedClass = isEliminated ? 'dnfl-row-muted' : '';

            let rowHtml = `<tr class="${rowStriping} ${isMyTeam} ${mutedClass}">`;
            rowHtml += `<td class="dnfl-col-franchise dnfl-sticky-col">${buildFranchiseCell(f, client)}</td>`;

            const elimInfo = data.eliminations[fid];

            for (let w = 1; w <= endWeek; w++) {
                if (w > data.maxCompletedWeek) {
                    rowHtml += `<td class="dnfl-text-center dnfl-text-muted">—</td>`;
                    continue;
                }

                const scoreVal = (data.scoresMap[w] && data.scoresMap[w][fid] !== undefined) ? data.scoresMap[w][fid] : null;
                const score = (scoreVal !== null) ? scoreVal.toFixed(2) : '—';
                const isHighScore = (data.highScorersMap[w] === fid);
                const isLowScore = (data.lowScorersMap[w] === fid);
                const isKnockout = elimInfo && (elimInfo.week === w);
                const isPostElim = elimInfo && (w > elimInfo.week);
                const isLTSWeek = data.confRules.lts_isEnabled && w >= data.startWeek;

                rowHtml += `<td class="dnfl-text-center">`;
                if (isHighScore && data.confRules.highScore_isEnabled) {
                    rowHtml += `<span class="dnfl-pill dnfl-pill-green" title="Weekly High Score">${score} <i class="fa-solid fa-star"></i></span>`;
                } else if (isHighScore && !data.confRules.highScore_isEnabled) {
                    rowHtml += `<span class="dnfl-badge dnfl-badge-green" title="Weekly High Score">${score}</span>`;
                } else if (isKnockout && isLTSWeek && data.confRules.lts_isEnabled) {
                    rowHtml += `<span class="dnfl-pill dnfl-pill-red" title="LTS Knockout Score">${score} <i class="fa-solid fa-skull"></i></span>`;
                } else if (isLowScore && (!isLTSWeek || !data.confRules.lts_isEnabled)) {
                    rowHtml += `<span class="dnfl-badge dnfl-badge-red" title="Weekly Low Score">${score}</span>`;
                } else if (isPostElim) {
                    rowHtml += `<span class="dnfl-text-muted" title="Post-Elimination Score">${score} <i class="fa-solid fa-skull"></i></span>`;
                } else {
                    rowHtml += `${score}`;
                }
                rowHtml += `</td>`;
            }
            rowHtml += `</tr>`;
            return rowHtml;
        }

        activeFranchises.forEach(f => {
            html += buildRow(f, false);
        });

        if (eliminatedFranchises.length > 0) {
            html += `<tr class="dnfl-divider-row"><td colspan="${totalCols}">LTS Eliminated Teams</td></tr>`;
            eliminatedFranchises.forEach(f => {
                html += buildRow(f, true);
            });
        }

        html += `</tbody></table></div>`;
        gridContainer.innerHTML = html;
    }

    function renderSummaryTable(container, data) {
        const client = getApiClient();
        const summaryContainer = container.querySelector('#dnfl-lts-summary-container');
        if (!summaryContainer) return;

        const ltsOn = !!data.confRules.lts_isEnabled;
        const hsOn = !!data.confRules.highScore_isEnabled;

        // If both features are disabled, hide summary table completely
        if (!ltsOn && !hsOn) {
            summaryContainer.innerHTML = '';
            summaryContainer.classList.add('dnfl-is-hidden');
            return;
        } else {
            summaryContainer.classList.remove('dnfl-is-hidden');
        }

        let totalCols = 1;
        if (ltsOn) totalCols += 2;
        if (hsOn) totalCols += 2;

        let html = `
            <div id="dnfl-lts-summary-wrapper" class="dnfl-table-wrapper">
                <table class="dnfl-table dnfl-lts-summary-table">
                    <thead>
                        <tr class="dnfl-table-section-header">
                            <td colspan="${totalCols}" class="dnfl-table-section-header-cell">
                                <div class="dnfl-table-section-header-content">
                                    <h3>Weekly Survival Summary</h3>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <th class="dnfl-col-week dnfl-text-center">Week</th>
        `;

        if (ltsOn) {
            html += `<th class="dnfl-col-franchise">Eliminated Franchise</th><th class="dnfl-col-score dnfl-text-center">Knockout Score</th>`;
        }
        if (hsOn) {
            html += `<th class="dnfl-col-franchise">Weekly High Scorer</th><th class="dnfl-col-score dnfl-text-center">High Score</th>`;
        }
        html += `</tr></thead><tbody>`;

        let rowCounter = 0;
        data.weeklySummaries.forEach(s => {
            rowCounter++;
            const rowStriping = (rowCounter % 2 === 1) ? 'dnfl-row-odd' : 'dnfl-row-even';
            html += `<tr class="${rowStriping}">`;
            html += `<td class="dnfl-col-week dnfl-text-center dnfl-font-bold">Week ${s.week}</td>`;

            // LTS Column Logic
            if (ltsOn) {
                if (s.isLTSWeek && s.eliminatedFid) {
                    const f = client.getFranchise ? client.getFranchise(s.eliminatedFid) : { id: s.eliminatedFid };
                    html += `<td class="dnfl-col-franchise">${buildFranchiseCell(f, client)}</td>`;
                    html += `<td class="dnfl-col-score dnfl-text-center"><span class="dnfl-pill dnfl-pill-red">${s.eliminatedScore.toFixed(2)} <i class="fa-solid fa-skull"></i></span></td>`;
                } else {
                    html += `<td class="dnfl-col-franchise dnfl-text-muted">—</td><td class="dnfl-col-score dnfl-text-center dnfl-text-muted">—</td>`;
                }
            }

            // High Score Column Logic
            if (hsOn) {
                if (s.highScoreFid) {
                    const f = client.getFranchise ? client.getFranchise(s.highScoreFid) : { id: s.highScoreFid };
                    html += `<td class="dnfl-col-franchise">${buildFranchiseCell(f, client)}</td>`;
                    html += `<td class="dnfl-col-score dnfl-text-center"><span class="dnfl-pill dnfl-pill-green">${s.highScore.toFixed(2)} <i class="fa-solid fa-star"></i></span></td>`;
                } else {
                    html += `<td class="dnfl-col-franchise dnfl-text-muted">—</td><td class="dnfl-col-score dnfl-text-center dnfl-text-muted">—</td>`;
                }
            }
            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        summaryContainer.innerHTML = html;
    }

    function renderErrorState(container, err) {
        const content = container.querySelector('#dnfl-lts-content');
        if (content) {
            content.innerHTML = '<div class="dnfl-status-error">Failed to load Last Team Standing data.</div>';
        }
    }

    // Public API
    window.DNFL.LTS = {
        init: init,
        updateView: function() {
            const container = document.getElementById('dnfl-lts-container');
            if (!container) return;
            const confSelect = container.querySelector('#dnfl-lts-conference-select');
            if (confSelect) {
                moduleState.selectedConference = norm(confSelect.value);
            }
            renderLTS(container);
        },
        toggleGrid: function() {
            const container = document.getElementById('dnfl-lts-container');
            if (!container) return;
            const gridSection = container.querySelector('#dnfl-lts-grid-section');
            const btn = container.querySelector('#dnfl-btn-lts-grid');
            if (gridSection) {
                const isHidden = gridSection.classList.toggle('dnfl-is-hidden');
                if (btn) {
                    btn.innerHTML = isHidden 
                        ? '<i class="fa-solid fa-table-cells"></i> Show Grid' 
                        : '<i class="fa-solid fa-table-cells"></i> Hide Grid';
                }
            }
        },
        toggleSummary: function() {
            const container = document.getElementById('dnfl-lts-container');
            if (!container) return;
            const summarySection = container.querySelector('#dnfl-lts-summary-section');
            const btn = container.querySelector('#dnfl-btn-lts-summary');
            if (summarySection) {
                const isHidden = summarySection.classList.toggle('dnfl-is-hidden');
                if (btn) {
                    btn.innerHTML = isHidden 
                        ? '<i class="fa-solid fa-list-check"></i> Show Summary' 
                        : '<i class="fa-solid fa-list-check"></i> Hide Summary';
                }
            }
        }
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
