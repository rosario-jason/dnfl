/**
 * Duke Networking Fantasy League (DNFL) Last Team Standing (LTS) Module
 * File: scripts/dnfl-lts-v2_12.js
 * Version: v2_12
 * Module Namespace: DNFL.LTS
 */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};

    var activeHost = window.location.hostname || "myfantasyleague.com";
    var targetYear = window.current_year || null;
    if (!targetYear && window.location) {
        var pathSegments = window.location.pathname.split('/');
        var foundYear = pathSegments.find(function(segment) { return /^20\d{2}$/.test(segment); });
        if (foundYear) targetYear = foundYear;
    }
    if (!targetYear) targetYear = new Date().getFullYear().toString();

    function norm(val) {
        if (!val && val !== 0) return '';
        var str = String(val).trim();
        return str.length === 1 ? '0' + str : str;
    }

    function normFranchiseId(val) {
        if (!val && val !== 0) return '';
        var str = String(val).trim();
        while (str.length < 4) str = '0' + str;
        return str;
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function getApiClient() {
        return (window.DNFL && window.DNFL.Client) || window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
    }

    function getLeagueId() {
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.getContext === 'function') {
            return window.DNFL.Client.getContext().leagueId;
        }
        var urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('L') || urlParams.get('l') || window.league_id || window.mflLeagueId || '22883';
    }

    function getLoggedInFranchiseId() {
        var fid = window.franchise_id || window.mflFranchiseId || window.login_franchise_id || window.current_franchise_id;
        if (!fid && window.DNFLClient && typeof window.DNFLClient.getFranchiseId === 'function') {
            fid = window.DNFLClient.getFranchiseId();
        }
        if (!fid && window.location && window.location.search) {
            var urlParams = new URLSearchParams(window.location.search);
            fid = urlParams.get('F') || urlParams.get('FRANCHISE_ID') || urlParams.get('f');
        }
        if (!fid && document.cookie) {
            var cookieMatch = document.cookie.match(/(?:MFL_USER_ID|MFL_FRANCHISE_ID|franchise_id)=([^;]+)/i);
            if (cookieMatch && cookieMatch[1]) {
                var rawCookieVal = decodeURIComponent(cookieMatch[1]);
                var idMatch = rawCookieVal.match(/(?:u%3D|u=)?(\d{4})/i);
                if (idMatch && idMatch[1]) fid = idMatch[1];
            }
        }
        if (!fid) {
            var myTeamLink = document.querySelector('a[href*="O=01"], a[href*="O=02"], a[href*="F="]');
            if (myTeamLink && myTeamLink.href) {
                var hrefMatch = myTeamLink.href.match(/[?&]F=(\d{4})/i);
                if (hrefMatch && hrefMatch[1]) fid = hrefMatch[1];
            }
        }
        if (!fid) {
            var inputEl = document.querySelector('input[name="FRANCHISE_ID"], select[name="FRANCHISE_ID"]');
            if (inputEl) fid = inputEl.value;
        }
        var normalized = normFranchiseId(fid);
        return (normalized && normalized !== '0000') ? normalized : null;
    }

    // Module Internal State
    var cachedLeague = null;
    var cachedFranchises = [];
    var cachedConferences = [];
    var cachedDivisions = [];
    var cachedWeeklyResults = {};
    var cachedRulesConfig = {};
    var cachedEndWeek = 14;
    var cachedMaxCompletedWeek = 0;
    var divToConfMap = {};

    /**
     * Build Franchise Name Cell Component with Dynamic Host Link
     */
    function buildFranchiseCell(franchise) {
        if (!franchise) return '<span class="dnfl-text-muted">—</span>';

        var fid = normFranchiseId(franchise.id);
        var name = franchise.name || ('Franchise ' + fid);
        var ownerName = franchise.owner_name || franchise.username || '';
        var iconUrl = franchise.icon ? franchise.icon.toString().trim() : 'https://dnfl.live/images/ficon-dnfl.png';
        var activeLeagueId = getLeagueId();

        var url = 'https://' + activeHost + '/' + targetYear + '/options?L=' + activeLeagueId + '&F=' + fid + '&O=01';
        var ownerHtml = ownerName ? '<span class="dnfl-owner-name">' + ownerName + '</span>' : '';

        return '<div class="dnfl-franchise-cell">' +
            '<a href="' + url + '" title="View Franchise Page">' +
            '<img src="' + iconUrl + '" alt="' + name + '" class="franchiseicon" onError="this.onerror=null;this.src=\'https://dnfl.live/images/ficon-dnfl.png\';" />' +
            '</a>' +
            '<div class="dnfl-franchise-info">' +
            '<a href="' + url + '" class="dnfl-team-name">' + name + '</a>' +
            ownerHtml +
            '</div>' +
            '</div>';
    }

    /**
     * Conference Rules Resolver (3-Tier Cascading)
     */
    function getConferenceRules(confId) {
        var confKey = norm(confId) || 'default';
        var overrides = (cachedRulesConfig && cachedRulesConfig.conferenceOverrides && cachedRulesConfig.conferenceOverrides[confKey])
            ? cachedRulesConfig.conferenceOverrides[confKey] : {};
        var globalDefaults = (cachedRulesConfig && cachedRulesConfig['default'])
            ? cachedRulesConfig['default'] : {};

        var rawStart = (overrides.lts_startWeek !== undefined) ? overrides.lts_startWeek : (globalDefaults.lts_startWeek !== undefined ? globalDefaults.lts_startWeek : 'auto');
        var rawEnd = (overrides.lts_endWeek !== undefined) ? overrides.lts_endWeek : (globalDefaults.lts_endWeek !== undefined ? globalDefaults.lts_endWeek : 'auto');

        return {
            lts_isEnabled: (overrides.lts_isEnabled !== undefined) ? overrides.lts_isEnabled : (globalDefaults.lts_isEnabled !== undefined ? globalDefaults.lts_isEnabled : true),
            lts_startWeek: rawStart,
            lts_endWeek: rawEnd,
            highScore_isEnabled: (overrides.highScore_isEnabled !== undefined) ? overrides.highScore_isEnabled : (globalDefaults.highScore_isEnabled !== undefined ? globalDefaults.highScore_isEnabled : true)
        };
    }

    /**
     * Primary Render / Update Controller
     */
    function updateView() {
        var confSelect = document.getElementById('dnfl-lts-conference-select');
        var selectedConf = confSelect ? confSelect.value : '';

        // Filter Franchises by Selected Conference
        var confTeams = cachedFranchises.filter(function(f) {
            if (!selectedConf) return true;
            var fConf = f.conference ? norm(f.conference) : (f.division ? divToConfMap[norm(f.division)] : '');
            return fConf === norm(selectedConf);
        });

        // Resolve Active Rules Configuration
        var rules = getConferenceRules(selectedConf);
        var ltsOn = rules.lts_isEnabled;
        var hsOn = rules.highScore_isEnabled;

        var totalTeams = confTeams.length || 12;

        // Calculate LTS week bounds with robust 'auto' support
        var rawStart = String(rules.lts_startWeek).toLowerCase().trim();
        var startW = (rawStart === 'auto' || rawStart === '' || isNaN(Number(rawStart)))
            ? Math.max(1, cachedEndWeek - (totalTeams - 1) + 1)
            : Number(rawStart);

        var rawEnd = String(rules.lts_endWeek).toLowerCase().trim();
        var endLtsW = (rawEnd === 'auto' || rawEnd === '' || isNaN(Number(rawEnd)))
            ? (startW + (totalTeams - 2))
            : Number(rawEnd);

        // Update Card Title
        var matchConf = cachedConferences.find(function(c) { return norm(c.id) === norm(selectedConf); });
        var confName = matchConf ? matchConf.name : (selectedConf ? ('Conference ' + selectedConf) : 'All League');
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

        var maxW = cachedMaxCompletedWeek;

        for (var w = 1; w <= maxW; w++) {
            var wResults = cachedWeeklyResults[w] || [];
            var scoresThisWeek = {}; // fid -> score

            activeFids.forEach(function(fid) {
                var match = wResults.find(function(r) { return normFranchiseId(r.franchiseId) === fid; });
                var score = match ? parseFloat(match.score || 0) : 0;
                scoresThisWeek[fid] = score;
                cumulativeYtd[fid] = (cumulativeYtd[fid] || 0) + score;
            });

            // Identify High Scorer (among active/competing teams)
            var highScorerFid = null;
            var highScoreVal = -1;

            var eligibleLtsFids = activeFids.filter(function(fid) { return !eliminations[fid]; });

            eligibleLtsFids.forEach(function(fid) {
                var s = scoresThisWeek[fid];
                if (s > highScoreVal) {
                    highScoreVal = s;
                    highScorerFid = fid;
                }
            });

            // Identify Lowest Score across ALL conference franchises (active AND eliminated)
            var overallLowScoreVal = 99999;
            activeFids.forEach(function(fid) {
                var s = scoresThisWeek[fid];
                if (s < overallLowScoreVal) {
                    overallLowScoreVal = s;
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
                    // Tiebreaker 1: Fewest total YTD points scored
                    tiedFids.sort(function(a, b) {
                        var ytdA = cumulativeYtd[a];
                        var ytdB = cumulativeYtd[b];
                        if (ytdA !== ytdB) return ytdA - ytdB;

                        // Tiebreaker 2: Lowest prior week score
                        var prevA = w > 1 ? (cachedWeeklyResults[w - 1] ? parseFloat((cachedWeeklyResults[w - 1].find(function(r) { return normFranchiseId(r.franchiseId) === a; }) || {}).score || 0) : 0) : 0;
                        var prevB = w > 1 ? (cachedWeeklyResults[w - 1] ? parseFloat((cachedWeeklyResults[w - 1].find(function(r) { return normFranchiseId(r.franchiseId) === b; }) || {}).score || 0) : 0) : 0;
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
                overallLowScore: overallLowScoreVal !== 99999 ? overallLowScoreVal : null,
                eliminatedFid: eliminatedFidThisWeek,
                knockoutScore: lowScoreVal !== 99999 ? lowScoreVal : null
            });
        }

        // Render View A: Table 1 - Weekly Scores
        renderWeeklyScoresTable(confTeams, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries);

        // Render View B: Table 2 - Weekly Summary
        renderWeeklySummaryTable(confTeams, ltsOn, hsOn, weeklySummaries);

        // Render Dynamic Legend
        renderLegendPanel(ltsOn, hsOn, startW, endLtsW);
    }

    /**
     * Render Table 1: Weekly Scores Matrix
     */
    function renderWeeklyScoresTable(confTeams, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries) {
        var container = document.getElementById('dnfl-lts-scores-container');
        if (!container) return;

        var myFid = getLoggedInFranchiseId();
        var totalCols = cachedEndWeek + 1;

        var html = '<div id="dnfl-lts-scores-wrapper" class="dnfl-table-wrapper">' +
            '<table class="dnfl-lts-scores-table dnfl-table">' +
            '<thead>' +
            '<tr class="dnfl-table-section-header">' +
            '<td colspan="' + totalCols + '" class="dnfl-table-section-header-cell">' +
            '<div class="dnfl-table-section-header-content"><h3>Weekly Scores</h3></div>' +
            '</td></tr>' +
            '<tr class="dnfl-table-subheader">' +
            '<th class="dnfl-col-franchise dnfl-sticky-col">Franchise</th>';

        for (var w = 1; w <= cachedEndWeek; w++) {
            var skullIcon = (ltsOn && w >= startW && w <= endLtsW) ? ' <i class="fa-solid fa-skull dnfl-icon-danger"></i>' : '';
            html += '<th class="dnfl-text-center">W' + w + skullIcon + '</th>';
        }

        html += '</tr>' +
            '</thead>' +
            '<tbody>';

        if (ltsOn) {
            // Group Teams: Active vs Eliminated
            var activeGroup = [];
            var elimGroup = [];

            confTeams.forEach(function(f) {
                var fid = normFranchiseId(f.id);
                var elimInfo = eliminations[fid];
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

            // Render Active or Champion Section
            if (activeGroup.length === 1) {
                html += '<tr class="dnfl-subhead-champion"><td colspan="' + totalCols + '" class="dnfl-sticky-col"><div class="dnfl-subhead-content">LTS Champion</div></td></tr>';
            } else if (activeGroup.length > 1) {
                html += '<tr class="dnfl-subhead-active"><td colspan="' + totalCols + '" class="dnfl-sticky-col"><div class="dnfl-subhead-content">LTS Active Teams (' + activeGroup.length + ')</div></td></tr>';
            }

            activeGroup.forEach(function(item, idx) {
                html += renderTeamRow(item.franchise, item.fid, idx, myFid, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries);
            });

            // Render Eliminated Section
            if (elimGroup.length > 0) {
                html += '<tr class="dnfl-subhead-eliminated"><td colspan="' + totalCols + '" class="dnfl-sticky-col"><div class="dnfl-subhead-content">LTS Eliminated Teams (' + elimGroup.length + ')</div></td></tr>';
                elimGroup.forEach(function(item, idx) {
                    html += renderTeamRow(item.franchise, item.fid, idx, myFid, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries);
                });
            }
        } else {
            // LTS Disabled: Single table sorted A-Z
            var sortedTeams = confTeams.slice().sort(function(a, b) {
                return (a.name || '').localeCompare(b.name || '');
            });

            sortedTeams.forEach(function(f, idx) {
                var fid = normFranchiseId(f.id);
                html += renderTeamRow(f, fid, idx, myFid, false, hsOn, startW, endLtsW, eliminations, weeklySummaries);
            });
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    /**
     * Render Single Team Scoring Row
     */
    function renderTeamRow(franchise, fid, rowIdx, myFid, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries) {
        var isMyTeam = (myFid && fid === myFid);
        var rowClass = (rowIdx % 2 === 0 ? 'dnfl-row-odd' : 'dnfl-row-even') + (isMyTeam ? ' dnfl-my-team' : '');
        var elimInfo = eliminations[fid];

        var html = '<tr class="' + rowClass + '">';
        html += '<td class="dnfl-col-franchise dnfl-sticky-col">' + buildFranchiseCell(franchise) + '</td>';

        for (var w = 1; w <= cachedEndWeek; w++) {
            if (w > cachedMaxCompletedWeek) {
                html += '<td class="dnfl-text-center dnfl-text-muted">—</td>';
                continue;
            }

            var wResults = cachedWeeklyResults[w] || [];
            var match = wResults.find(function(r) { return normFranchiseId(r.franchiseId) === fid; });
            var numScore = match ? parseFloat(match.score || 0) : 0;
            var score = numScore.toFixed(2);

            var summary = weeklySummaries[w - 1] || {};
            var isHighScore = (summary.highScorerFid === fid || (numScore === summary.highScore && numScore > 0));
            var isLowScore = (summary.overallLowScore !== null && Math.abs(numScore - summary.overallLowScore) < 0.001);
            var isEliminatedThisWeek = (summary.eliminatedFid === fid);

            var cellContent = '';

            if (ltsOn && w === endLtsW && !elimInfo && isHighScore) {
                // Final Week Champion
                cellContent = '<span class="dnfl-pill dnfl-pill-blue">' + score + ' <i class="fa-solid fa-medal"></i></span>';
            } else if (isEliminatedThisWeek) {
                // Knockout score (If low score is the eliminated score, ONLY the skull pill is shown)
                cellContent = '<span class="dnfl-pill dnfl-pill-red">' + score + ' <i class="fa-solid fa-skull"></i></span>';
            } else if (isHighScore && hsOn) {
                // Weekly High Score Winner
                cellContent = '<span class="dnfl-pill dnfl-pill-green">' + score + ' <i class="fa-solid fa-star"></i></span>';
            } else if (isHighScore && !hsOn) {
                // High Score Badge when feature off
                cellContent = '<span class="dnfl-badge dnfl-badge-green">' + score + '</span>';
            } else if (isLowScore) {
                // Low Score Badge (Applies to ALL franchises, active and eliminated)
                cellContent = '<span class="dnfl-badge dnfl-badge-red">' + score + '</span>';
            } else if (elimInfo && w > elimInfo.week) {
                // Post-elimination score (when NOT low score)
                cellContent = '<span class="dnfl-text-muted dnfl-italic">' + score + '</span>';
            } else {
                // Regular active score
                cellContent = score;
            }

            html += '<td class="dnfl-text-center">' + cellContent + '</td>';
        }

        html += '</tr>';
        return html;
    }

    /**
     * Render Table 2: Weekly Summary Table
     */
    function renderWeeklySummaryTable(confTeams, ltsOn, hsOn, weeklySummaries) {
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
            '<tr class="dnfl-table-section-header">' +
            '<td colspan="' + totalCols + '" class="dnfl-table-section-header-cell">' +
            '<div class="dnfl-table-section-header-content"><h3>Weekly Summary</h3></div>' +
            '</td></tr>' +
            '<tr class="dnfl-table-subheader">' +
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

        weeklySummaries.forEach(function(s, idx) {
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

        var itemsHtml = '';

        if (ltsOn) {
            itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-pill dnfl-pill-blue"><i class="fa-solid fa-medal"></i></span><span class="dnfl-legend-label">LTS Champion</span></div>';
        }

        if (hsOn) {
            itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-pill dnfl-pill-green"><i class="fa-solid fa-star"></i></span><span class="dnfl-legend-label">High Score Winner</span></div>';
        }

        if (ltsOn) {
            itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-pill dnfl-pill-red"><i class="fa-solid fa-skull"></i></span><span class="dnfl-legend-label">LTS Elimination</span></div>';
        }

        if (!hsOn) {
            itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-badge dnfl-badge-green">&nbsp;</span><span class="dnfl-legend-label">High Score</span></div>';
        }

        itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-badge dnfl-badge-red">&nbsp;</span><span class="dnfl-legend-label">Low Score</span></div>';

        var html = '<div class="dnfl-legend-items">' + itemsHtml + '</div>';

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

    function populateConferenceSelect() {
        var select = document.getElementById('dnfl-lts-conference-select');
        if (!select) return;

        var html = '';
        if (cachedConferences.length > 0) {
            cachedConferences.forEach(function(c) {
                html += '<option value="' + c.id + '">' + c.name + '</option>';
            });
        } else {
            html += '<option value="ALL">All League Teams</option>';
        }

        select.innerHTML = html;

        // Auto-select logged in user's conference
        var myFid = getLoggedInFranchiseId();
        if (myFid) {
            var myFranchise = cachedFranchises.find(function(f) { return normFranchiseId(f.id) === myFid; });
            if (myFranchise) {
                var userConf = myFranchise.conference ? norm(myFranchise.conference) : (myFranchise.division ? divToConfMap[norm(myFranchise.division)] : '');
                if (userConf) select.value = userConf;
            }
        }
    }

    /**
     * Primary Initialization Workflow
     */
    var retryCount = 0;
    var maxRetries = 50;

    function init() {
        var container = document.getElementById('dnfl-lts-container');
        if (!container) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        startInitProcess();
    }

    async function startInitProcess() {
        var apiClient = getApiClient();
        if (!apiClient) {
            console.error('[DNFL.LTS] API Client middleware is unavailable.');
            return;
        }

        var ctx = typeof apiClient.getContext === 'function' ? apiClient.getContext() : {};
        var activeYear = ctx.year || targetYear;
        var leagueId = getLeagueId();

        try {
            var rulesUrl = 'https://dnfl.live/dnfl_lts/' + activeYear + '/lts_rules.json';

            var results = await Promise.all([
                apiClient.fetchData('league', { L: leagueId }, { ttl: apiClient.TTL.WEEKLY }).catch(function() { return {}; }),
                apiClient.fetchRawText(rulesUrl, { ttl: apiClient.TTL.DAILY }).catch(function() { return null; })
            ]);

            var leagueData = results[0] || {};
            var rawRules = results[1];

            cachedLeague = leagueData.league || leagueData || {};
            cachedFranchises = toArray(cachedLeague.franchises && cachedLeague.franchises.franchise);
            cachedConferences = toArray(cachedLeague.conferences && cachedLeague.conferences.conference);
            cachedDivisions = toArray(cachedLeague.divisions && cachedLeague.divisions.division);
            cachedEndWeek = Number(cachedLeague.lastRegularSeasonWeek || 14);

            divToConfMap = {};
            cachedDivisions.forEach(function(d) {
                divToConfMap[norm(d.id)] = norm(d.conference);
            });

            if (rawRules) {
                try {
                    cachedRulesConfig = JSON.parse(rawRules);
                } catch (e) {
                    console.warn('[DNFL LTS] Corrupted lts_rules.json format. Fallback engaged.');
                }
            }

            // Fetch Multi-Week Results in Parallel matching Exporter engine pattern
            var fetchPromises = [];
            for (var w = 1; w <= cachedEndWeek; w++) {
                (function(weekNum) {
                    var p = apiClient.fetchData('weeklyResults', { W: String(weekNum), L: leagueId }, { ttl: apiClient.TTL.HOURLY })
                        .then(function(data) {
                            var weeklyObj = (data && data.weeklyResults) ? data.weeklyResults : (data || {});
                            var rawMatchups = weeklyObj.matchup || weeklyObj.matchUp || (weeklyObj.schedule ? weeklyObj.schedule.matchup : null);
                            var matchups = rawMatchups ? toArray(rawMatchups) : [];

                            if (matchups.length === 0 && weeklyObj.franchise) {
                                var fList = toArray(weeklyObj.franchise);
                                fList.forEach(function(f) {
                                    if (f && f.id) matchups.push({ franchise: [f] });
                                });
                            }

                            var scores = [];
                            matchups.forEach(function(m) {
                                var franchises = (m && m.franchise) ? toArray(m.franchise) : [];
                                franchises.forEach(function(f) {
                                    if (f && f.id) {
                                        scores.push({ franchiseId: normFranchiseId(f.id), score: f.score || '0' });
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

            var allWeeks = await Promise.all(fetchPromises);
            var maxComp = 0;
            allWeeks.forEach(function(wData) {
                cachedWeeklyResults[wData.week] = wData.scores;
                if (wData.scores.length > 0 && wData.week > maxComp) {
                    maxComp = wData.week;
                }
            });
            cachedMaxCompletedWeek = maxComp;

            populateConferenceSelect();
            updateView();

        } catch (err) {
            console.error('[DNFL.LTS] Initialization Error:', err);
        }
    }

    // Export Public API Namespace Synchronously at IIFE evaluation time
    window.DNFL.LTS = {
        init: init,
        updateView: updateView,
        toggleScores: toggleScores,
        toggleSummary: toggleSummary
    };

    // Lifecycle Binding
    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
