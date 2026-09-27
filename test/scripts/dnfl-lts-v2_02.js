/**
 * Duke Networking Fantasy League (DNFL) Last Team Standing (LTS) Module
 * File: scripts/dnfl-lts-v2_02.js
 * Version: v2_02
 * Module Namespace: DNFL.LTS
 */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};
    window.DNFL.LTS = window.DNFL.LTS || {};

    var client = window.DNFLClient || (window.DNFL && window.DNFL.Client);

    var moduleState = {
        initialized: false,
        activeYear: null,
        leagueId: null,
        userFranchiseId: null,
        league: null,
        weeklyResults: {},
        rulesConfig: {},
        selectedConference: null,
        endWeek: 14,
        maxCompletedWeek: 0,
        ltsStartWeek: 1,
        ltsEndWeek: 1,
        lts_activeTeams: [],
        lts_eliminations: [],
        lts_weeklySummaries: []
    };

    /**
     * ID Normalization Helper
     */
    function normFranchiseId(id) {
        if (!id) return '';
        var s = String(id).trim();
        return s.length === 1 ? '000' + s : s.length === 2 ? '00' + s : s.length === 3 ? '0' + s : s;
    }

    /**
     * Build Franchise Name Cell Component with Dynamic Host Link
     */
    function buildFranchiseCell(franchise) {
        if (!franchise) return '<span class="dnfl-text-muted">—</span>';

        var fid = normFranchiseId(franchise.id);
        var name = franchise.name || ('Franchise ' + fid);
        var iconUrl = franchise.icon || '';
        var host = window.location.hostname || 'www.myfantasyleague.com';
        var url = 'https://' + host + '/' + moduleState.activeYear + '/options?L=' + moduleState.leagueId + '&F=' + fid + '&O=01';

        var iconHtml = iconUrl ? '<img src="' + iconUrl + '" alt="" class="dnfl-team-icon" onerror="this.classList.add(\'dnfl-is-hidden\')" />' : '';

        return '<div class="dnfl-team-cell">' +
            iconHtml +
            '<a href="' + url + '" class="dnfl-team-link">' + name + '</a>' +
            '</div>';
    }

    /**
     * Conference Rules Resolver (3-Tier Cascading)
     */
    function getConferenceRules(confId) {
        var confKey = String(confId || 'default');
        var overrides = (moduleState.rulesConfig && moduleState.rulesConfig.conferenceOverrides && moduleState.rulesConfig.conferenceOverrides[confKey]) 
            ? moduleState.rulesConfig.conferenceOverrides[confKey] : {};
        var globalDefaults = (moduleState.rulesConfig && moduleState.rulesConfig.default) 
            ? moduleState.rulesConfig.default : {};

        return {
            lts_isEnabled: (overrides.lts_isEnabled !== undefined) ? overrides.lts_isEnabled : (globalDefaults.lts_isEnabled !== undefined ? globalDefaults.lts_isEnabled : true),
            highScore_isEnabled: (overrides.highScore_isEnabled !== undefined) ? overrides.highScore_isEnabled : (globalDefaults.highScore_isEnabled !== undefined ? globalDefaults.highScore_isEnabled : true),
            lts_startWeek: overrides.lts_startWeek || globalDefaults.lts_startWeek || 'auto',
            lts_endWeek: overrides.lts_endWeek || globalDefaults.lts_endWeek || 'auto'
        };
    }

    /**
     * Primary Logic Engine & UI Renderer
     */
    function updateView() {
        var confSelect = document.getElementById('dnfl-lts-conference-select');
        if (!confSelect) return;

        var selectedConf = confSelect.value;
        moduleState.selectedConference = selectedConf;

        var rules = getConferenceRules(selectedConf);
        var ltsOn = rules.lts_isEnabled;
        var hsOn = rules.highScore_isEnabled;

        // Extract teams in selected conference
        var confTeams = [];
        if (moduleState.league && moduleState.league.franchises && moduleState.league.franchises.franchise) {
            var allFranchises = Array.isArray(moduleState.league.franchises.franchise) 
                ? moduleState.league.franchises.franchise 
                : [moduleState.league.franchises.franchise];

            confTeams = allFranchises.filter(function(f) {
                if (!selectedConf || selectedConf === 'ALL') return true;
                return String(f.conference) === String(selectedConf);
            });
        }

        var totalTeams = confTeams.length || 12;

        // Calculate LTS week bounds
        var startW = (rules.lts_startWeek === 'auto' || !rules.lts_startWeek) 
            ? Math.max(1, moduleState.endWeek - (totalTeams - 1) + 1) 
            : Number(rules.lts_startWeek);

        var endLtsW = (rules.lts_endWeek === 'auto' || !rules.lts_endWeek) 
            ? (startW + (totalTeams - 2)) 
            : Number(rules.lts_endWeek);

        moduleState.ltsStartWeek = startW;
        moduleState.ltsEndWeek = endLtsW;

        // Resolve Conference Name
        var confName = 'League';
        if (selectedConf && moduleState.league && moduleState.league.conferences && moduleState.league.conferences.conference) {
            var confList = Array.isArray(moduleState.league.conferences.conference) 
                ? moduleState.league.conferences.conference 
                : [moduleState.league.conferences.conference];
            var matchConf = confList.find(function(c) { return String(c.id) === String(selectedConf); });
            if (matchConf) confName = matchConf.name;
        }

        // Update Card Title
        var cardTitleElem = document.getElementById('dnfl-lts-card-title');
        if (cardTitleElem) {
            var isMobile = window.innerWidth <= 768;
            if (ltsOn) {
                var titleText = isMobile 
                    ? '<i class="fa-solid fa-medal dnfl-icon-amber"></i> ' + confName + ' LTS & Weekly Summary'
                    : '<i class="fa-solid fa-medal dnfl-icon-amber"></i> ' + confName + ' Last Team Standing & Weekly Summary';
                cardTitleElem.innerHTML = titleText;
            } else {
                cardTitleElem.innerHTML = '<i class="fa-solid fa-list dnfl-icon-amber"></i> ' + confName + ' Weekly Summary';
            }
        }

        // Process Weekly Scores & Elimination Calculations
        var activeFids = confTeams.map(function(f) { return normFranchiseId(f.id); });
        var eliminations = {}; // fid -> { week, score }
        var weeklySummaries = [];
        var cumulativeYtd = {}; // fid -> totalPoints

        activeFids.forEach(function(fid) { cumulativeYtd[fid] = 0; });

        var maxW = moduleState.maxCompletedWeek;

        for (var w = 1; w <= maxW; w++) {
            var wResults = moduleState.weeklyResults[w] || [];
            var scoresThisWeek = {}; // fid -> score

            activeFids.forEach(function(fid) {
                var match = wResults.find(function(r) { return normFranchiseId(r.franchiseId) === fid; });
                var score = match ? parseFloat(match.score || 0) : 0;
                scoresThisWeek[fid] = score;
                cumulativeYtd[fid] = (cumulativeYtd[fid] || 0) + score;
            });

            // Identify High Scorer
            var highScorerFid = null;
            var highScoreVal = -1;

            // Identify Low Scorer among active LTS eligible teams
            var eligibleLtsFids = activeFids.filter(function(fid) { return !eliminations[fid]; });

            eligibleLtsFids.forEach(function(fid) {
                var s = scoresThisWeek[fid];
                if (s > highScoreVal) {
                    highScoreVal = s;
                    highScorerFid = fid;
                }
            });

            // LTS Elimination Logic
            var eliminatedFidThisWeek = null;
            var lowScoreVal = 99999;

            if (ltsOn && w >= startW && w <= endLtsW && eligibleLtsFids.length > 1) {
                var lowestScore = 99999;
                eligibleLtsFids.forEach(function(fid) {
                    if (scoresThisWeek[fid] < lowestScore) lowestScore = scoresThisWeek[fid];
                });

                var tiedFids = eligibleLtsFids.filter(function(fid) { return scoresThisWeek[fid] === lowestScore; });

                if (tiedFids.length === 1) {
                    eliminatedFidThisWeek = tiedFids[0];
                } else {
                    // Tiebreaker 1: Fewest total year-to-date points scored
                    tiedFids.sort(function(a, b) {
                        var ytdA = cumulativeYtd[a];
                        var ytdB = cumulativeYtd[b];
                        if (ytdA !== ytdB) return ytdA - ytdB;

                        // Tiebreaker 2: Lowest prior week score
                        var prevA = w > 1 ? (moduleState.weeklyResults[w - 1] ? parseFloat((moduleState.weeklyResults[w - 1].find(function(r) { return normFranchiseId(r.franchiseId) === a; }) || {}).score || 0) : 0) : 0;
                        var prevB = w > 1 ? (moduleState.weeklyResults[w - 1] ? parseFloat((moduleState.weeklyResults[w - 1].find(function(r) { return normFranchiseId(r.franchiseId) === b; }) || {}).score || 0) : 0) : 0;
                        if (prevA !== prevB) return prevA - prevB;

                        return a.localeCompare(b);
                    });
                    eliminatedFidThisWeek = tiedFids[0];
                }

                lowScoreVal = lowestScore;
                eliminations[eliminatedFidThisWeek] = {
                    week: w,
                    score: lowestScore
                };
            }

            weeklySummaries.push({
                week: w,
                highScorerFid: highScorerFid,
                highScore: highScoreVal,
                eliminatedFid: eliminatedFidThisWeek,
                knockoutScore: lowScoreVal !== 99999 ? lowScoreVal : null
            });
        }

        moduleState.lts_eliminations = eliminations;
        moduleState.lts_weeklySummaries = weeklySummaries;

        // Render View A: Table 1 - Weekly Scores
        renderWeeklyScoresTable(confTeams, ltsOn, hsOn, startW, endLtsW);

        // Render View B: Table 2 - Weekly Summary
        renderWeeklySummaryTable(confTeams, ltsOn, hsOn);

        // Render Dynamic Legend
        renderLegendPanel(ltsOn, hsOn, startW, endLtsW);
    }

    /**
     * Render Table 1: Weekly Scores Matrix
     */
    function renderWeeklyScoresTable(confTeams, ltsOn, hsOn, startW, endLtsW) {
        var container = document.getElementById('dnfl-lts-scores-container');
        if (!container) return;

        var myFid = moduleState.userFranchiseId ? normFranchiseId(moduleState.userFranchiseId) : null;
        var maxW = moduleState.maxCompletedWeek;
        var totalCols = moduleState.endWeek + 1;

        var html = '<div id="dnfl-lts-scores-wrapper" class="dnfl-table-wrapper">' +
            '<table class="dnfl-lts-scores-table dnfl-table">' +
            '<thead>' +
            '<tr>' +
            '<th class="dnfl-col-franchise dnfl-sticky-col">Franchise</th>';

        for (var w = 1; w <= moduleState.endWeek; w++) {
            var skullIcon = (ltsOn && w >= startW && w <= endLtsW) ? ' <i class="fa-solid fa-skull dnfl-icon-danger"></i>' : '';
            html += '<th class="dnfl-text-center">W' + w + skullIcon + '</th>';
        }

        html += '</tr>' +
            '</thead>' +
            '<tbody>';

        // Section Title In-Table Row
        html += '<tr class="dnfl-table-section-header">' +
            '<td colspan="' + totalCols + '" class="dnfl-table-section-header-cell dnfl-sticky-col">' +
            '<div class="dnfl-table-section-header-content"><h3>Weekly Scores</h3></div>' +
            '</td></tr>';

        if (ltsOn) {
            // Group Teams: Active vs Eliminated
            var activeGroup = [];
            var elimGroup = [];

            confTeams.forEach(function(f) {
                var fid = normFranchiseId(f.id);
                var elimInfo = moduleState.lts_eliminations[fid];
                if (elimInfo) {
                    elimGroup.push({ franchise: f, fid: fid, elimWeek: elimInfo.week });
                } else {
                    activeGroup.push({ franchise: f, fid: fid });
                }
            });

            // Sort Active Alphabetically A-Z
            activeGroup.sort(function(a, b) {
                return (a.franchise.name || '').localeCompare(b.franchise.name || '');
            });

            // Sort Eliminated in Reverse Order of Elimination
            elimGroup.sort(function(a, b) {
                if (b.elimWeek !== a.elimWeek) return b.elimWeek - a.elimWeek;
                return (a.franchise.name || '').localeCompare(b.franchise.name || '');
            });

            // Render Active Section
            html += '<tr class="dnfl-subhead-active"><td colspan="' + totalCols + '" class="dnfl-sticky-col">LTS Active Teams (' + activeGroup.length + ')</td></tr>';
            activeGroup.forEach(function(item, idx) {
                html += renderTeamRow(item.franchise, item.fid, idx, myFid, ltsOn, hsOn, startW, endLtsW);
            });

            // Render Eliminated Section
            if (elimGroup.length > 0) {
                html += '<tr class="dnfl-subhead-eliminated"><td colspan="' + totalCols + '" class="dnfl-sticky-col">LTS Eliminated Teams (' + elimGroup.length + ')</td></tr>';
                elimGroup.forEach(function(item, idx) {
                    html += renderTeamRow(item.franchise, item.fid, idx, myFid, ltsOn, hsOn, startW, endLtsW);
                });
            }
        } else {
            // LTS Disabled: Single table sorted A-Z
            var sortedTeams = confTeams.slice().sort(function(a, b) {
                return (a.name || '').localeCompare(b.name || '');
            });

            sortedTeams.forEach(function(f, idx) {
                var fid = normFranchiseId(f.id);
                html += renderTeamRow(f, fid, idx, myFid, false, hsOn, startW, endLtsW);
            });
        }

        html += 'tbody></table></div>';
        container.innerHTML = html;
    }

    /**
     * Render Single Team Scoring Row
     */
    function renderTeamRow(franchise, fid, rowIdx, myFid, ltsOn, hsOn, startW, endLtsW) {
        var isMyTeam = (myFid && fid === myFid);
        var rowClass = (rowIdx % 2 === 0 ? 'dnfl-row-odd' : 'dnfl-row-even') + (isMyTeam ? ' dnfl-my-team' : '');
        var elimInfo = moduleState.lts_eliminations[fid];

        var html = '<tr class="' + rowClass + '">';
        html += '<td class="dnfl-col-franchise dnfl-sticky-col">' + buildFranchiseCell(franchise) + '</td>';

        for (var w = 1; w <= moduleState.endWeek; w++) {
            if (w > moduleState.maxCompletedWeek) {
                html += '<td class="dnfl-text-center dnfl-text-muted">—</td>';
                continue;
            }

            var wResults = moduleState.weeklyResults[w] || [];
            var match = wResults.find(function(r) { return normFranchiseId(r.franchiseId) === fid; });
            var score = match ? parseFloat(match.score || 0).toFixed(2) : '0.00';

            var summary = moduleState.lts_weeklySummaries[w - 1] || {};
            var isHighScore = (summary.highScorerFid === fid);
            var isEliminatedThisWeek = (summary.eliminatedFid === fid);

            var cellContent = '';

            if (elimInfo && w > elimInfo.week) {
                // Post-elimination score
                cellContent = '<span class="dnfl-text-muted dnfl-italic">' + score + '</span>';
            } else if (ltsOn && w === endLtsW && !elimInfo && isHighScore) {
                // Final Week Champion
                cellContent = '<span class="dnfl-pill dnfl-pill-blue">' + score + ' <i class="fa-solid fa-medal"></i></span>';
            } else if (isEliminatedThisWeek) {
                // Knockout score
                cellContent = '<span class="dnfl-pill dnfl-pill-red">' + score + ' <i class="fa-solid fa-skull"></i></span>';
            } else if (isHighScore && hsOn) {
                // Weekly High Score
                cellContent = '<span class="dnfl-pill dnfl-pill-green">' + score + ' <i class="fa-solid fa-star"></i></span>';
            } else if (isHighScore && !hsOn) {
                cellContent = '<span class="dnfl-badge dnfl-badge-green">' + score + '</span>';
            } else {
                cellContent = '<span class="dnfl-badge dnfl-badge-red">' + score + '</span>';
            }

            html += '<td class="dnfl-text-center">' + cellContent + '</td>';
        }

        html += '</tr>';
        return html;
    }

    /**
     * Render Table 2: Weekly Summary Table
     */
    function renderWeeklySummaryTable(confTeams, ltsOn, hsOn) {
        var summarySection = document.getElementById('dnfl-lts-summary-section');
        var container = document.getElementById('dnfl-lts-summary-container');
        if (!container || !summarySection) return;

        if (!ltsOn && !hsOn) {
            summarySection.classList.add('dnfl-is-hidden');
            container.innerHTML = '';
            return;
        }

        summarySection.classList.remove('dnfl-is-hidden');

        var totalCols = 1 + (ltsOn ? 2 : 0) + (hsOn ? 2 : 0);

        var html = '<div id="dnfl-lts-summary-wrapper" class="dnfl-table-wrapper">' +
            '<table class="dnfl-lts-summary-table dnfl-table">' +
            '<thead>' +
            '<tr>' +
            '<th class="dnfl-col-week">Week</th>';

        if (ltsOn) {
            html += '<th class="dnfl-col-franchise">Eliminated Franchise</th>' +
                '<th class="dnfl-col-score">Knockout Score</th>';
        }

        if (hsOn) {
            html += '<th class="dnfl-col-franchise">Weekly High Scorer</th>' +
                '<th class="dnfl-col-score">High Score</th>';
        }

        html += '</tr></thead><tbody>';

        // In-table Section Header Row
        html += '<tr class="dnfl-table-section-header">' +
            '<td colspan="' + totalCols + '" class="dnfl-table-section-header-cell dnfl-sticky-col">' +
            '<div class="dnfl-table-section-header-content"><h3>Weekly Summary</h3></div>' +
            '</td></tr>';

        moduleState.lts_weeklySummaries.forEach(function(s, idx) {
            var rowClass = (idx % 2 === 0 ? 'dnfl-row-odd' : 'dnfl-row-even');
            html += '<tr class="' + rowClass + '">' +
                '<td class="dnfl-col-week">Week ' + s.week + '</td>';

            if (ltsOn) {
                var elimFranchise = confTeams.find(function(f) { return normFranchiseId(f.id) === s.eliminatedFid; });
                var elimCell = elimFranchise ? buildFranchiseCell(elimFranchise) : '<span class="dnfl-text-muted">—</span>';
                var scoreCell = s.knockoutScore !== null ? '<span class="dnfl-pill dnfl-pill-red">' + parseFloat(s.knockoutScore).toFixed(2) + ' <i class="fa-solid fa-skull"></i></span>' : '<span class="dnfl-text-muted">—</span>';

                html += '<td class="dnfl-col-franchise">' + elimCell + '</td>' +
                    '<td class="dnfl-col-score">' + scoreCell + '</td>';
            }

            if (hsOn) {
                var highFranchise = confTeams.find(function(f) { return normFranchiseId(f.id) === s.highScorerFid; });
                var highCell = highFranchise ? buildFranchiseCell(highFranchise) : '<span class="dnfl-text-muted">—</span>';
                var scoreCell = s.highScore > 0 ? '<span class="dnfl-pill dnfl-pill-green">' + parseFloat(s.highScore).toFixed(2) + ' <i class="fa-solid fa-star"></i></span>' : '<span class="dnfl-text-muted">—</span>';

                html += '<td class="dnfl-col-franchise">' + highCell + '</td>' +
                    '<td class="dnfl-col-score">' + scoreCell + '</td>';
            }

            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    /**
     * Render Dynamic Legend Panel
     */
    function renderLegendPanel(ltsOn, hsOn, startW, endLtsW) {
        var legendContainer = document.getElementById('dnfl-lts-legend');
        if (!legendContainer) return;

        var html = '<div class="dnfl-legend-items">' +
            '<div class="dnfl-legend-item"><span class="dnfl-pill dnfl-pill-blue"><i class="fa-solid fa-medal"></i></span><span class="dnfl-legend-label">LTS Champion</span></div>' +
            '<div class="dnfl-legend-item"><span class="dnfl-pill dnfl-pill-green"><i class="fa-solid fa-star"></i></span><span class="dnfl-legend-label">High Score</span></div>' +
            '<div class="dnfl-legend-item"><span class="dnfl-pill dnfl-pill-red"><i class="fa-solid fa-skull"></i></span><span class="dnfl-legend-label">LTS Elimination</span></div>' +
            '<div class="dnfl-legend-item"><span class="dnfl-badge dnfl-badge-green">&nbsp;</span><span class="dnfl-legend-label">High Score (Off)</span></div>' +
            '<div class="dnfl-legend-item"><span class="dnfl-badge dnfl-badge-red">&nbsp;</span><span class="dnfl-legend-label">Low Score (Safe)</span></div>' +
            '</div>';

        if (ltsOn) {
            html += '<div class="dnfl-legend-note">*LTS eliminations active Weeks ' + startW + '–' + endLtsW + '</div>';
        }

        legendContainer.innerHTML = html;
    }

    /**
     * Action Toggle Handlers
     */
    function toggleScores() {
        var sec = document.getElementById('dnfl-lts-scores-section');
        var btn = document.getElementById('dnfl-btn-lts-scores');
        if (!sec || !btn) return;

        var isHidden = sec.classList.toggle('dnfl-is-hidden');
        btn.innerHTML = isHidden 
            ? '<i class="fa-solid fa-table-cells"></i> Show Scores' 
            : '<i class="fa-solid fa-table-cells"></i> Hide Scores';
    }

    function toggleSummary() {
        var sec = document.getElementById('dnfl-lts-summary-section');
        var btn = document.getElementById('dnfl-btn-lts-summary');
        if (!sec || !btn) return;

        var isHidden = sec.classList.toggle('dnfl-is-hidden');
        btn.innerHTML = isHidden 
            ? '<i class="fa-solid fa-list-check"></i> Show Summary' 
            : '<i class="fa-solid fa-list-check"></i> Hide Summary';
    }

    /**
     * Primary Initialization Workflow
     */
    function init() {
        if (moduleState.initialized) return;

        var container = document.getElementById('dnfl-lts-container');
        if (!container) {
            var retries = 0;
            var interval = setInterval(function() {
                retries++;
                container = document.getElementById('dnfl-lts-container');
                if (container || retries >= 50) {
                    clearInterval(interval);
                    if (container) startInitProcess();
                }
            }, 100);
            return;
        }

        startInitProcess();
    }

    function startInitProcess() {
        moduleState.initialized = true;

        var ctx = client ? client.getContext() : {};
        moduleState.activeYear = ctx.year || window.current_year || window.year || new Date().getFullYear();
        moduleState.leagueId = ctx.leagueId || window.league_id || '22883';
        moduleState.userFranchiseId = client ? client.getFranchiseId() : null;

        // Fetch League Metadata
        client.fetchData('league', { L: moduleState.leagueId }, client.TTL.WEEKLY).then(function(leagueData) {
            moduleState.league = leagueData;
            moduleState.endWeek = Number(leagueData.lastRegularSeasonWeek || 14);

            // Populate Conference Dropdown
            populateConferenceSelect(leagueData);

            // Fetch lts_rules.json with fallback
            var rulesPath = 'dnfl_lts/' + moduleState.activeYear + '/lts_rules.json';
            return client.fetchData('custom', { url: rulesPath }, client.TTL.DAILY).catch(function() { return {}; });
        }).then(function(rules) {
            moduleState.rulesConfig = rules || {};

            // Fetch Multi-Week Results in Parallel
            var fetchPromises = [];
            for (var w = 1; w <= moduleState.endWeek; w++) {
                (function(weekNum) {
                    var p = client.fetchData('weeklyResults', { W: String(weekNum), L: moduleState.leagueId }, client.TTL.HOURLY)
                        .then(function(data) {
                            var matchups = (data && data.matchup) ? (Array.isArray(data.matchup) ? data.matchup : [data.matchup]) : [];
                            var scores = [];
                            matchups.forEach(function(m) {
                                var franchises = (m && m.franchise) ? (Array.isArray(m.franchise) ? m.franchise : [m.franchise]) : [];
                                franchises.forEach(function(f) {
                                    if (f && f.id) {
                                        scores.push({ franchiseId: f.id, score: f.score || '0' });
                                    }
                                });
                            });
                            return { week: weekNum, scores: scores };
                        })
                        .catch(function() {
                            return { week: weekNum, scores: [] };
                        });
                    fetchPromises.push(p);
                })(w);
            }

            return Promise.all(fetchPromises);
        }).then(function(allWeeks) {
            var maxComp = 0;
            allWeeks.forEach(function(wData) {
                moduleState.weeklyResults[wData.week] = wData.scores;
                if (wData.scores.length > 0 && wData.week > maxComp) {
                    maxComp = wData.week;
                }
            });
            moduleState.maxCompletedWeek = maxComp;

            // Trigger Initial View Render
            updateView();
        }).catch(function(err) {
            console.error('[DNFL.LTS] Initialization Error:', err);
        });
    }

    function populateConferenceSelect(leagueData) {
        var select = document.getElementById('dnfl-lts-conference-select');
        if (!select) return;

        var html = '';
        var confs = (leagueData && leagueData.conferences && leagueData.conferences.conference) 
            ? (Array.isArray(leagueData.conferences.conference) ? leagueData.conferences.conference : [leagueData.conferences.conference])
            : [];

        if (confs.length > 0) {
            confs.forEach(function(c) {
                html += '<option value="' + c.id + '">' + c.name + '</option>';
            });
        } else {
            html += '<option value="ALL">All League Teams</option>';
        }

        select.innerHTML = html;

        // Auto-select user conference
        if (moduleState.userFranchiseId && leagueData && leagueData.franchises && leagueData.franchises.franchise) {
            var myFid = normFranchiseId(moduleState.userFranchiseId);
            var franchises = Array.isArray(leagueData.franchises.franchise) ? leagueData.franchises.franchise : [leagueData.franchises.franchise];
            var myFranchise = franchises.find(function(f) { return normFranchiseId(f.id) === myFid; });
            if (myFranchise && myFranchise.conference) {
                select.value = myFranchise.conference;
            }
        }
    }

    // Export Public API Namespace
    window.DNFL.LTS = {
        init: init,
        updateView: updateView,
        toggleScores: toggleScores,
        toggleSummary: toggleSummary
    };

    // Lifecycle Binding
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('dnfl:ready', init);
        window.addEventListener('DOMContentLoaded', init);
    }
})();
