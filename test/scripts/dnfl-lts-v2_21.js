/**
 * Duke Networking Fantasy League (DNFL) Framework
 * Last Team Standing (LTS) & High Score Tracker Module v2.21
 * File: dnfl-lts-v2_21.js
 */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};

    var targetYear = '2026';
    var cachedLeague = null;
    var cachedFranchises = [];
    var cachedConferences = [];
    var cachedDivisions = [];
    var cachedRulesConfig = null;
    var cachedWeeklyResults = {}; // weekNum -> Array of { franchiseId, score }
    var cachedMaxCompletedWeek = 0;
    var cachedEndWeek = 14;
    var divToConfMap = {};

    function getApiClient() {
        return (window.DNFL && window.DNFL.API) ? window.DNFL.API : null;
    }

    function getLeagueId() {
        var client = getApiClient();
        if (client && typeof client.getLeagueId === 'function') {
            return client.getLeagueId();
        }
        var match = window.location.search.match(/[?&]L=(\d+)/i);
        return match ? match[1] : '';
    }

    function norm(val) {
        if (!val) return '';
        var s = String(val).trim().toLowerCase();
        return s.length === 1 ? '0' + s : s;
    }

    function normFranchiseId(fid) {
        if (!fid) return '';
        var s = String(fid).trim();
        while (s.length < 4) s = '0' + s;
        return s;
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    function getLoggedInFranchiseId() {
        try {
            var myTeamLink = document.querySelector('a[href*="O=01"], a[href*="O=02"], a[href*="F="]');
            if (myTeamLink) {
                var match = myTeamLink.href.match(/F=(\d+)/i);
                if (match) return normFranchiseId(match[1]);
            }
            var inputEl = document.querySelector('input[name="FRANCHISE_ID"], select[name="FRANCHISE_ID"]');
            if (inputEl && inputEl.value) {
                return normFranchiseId(inputEl.value);
            }
        } catch (e) {}
        return null;
    }

    function getConferenceRules(confId) {
        if (!cachedRulesConfig || Object.keys(cachedRulesConfig).length === 0) {
            return null;
        }

        var leagueId = getLeagueId();
        var confKey = norm(confId) || 'default';

        var leagueObj = (cachedRulesConfig.leagueOverrides && cachedRulesConfig.leagueOverrides[leagueId])
            ? cachedRulesConfig.leagueOverrides[leagueId] : null;

        var overrides = null;
        var globalDefaults = null;

        if (leagueObj) {
            overrides = (leagueObj.conferenceOverrides && leagueObj.conferenceOverrides[confKey])
                ? leagueObj.conferenceOverrides[confKey] : null;
            globalDefaults = leagueObj['default'] || null;
        }

        if (!overrides && cachedRulesConfig.conferenceOverrides) {
            overrides = cachedRulesConfig.conferenceOverrides[confKey] || null;
        }

        if (!globalDefaults) {
            globalDefaults = cachedRulesConfig['default'] || null;
        }

        if (!overrides && !globalDefaults) {
            return null;
        }

        overrides = overrides || {};
        globalDefaults = globalDefaults || {};

        var rawStart = (overrides.lts_startWeek !== undefined) ? overrides.lts_startWeek : (globalDefaults.lts_startWeek !== undefined ? globalDefaults.lts_startWeek : 'auto');
        var rawEnd = (overrides.lts_endWeek !== undefined) ? overrides.lts_endWeek : (globalDefaults.lts_endWeek !== undefined ? globalDefaults.lts_endWeek : 'auto');

        return {
            isDefined: true,
            lts_isEnabled: (overrides.lts_isEnabled !== undefined) ? overrides.lts_isEnabled : (globalDefaults.lts_isEnabled !== undefined ? globalDefaults.lts_isEnabled : true),
            lts_startWeek: rawStart,
            lts_endWeek: rawEnd,
            highScore_isEnabled: (overrides.highScore_isEnabled !== undefined) ? overrides.highScore_isEnabled : (globalDefaults.highScore_isEnabled !== undefined ? globalDefaults.highScore_isEnabled : true)
        };
    }

    function buildFranchiseCell(franchise) {
        if (!franchise) return '<span class="dnfl-text-muted">—</span>';

        var iconUrl = franchise.icon || 'https://www.myfantasyleague.com/images/mfl_logo.gif';
        var name = franchise.name || ('Franchise ' + franchise.id);

        return '<div class="dnfl-franchise-cell">' +
            '<img class="franchiseicon" src="' + iconUrl + '" alt="' + name + '" loading="lazy" />' +
            '<span class="dnfl-franchise-name">' + name + '</span>' +
            '</div>';
    }

    /**
     * Primary Render / Update Controller
     */
    function updateView() {
        var confSelect = document.getElementById('dnfl-lts-conference-select');
        var controlsBox = document.querySelector('#dnfl-lts-container .dnfl-toolbar') ||
                          document.querySelector('#dnfl-lts-container .dnfl-card-controls') ||
                          document.querySelector('#dnfl-lts-container .dnfl-controls') ||
                          (confSelect ? (confSelect.closest('.dnfl-toolbar') || confSelect.closest('.dnfl-card-controls') || confSelect.closest('.dnfl-controls') || confSelect.parentElement) : null);

        var selectedConf = confSelect ? confSelect.value : '';

        // Filter Franchises by Selected Conference
        var confTeams = cachedFranchises.filter(function(f) {
            if (!selectedConf) return true;
            var fConf = f.conference ? norm(f.conference) : (f.division ? divToConfMap[norm(f.division)] : '');
            return fConf === norm(selectedConf);
        });

        // Resolve Active Rules Configuration
        var rules = getConferenceRules(selectedConf);
        var scoresSec = document.getElementById('dnfl-lts-scores-section');
        var summarySec = document.getElementById('dnfl-lts-summary-section');
        var legendSec = document.getElementById('dnfl-lts-legend');
        var cardBody = document.querySelector('#dnfl-lts-container .dnfl-card-body');
        var errorBanner = document.getElementById('dnfl-lts-error-banner');
        var infoBanner = document.getElementById('dnfl-lts-info-banner');

        if (!rules) {
            if (scoresSec) scoresSec.classList.add('dnfl-is-hidden');
            if (summarySec) summarySec.classList.add('dnfl-is-hidden');
            if (legendSec) legendSec.classList.add('dnfl-is-hidden');
            if (infoBanner) infoBanner.classList.add('dnfl-is-hidden');
            if (controlsBox) controlsBox.classList.add('dnfl-is-hidden');

            if (!errorBanner && cardBody) {
                errorBanner = document.createElement('div');
                errorBanner.id = 'dnfl-lts-error-banner';
                errorBanner.className = 'dnfl-status-error';
                cardBody.appendChild(errorBanner);
            }
            if (errorBanner) {
                errorBanner.classList.remove('dnfl-is-hidden');
                var apiClient = getApiClient();
                var ctx = (apiClient && typeof apiClient.getContext === 'function') ? apiClient.getContext() : {};
                var activeYear = ctx.year || targetYear;
                errorBanner.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + activeYear + ' LTS & High Score rules not defined - check JSON file';
            }

            var cardTitleElem = document.getElementById('dnfl-lts-card-title');
            if (cardTitleElem) {
                cardTitleElem.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> DNFL - Rules Configuration Error';
            }
            return;
        }

        if (errorBanner) {
            errorBanner.classList.add('dnfl-is-hidden');
        }

        // Handle pre-season / 0 completed weeks state
        if (cachedMaxCompletedWeek === 0) {
            if (scoresSec) scoresSec.classList.add('dnfl-is-hidden');
            if (summarySec) summarySec.classList.add('dnfl-is-hidden');
            if (legendSec) legendSec.classList.add('dnfl-is-hidden');
            if (controlsBox) controlsBox.classList.add('dnfl-is-hidden');

            if (!infoBanner && cardBody) {
                infoBanner = document.createElement('div');
                infoBanner.id = 'dnfl-lts-info-banner';
                infoBanner.className = 'dnfl-status-loading';
                cardBody.appendChild(infoBanner);
            }
            if (infoBanner) {
                infoBanner.classList.remove('dnfl-is-hidden');
                infoBanner.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> This module will populate once Week 1 scores are finalized.';
            }

            var ltsOnPre = rules.lts_isEnabled;
            var cardTitleElemPre = document.getElementById('dnfl-lts-card-title');
            if (cardTitleElemPre) {
                var isMobile = window.innerWidth <= 768;
                if (ltsOnPre) {
                    var titleText = isMobile
                        ? '<i class="fa-solid fa-clock-rotate-left"></i> DNFL LTS & Weekly Summary'
                        : '<i class="fa-solid fa-clock-rotate-left"></i> DNFL Last Team Standing & Weekly Summary';
                    cardTitleElemPre.innerHTML = titleText;
                } else {
                    cardTitleElemPre.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> DNFL Weekly Summary';
                }
            }
            return;
        }

        if (infoBanner) {
            infoBanner.classList.add('dnfl-is-hidden');
        }
        if (scoresSec) {
            scoresSec.classList.remove('dnfl-is-hidden');
        }
        if (controlsBox) {
            controlsBox.classList.remove('dnfl-is-hidden');
        }

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

        // Update Card Title Dynamically with Conference Name during active season
        var matchConf = cachedConferences.find(function(c) { return norm(c.id) === norm(selectedConf); });
        var confName = matchConf ? matchConf.name : (selectedConf ? ('Conference ' + selectedConf) : 'All League');
        var cardTitleElem = document.getElementById('dnfl-lts-card-title');

        if (cardTitleElem) {
            var isMobile = window.innerWidth <= 768;
            if (ltsOn) {
                var titleText = isMobile
                    ? '<i class="fa-solid fa-medal"></i> ' + confName + ' LTS & Weekly Summary'
                    : '<i class="fa-solid fa-medal"></i> ' + confName + ' Last Team Standing & Weekly Summary';
                cardTitleElem.innerHTML = titleText;
            } else {
                cardTitleElem.innerHTML = '<i class="fa-solid fa-list"></i> ' + confName + ' Weekly Summary';
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

            // Identify High Scorer across ALL conference franchises (active AND eliminated)
            var highScorerFid = null;
            var highScoreVal = -1;

            activeFids.forEach(function(fid) {
                var s = scoresThisWeek[fid];
                if (s > highScoreVal) {
                    highScoreVal = s;
                    highScorerFid = fid;
                }
            });

            var eligibleLtsFids = activeFids.filter(function(fid) { return !eliminations[fid]; });

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

        // Determine Champion Week for survivor medal
        var championWeek = null;
        if (ltsOn) {
            var survivingFids = activeFids.filter(function(fid) { return !eliminations[fid]; });
            if (survivingFids.length === 1) {
                var lastElimW = 0;
                Object.keys(eliminations).forEach(function(fid) {
                    if (eliminations[fid].week > lastElimW) {
                        lastElimW = eliminations[fid].week;
                    }
                });
                championWeek = lastElimW || endLtsW;
            } else if (cachedMaxCompletedWeek >= endLtsW && endLtsW > 0) {
                championWeek = endLtsW;
            }
        }

        // Render View A: Table 1 - Weekly Scores
        renderWeeklyScoresTable(confTeams, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek);

        // Render View B: Table 2 - Weekly Summary
        renderWeeklySummaryTable(confTeams, ltsOn, hsOn, weeklySummaries);

        // Render Dynamic Legend
        renderLegendPanel(ltsOn, hsOn, startW, endLtsW);
    }

    /**
     * Render Table 1: Weekly Scores Matrix
     */
    function renderWeeklyScoresTable(confTeams, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek) {
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
            // Group 1: Active / Surviving Franchises
            var activeList = confTeams.filter(function(f) { return !eliminations[normFranchiseId(f.id)]; });
            // Group 2: Eliminated Franchises
            var elimList = confTeams.filter(function(f) { return !!eliminations[normFranchiseId(f.id)]; });

            elimList.sort(function(a, b) {
                var elimA = eliminations[normFranchiseId(a.id)];
                var elimB = eliminations[normFranchiseId(b.id)];
                return elimB.week - elimA.week;
            });

            if (activeList.length > 0) {
                var subheadText = (activeList.length === 1 && cachedMaxCompletedWeek >= endLtsW) ? 'LTS Champion' : 'Active Teams (' + activeList.length + ')';
                var subheadClass = (activeList.length === 1 && cachedMaxCompletedWeek >= endLtsW) ? 'dnfl-subhead-champion' : 'dnfl-subhead-active';

                html += '<tr class="dnfl-table-subheader ' + subheadClass + '">' +
                    '<td colspan="' + totalCols + '">' + subheadText + '</td>' +
                    '</tr>';

                activeList.forEach(function(f, idx) {
                    var fid = normFranchiseId(f.id);
                    html += renderTeamRow(f, fid, idx, myFid, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek);
                });
            }

            if (elimList.length > 0) {
                html += '<tr class="dnfl-table-subheader dnfl-subhead-eliminated">' +
                    '<td colspan="' + totalCols + '">Eliminated Teams (' + elimList.length + ')</td>' +
                    '</tr>';

                elimList.forEach(function(f, idx) {
                    var fid = normFranchiseId(f.id);
                    html += renderTeamRow(f, fid, idx, myFid, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek);
                });
            }
        } else {
            confTeams.forEach(function(f, idx) {
                var fid = normFranchiseId(f.id);
                html += renderTeamRow(f, fid, idx, myFid, false, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek);
            });
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    function renderTeamRow(franchise, fid, rowIdx, myFid, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek) {
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

            if (ltsOn && w === championWeek && !elimInfo) {
                // Final Week Champion
                cellContent = '<span class="dnfl-pill dnfl-pill-blue">' + score + ' <i class="fa-solid fa-medal"></i></span>';
            } else if (isEliminatedThisWeek) {
                // Knockout score
                cellContent = '<span class="dnfl-pill dnfl-pill-red">' + score + ' <i class="fa-solid fa-skull"></i></span>';
            } else if (isHighScore && hsOn) {
                // Weekly High Score Winner
                cellContent = '<span class="dnfl-pill dnfl-pill-green">' + score + ' <i class="fa-solid fa-star"></i></span>';
            } else if (isHighScore && !hsOn) {
                // High Score Badge when feature off
                cellContent = '<span class="dnfl-badge dnfl-badge-green">' + score + '</span>';
            } else if (isLowScore) {
                // Low Score Badge
                cellContent = '<span class="dnfl-badge dnfl-badge-red">' + score + '</span>';
            } else if (elimInfo && w > elimInfo.week) {
                // Post-elimination score
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

        if (weeklySummaries.length === 0) {
            summarySection.classList.remove('dnfl-is-hidden');
            container.innerHTML = '<div class="dnfl-status-loading" style="text-align: center; padding: 1.5rem;"><i class="fa-solid fa-clock-rotate-left"></i> This module will populate once Week 1 scores are finalized.</div>';
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

        if (!ltsOn && !hsOn) {
            legendContainer.classList.add('dnfl-is-hidden');
            legendContainer.innerHTML = '';
            return;
        }

        legendContainer.classList.remove('dnfl-is-hidden');

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

        if (hsOn) {
            itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-badge dnfl-badge-green">&nbsp;</span><span class="dnfl-legend-label">High Score</span></div>';
        }

        itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-badge dnfl-badge-red">&nbsp;</span><span class="dnfl-legend-label">Low Score</span></div>';

        var html = '<div class="dnfl-legend-items">' + itemsHtml + '</div>';

        if (ltsOn) {
            html += '<div class="dnfl-legend-note">*LTS eliminations active Weeks ' + startW + '–' + endLtsW + '</div>';
        }

        legendContainer.innerHTML = html;
    }

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
            var rulesUrl = 'https://dnfl.live/dnfl_lts/' + activeYear + '/lts_rules.json?L=' + leagueId;

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
                    console.warn('[DNFL LTS] Corrupted lts_rules.json format.');
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
                if (wData.scores.some(function(s) { return parseFloat(s.score || 0) > 0; }) && wData.week > maxComp) {
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