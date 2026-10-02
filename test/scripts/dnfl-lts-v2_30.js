/**
 * Duke Networking Fantasy League (DNFL) Framework
 * Last Team Standing (LTS) & High Score Tracker Module v2.30
 * File: dnfl-lts-v2_30.js
 */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};

    var targetYear = (function() {
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.getContext === 'function') {
            var ctx = window.DNFL.Client.getContext();
            if (ctx && ctx.year) return String(ctx.year);
        }
        var urlParams = new URLSearchParams(window.location.search);
        var qpYear = urlParams.get('YEAR') || urlParams.get('year') || urlParams.get('Y') || urlParams.get('y');
        if (qpYear) return String(qpYear);
        if (window.current_year) return String(window.current_year);
        if (window.mflYear) return String(window.mflYear);
        var pathSegments = window.location.pathname.split('/');
        var foundYear = pathSegments.find(function(s) { return /^20\d{2}$/.test(s); });
        if (foundYear) return foundYear;
        return '2026';
    })();

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
        return (window.DNFL && window.DNFL.Client) || window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
    }

    function getLeagueId() {
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.getContext === 'function') {
            var ctx = window.DNFL.Client.getContext();
            if (ctx && ctx.leagueId) return String(ctx.leagueId);
        }
        var urlParams = new URLSearchParams(window.location.search);
        var qpLeague = urlParams.get('L') || urlParams.get('l');
        if (qpLeague) return String(qpLeague);
        if (window.league_id) return String(window.league_id);
        if (window.mflLeagueId) return String(window.mflLeagueId);
        return '22883';
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
            if (window.DNFL && window.DNFL.currentFranchiseId) {
                return normFranchiseId(window.DNFL.currentFranchiseId);
            }
            var apiClient = getApiClient();
            if (apiClient && typeof apiClient.getContext === 'function') {
                var ctx = apiClient.getContext();
                if (ctx && ctx.franchiseId) return normFranchiseId(ctx.franchiseId);
            }
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
        if (!cachedRulesConfig || typeof cachedRulesConfig !== 'object') {
            return { isValid: false, errorType: 'missing' };
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

        if (!globalDefaults || typeof globalDefaults !== 'object') {
            return { isValid: false, errorType: 'missing' };
        }

        overrides = overrides || {};

        var lts_isEnabled = (overrides.lts_isEnabled !== undefined) ? overrides.lts_isEnabled : globalDefaults.lts_isEnabled;
        var highScore_isEnabled = (overrides.highScore_isEnabled !== undefined) ? overrides.highScore_isEnabled : globalDefaults.highScore_isEnabled;
        var lts_startWeek = (overrides.lts_startWeek !== undefined) ? overrides.lts_startWeek : globalDefaults.lts_startWeek;

        if (typeof lts_isEnabled !== 'boolean' || typeof highScore_isEnabled !== 'boolean' || lts_startWeek === undefined || lts_startWeek === null || isNaN(Number(lts_startWeek))) {
            return { isValid: false, errorType: 'malformed' };
        }

        return {
            isValid: true,
            lts_isEnabled: Boolean(lts_isEnabled),
            highScore_isEnabled: Boolean(highScore_isEnabled),
            lts_startWeek: Number(lts_startWeek)
        };
    }

    function buildFranchiseCell(franchise) {
        if (!franchise) return '<span class="dnfl-text-muted">—</span>';
        var fid = normFranchiseId(franchise.id);
        var name = franchise.name || ('Franchise ' + fid);
        var owner = franchise.owner_name || franchise.owner || 'Owner';
        var iconUrl = franchise.icon || 'https://dnfl.live/images/ficon-dnfl.png';
        var leagueId = getLeagueId();
        var activeHost = window.location.hostname || 'myfantasyleague.com';
        var targetHref = 'https://' + activeHost + '/' + targetYear + '/options?L=' + leagueId + '&F=' + fid + '&O=01';

        return '<div class="dnfl-franchise-cell">' +
            '<a href="' + targetHref + '" title="View Franchise Page">' +
            '<img class="franchiseicon" src="' + iconUrl + '" alt="' + name + '" onError="this.onerror=null;this.src=\'https://dnfl.live/images/ficon-dnfl.png\';" />' +
            '</a>' +
            '<div class="dnfl-franchise-info">' +
            '<a href="' + targetHref + '" class="dnfl-team-name">' + name + '</a>' +
            '<span class="dnfl-owner-name">' + owner + '</span>' +
            '</div></div>';
    }

    function updateView() {
        var confSelect = document.getElementById('dnfl-lts-conf-select');
        var controlsBox = document.getElementById('dnfl-lts-toolbar');

        var selectedConf = confSelect ? confSelect.value : '';
        var selectedConfVal = selectedConf || (cachedConferences && cachedConferences.length > 0 ? cachedConferences[0].id : '');

        var confObj = cachedConferences.find(function(c) { return norm(c.id) === norm(selectedConfVal); });
        var confName = confObj ? confObj.name : 'Conference';

        // Filter Franchises strictly by Selected Conference
        var confTeams = cachedFranchises.filter(function(f) {
            var fConf = f.conference ? norm(f.conference) : (f.division ? divToConfMap[norm(f.division)] : '');
            return fConf === norm(selectedConfVal);
        });

        // Resolve Active Rules Configuration
        var rules = getConferenceRules(selectedConfVal);
        var scoresSec = document.getElementById('dnfl-lts-scores-section');
        var summarySec = document.getElementById('dnfl-lts-summary-section');
        var legendSec = document.getElementById('dnfl-lts-legend');
        var cardBody = document.querySelector('#dnfl-lts-container .dnfl-card-body');
        var errorBanner = document.getElementById('dnfl-lts-error-banner');
        var infoBanner = document.getElementById('dnfl-lts-info-banner');

        if (!rules || !rules.isValid) {
            if (scoresSec) scoresSec.classList.add('dnfl-is-hidden');
            if (summarySec) summarySec.classList.add('dnfl-is-hidden');
            if (legendSec) legendSec.classList.add('dnfl-is-hidden');
            if (controlsBox) controlsBox.classList.add('dnfl-is-hidden');

            if (!errorBanner && cardBody) {
                errorBanner = document.createElement('div');
                errorBanner.id = 'dnfl-lts-error-banner';
                errorBanner.className = 'dnfl-status-error';
                cardBody.appendChild(errorBanner);
            }
            if (errorBanner) {
                errorBanner.classList.remove('dnfl-is-hidden');
                var activeYear = targetYear;
                errorBanner.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + activeYear + ' LTS & High Score rules not defined - check JSON file';
            }

            var cardTitleElemErr = document.getElementById('dnfl-lts-card-title');
            if (cardTitleElemErr) {
                cardTitleElemErr.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> DNFL - Rules Configuration Error';
            }
            return;
        }

        // Mathematical Feasibility Validation
        var numTeams = confTeams.length;
        var startW = rules.lts_startWeek;
        var endLtsW = startW + (numTeams > 1 ? numTeams - 2 : 0);

        if (rules.lts_isEnabled && (endLtsW > cachedEndWeek || startW < 1)) {
            if (scoresSec) scoresSec.classList.add('dnfl-is-hidden');
            if (summarySec) summarySec.classList.add('dnfl-is-hidden');
            if (legendSec) legendSec.classList.add('dnfl-is-hidden');
            if (controlsBox) controlsBox.classList.add('dnfl-is-hidden');

            if (!errorBanner && cardBody) {
                errorBanner = document.createElement('div');
                errorBanner.id = 'dnfl-lts-error-banner';
                errorBanner.className = 'dnfl-status-error';
                cardBody.appendChild(errorBanner);
            }
            if (errorBanner) {
                errorBanner.classList.remove('dnfl-is-hidden');
                var activeYearMath = targetYear;
                errorBanner.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + activeYearMath + ' LTS rules error: lts_startWeek (' + startW + ') does not allow enough regular season weeks for ' + numTeams + ' teams in ' + confName;
            }

            var cardTitleElemMathErr = document.getElementById('dnfl-lts-card-title');
            if (cardTitleElemMathErr) {
                cardTitleElemMathErr.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> DNFL - Rules Configuration Error';
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
                infoBanner.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Survival eliminations will activate once Week 1 scores are finalized.';
            }

            var ltsOnPre = rules.lts_isEnabled;
            var hsOnPre = rules.highScore_isEnabled;
            var cardTitleElemPre = document.getElementById('dnfl-lts-card-title');
            if (cardTitleElemPre) {
                if (ltsOnPre) {
                    cardTitleElemPre.innerHTML = '<i class="fa-solid fa-skull"></i> ' + confName + ' Last Team Standing & Weekly Summary';
                } else if (hsOnPre) {
                    cardTitleElemPre.innerHTML = '<i class="fa-solid fa-star"></i> ' + confName + ' High Score Tracker & Weekly Summary';
                } else {
                    cardTitleElemPre.innerHTML = '<i class="fa-solid fa-list"></i> ' + confName + ' Weekly Summary';
                }
            }
            return;
        }

        if (infoBanner) {
            infoBanner.classList.add('dnfl-is-hidden');
        }
        if (controlsBox) {
            controlsBox.classList.remove('dnfl-is-hidden');
        }

        // Feature Toggles
        var ltsOn = rules.lts_isEnabled;
        var hsOn = rules.highScore_isEnabled;

        // Dynamic Card Header Title based on active features & conference name
        var cardTitleElem = document.getElementById('dnfl-lts-card-title');
        if (cardTitleElem) {
            if (ltsOn) {
                cardTitleElem.innerHTML = '<i class="fa-solid fa-skull"></i> ' + confName + ' Last Team Standing & Weekly Summary';
            } else if (hsOn) {
                cardTitleElem.innerHTML = '<i class="fa-solid fa-star"></i> ' + confName + ' High Score Tracker & Weekly Summary';
            } else {
                cardTitleElem.innerHTML = '<i class="fa-solid fa-list"></i> ' + confName + ' Weekly Summary';
            }
        }

        // Process Weekly Scores & Elimination Calculations
        var eliminations = {}; // fid -> { week, score }
        var weeklySummaries = []; // Array of { week, eliminatedFid, knockoutScore, highScorerFid, highScore, overallLowScore }

        var activeFids = confTeams.map(function(f) { return normFranchiseId(f.id); });

        for (var w = 1; w <= cachedMaxCompletedWeek; w++) {
            var wScores = cachedWeeklyResults[w] || [];

            var confScores = wScores.filter(function(s) {
                return activeFids.indexOf(normFranchiseId(s.franchiseId)) !== -1;
            });

            var highestScore = -1;
            var highScorerFid = null;
            var lowestActiveScore = 999999;
            var lowestActiveFid = null;
            var overallLowScore = 999999;

            confScores.forEach(function(s) {
                var sc = parseFloat(s.score || 0);
                var fid = normFranchiseId(s.franchiseId);

                if (sc < overallLowScore) overallLowScore = sc;

                if (sc > highestScore) {
                    highestScore = sc;
                    highScorerFid = fid;
                }

                // Only check for elimination if team is currently surviving
                if (!eliminations[fid]) {
                    if (sc < lowestActiveScore) {
                        lowestActiveScore = sc;
                        lowestActiveFid = fid;
                    } else if (sc === lowestActiveScore && lowestActiveFid !== null) {
                        // YTD Tiebreaker for Elimination
                        var ytdCur = 0;
                        var ytdPrev = 0;
                        for (var prevW = 1; prevW <= w; prevW++) {
                            var pList = cachedWeeklyResults[prevW] || [];
                            var mCur = pList.find(function(r) { return normFranchiseId(r.franchiseId) === fid; });
                            var mPrev = pList.find(function(r) { return normFranchiseId(r.franchiseId) === lowestActiveFid; });
                            if (mCur) ytdCur += parseFloat(mCur.score || 0);
                            if (mPrev) ytdPrev += parseFloat(mPrev.score || 0);
                        }
                        if (ytdCur < ytdPrev) {
                            lowestActiveFid = fid;
                            lowestActiveScore = sc;
                        }
                    }
                }
            });

            var elimThisWeek = null;
            var knockoutScore = null;

            if (ltsOn && w >= startW && w <= endLtsW && lowestActiveFid !== null) {
                eliminations[lowestActiveFid] = { week: w, score: lowestActiveScore };
                elimThisWeek = lowestActiveFid;
                knockoutScore = lowestActiveScore;
            }

            weeklySummaries.push({
                week: w,
                eliminatedFid: elimThisWeek,
                knockoutScore: knockoutScore,
                highScorerFid: highScorerFid,
                highScore: highestScore,
                overallLowScore: overallLowScore < 999999 ? overallLowScore : null
            });
        }

        // Determine Champion Week
        var championWeek = endLtsW;

        renderWeeklyScoresTable(confTeams, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek);
        renderWeeklySummaryTable(confTeams, ltsOn, hsOn, startW, endLtsW, weeklySummaries);
        renderLegendPanel(ltsOn, hsOn, startW, endLtsW);
    }

    function renderWeeklyScoresTable(confTeams, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek) {
        var container = document.getElementById('dnfl-lts-scores-container');
        var scoresSection = document.getElementById('dnfl-lts-scores-section');
        if (!container || !scoresSection) return;

        scoresSection.classList.remove('dnfl-is-hidden');

        var myFid = getLoggedInFranchiseId();
        var totalCols = cachedEndWeek + 1;

        var html = '<div id="dnfl-lts-scores-wrapper" class="dnfl-table-wrapper">' +
            '<table class="dnfl-lts-scores-table dnfl-table">' +
            '<thead>' +
            '<tr class="dnfl-division-header">' +
            '<td colspan="' + totalCols + '" class="dnfl-division-header-cell dnfl-sticky-col">' +
            '<div class="dnfl-division-header-content"><h3>Weekly Scores</h3></div>' +
            '</td></tr>' +
            '<tr class="dnfl-table-subheader">' +
            '<th class="dnfl-col-franchise dnfl-sticky-col">Franchise</th>';

        for (var w = 1; w <= cachedEndWeek; w++) {
            var skullIcon = (ltsOn && w >= startW && w <= endLtsW) ? ' <i class="fa-solid fa-skull dnfl-icon-danger dnfl-text-red"></i>' : '';
            html += '<th class="dnfl-text-center">W' + w + skullIcon + '</th>';
        }

        html += '</tr>' +
            '</thead>' +
            '<tbody>';

        var rowCounter = 0;

        if (ltsOn) {
            // Group 1: Active / Surviving Franchises (Sorted Alphabetically A-Z by Franchise Name)
            var activeList = confTeams.filter(function(f) { return !eliminations[normFranchiseId(f.id)]; });
            activeList.sort(function(a, b) {
                var nameA = (a.name || '').toLowerCase();
                var nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            // Group 2: Eliminated Franchises (Sorted in Reverse Order of Elimination)
            var elimList = confTeams.filter(function(f) { return !!eliminations[normFranchiseId(f.id)]; });
            elimList.sort(function(a, b) {
                var elimA = eliminations[normFranchiseId(a.id)];
                var elimB = eliminations[normFranchiseId(b.id)];
                if (elimB.week !== elimA.week) {
                    return elimB.week - elimA.week;
                }
                var nameA = (a.name || '').toLowerCase();
                var nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            if (activeList.length > 0) {
                var subheadText = (activeList.length === 1 && cachedMaxCompletedWeek >= endLtsW) ? 'LTS Champion' : 'Active Teams (' + activeList.length + ')';
                var subheadClass = (activeList.length === 1 && cachedMaxCompletedWeek >= endLtsW) ? 'dnfl-subhead-champion' : 'dnfl-subhead-active';

                html += '<tr class="dnfl-table-subheader ' + subheadClass + '">' +
                    '<td colspan="' + totalCols + '" class="dnfl-sticky-col"><div class="dnfl-subhead-content">' + subheadText + '</div></td>' +
                    '</tr>';

                activeList.forEach(function(f) {
                    var fid = normFranchiseId(f.id);
                    html += renderTeamRow(f, fid, rowCounter++, myFid, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek);
                });
            }

            if (elimList.length > 0) {
                html += '<tr class="dnfl-table-subheader dnfl-subhead-eliminated">' +
                    '<td colspan="' + totalCols + '" class="dnfl-sticky-col"><div class="dnfl-subhead-content">Eliminated Teams (' + elimList.length + ')</div></td>' +
                    '</tr>';

                elimList.forEach(function(f) {
                    var fid = normFranchiseId(f.id);
                    html += renderTeamRow(f, fid, rowCounter++, myFid, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek);
                });
            }
        } else {
            // LTS Disabled: Unified list sorted Alphabetically A-Z by Franchise Name
            var sortedTeams = confTeams.slice().sort(function(a, b) {
                var nameA = (a.name || '').toLowerCase();
                var nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            sortedTeams.forEach(function(f) {
                var fid = normFranchiseId(f.id);
                html += renderTeamRow(f, fid, rowCounter++, myFid, false, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek);
            });
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    function renderTeamRow(franchise, fid, rowIdx, myFid, ltsOn, hsOn, startW, endLtsW, eliminations, weeklySummaries, championWeek) {
        var isMyTeam = (myFid && fid === myFid);
        var rowClass = (rowIdx % 2 === 0 ? 'dnfl-row-odd oddtablerow' : 'dnfl-row-even eventablerow') + (isMyTeam ? ' dnfl-my-team myfranchise' : '');
        var elimInfo = eliminations[fid];

        var html = '<tr class="' + rowClass + '" data-franchise="' + fid + '">';
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
                // Final Week Champion (Check if also High Score Winner)
                if (isHighScore && hsOn) {
                    cellContent = '<span class="dnfl-pill dnfl-pill-blue">' + score + ' <i class="fa-solid fa-medal"></i> <i class="fa-solid fa-star"></i></span>';
                } else {
                    cellContent = '<span class="dnfl-pill dnfl-pill-blue">' + score + ' <i class="fa-solid fa-medal"></i></span>';
                }
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

    function renderWeeklySummaryTable(confTeams, ltsOn, hsOn, startW, endLtsW, weeklySummaries) {
        var summarySection = document.getElementById('dnfl-lts-summary-section');
        var container = document.getElementById('dnfl-lts-summary-container');
        if (!container || !summarySection) return;

        // Hide summary if both features are disabled
        if (!ltsOn && !hsOn) {
            summarySection.classList.add('dnfl-is-hidden');
            container.innerHTML = '';
            return;
        }

        if (weeklySummaries.length === 0) {
            summarySection.classList.remove('dnfl-is-hidden');
            container.innerHTML = '<div class="dnfl-status-loading"><i class="fa-solid fa-clock-rotate-left"></i> Survival eliminations will activate once Week 1 scores are finalized.</div>';
            return;
        }

        summarySection.classList.remove('dnfl-is-hidden');

        var totalCols = 1 + (ltsOn ? 2 : 0) + (hsOn ? 2 : 0);

        var html = '<div id="dnfl-lts-summary-wrapper" class="dnfl-table-wrapper">' +
            '<table class="dnfl-lts-summary-table dnfl-table">' +
            '<thead>' +
            '<tr class="dnfl-division-header">' +
            '<td colspan="' + totalCols + '" class="dnfl-division-header-cell dnfl-sticky-col">' +
            '<div class="dnfl-division-header-content"><h3>Weekly Summary</h3></div>' +
            '</td></tr>' +
            '<tr class="dnfl-table-subheader">' +
            '<th class="dnfl-col-week dnfl-sticky-col">Week</th>';

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
            var rowClass = (idx % 2 === 0 ? 'dnfl-row-odd oddtablerow' : 'dnfl-row-even eventablerow');
            html += '<tr class="' + rowClass + '">' +
                '<td class="dnfl-col-week dnfl-sticky-col">Week ' + s.week + '</td>';

            if (ltsOn) {
                var elimCell = '';
                var scoreCell = '';

                if (s.week < startW) {
                    elimCell = '<span class="dnfl-text-muted dnfl-italic">LTS starts in Week ' + startW + '</span>';
                    scoreCell = '<span class="dnfl-text-muted">—</span>';
                } else if (s.week > endLtsW) {
                    elimCell = '<span class="dnfl-text-muted dnfl-italic">LTS completed in Week ' + endLtsW + '</span>';
                    scoreCell = '<span class="dnfl-text-muted">—</span>';
                } else {
                    var elimFranchise = confTeams.find(function(f) { return normFranchiseId(f.id) === s.eliminatedFid; });
                    elimCell = elimFranchise ? buildFranchiseCell(elimFranchise) : '<span class="dnfl-text-muted">—</span>';
                    scoreCell = s.knockoutScore !== null ? '<span class="dnfl-pill dnfl-pill-red">' + parseFloat(s.knockoutScore).toFixed(2) + ' <i class="fa-solid fa-skull"></i></span>' : '<span class="dnfl-text-muted">—</span>';
                }

                html += '<td class="dnfl-col-franchise">' + elimCell + '</td>' +
                    '<td class="dnfl-col-score">' + scoreCell + '</td>';
            }

            if (hsOn) {
                var highFranchise = confTeams.find(function(f) { return normFranchiseId(f.id) === s.highScorerFid; });
                var highCell = highFranchise ? buildFranchiseCell(highFranchise) : '<span class="dnfl-text-muted">—</span>';
                var scoreCellHs = s.highScore > 0 ? '<span class="dnfl-pill dnfl-pill-green">' + parseFloat(s.highScore).toFixed(2) + ' <i class="fa-solid fa-star"></i></span>' : '<span class="dnfl-text-muted">—</span>';

                html += '<td class="dnfl-col-franchise">' + highCell + '</td>' +
                    '<td class="dnfl-col-score">' + scoreCellHs + '</td>';
            }

            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    function renderLegendPanel(ltsOn, hsOn, startW, endLtsW) {
        var legendContainer = document.getElementById('dnfl-lts-legend');
        if (!legendContainer) return;

        legendContainer.classList.remove('dnfl-is-hidden');

        var itemsHtml = '';

        if (ltsOn) {
            // 1. LTS Champion
            itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-pill dnfl-pill-blue"><i class="fa-solid fa-medal"></i></span><span class="dnfl-legend-label">LTS Champion</span></div>';
            // 2. LTS Elimination
            itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-pill dnfl-pill-red"><i class="fa-solid fa-skull"></i></span><span class="dnfl-legend-label">LTS Elimination</span></div>';
        }

        if (hsOn) {
            // 3. High Score Winner
            itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-pill dnfl-pill-green"><i class="fa-solid fa-star"></i></span><span class="dnfl-legend-label">High Score Winner</span></div>';
        } else {
            // 3. High Score Badge
            itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-badge dnfl-badge-green">&nbsp;&nbsp;</span><span class="dnfl-legend-label">High Score</span></div>';
        }

        // 4. Low Score
        itemsHtml += '<div class="dnfl-legend-item"><span class="dnfl-badge dnfl-badge-red">&nbsp;&nbsp;</span><span class="dnfl-legend-label">Low Score</span></div>';

        var html = '<div class="dnfl-legend-items">' + itemsHtml + '</div>';

        if (ltsOn) {
            html += '<div class="dnfl-legend-note">*LTS eliminations active Weeks ' + startW + '–' + endLtsW + '</div>';
        }

        legendContainer.innerHTML = html;
    }

    function toggleScores() {
        var sec = document.getElementById('dnfl-lts-scores-section');
        var btn = document.getElementById('dnfl-lts-toggle-scores-btn');
        if (!sec || !btn) return;

        var isHidden = sec.classList.toggle('dnfl-is-hidden');
        btn.innerHTML = isHidden
            ? '<i class="fa-solid fa-table-cells"></i> Show Scores'
            : '<i class="fa-solid fa-table-cells"></i> Hide Scores';
    }

    function populateConferenceSelect() {
        var select = document.getElementById('dnfl-lts-conf-select');
        if (!select) return;

        var html = '';
        cachedConferences.forEach(function(c) {
            html += '<option value="' + c.id + '">' + c.name + '</option>';
        });

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
            updateView();
            return;
        }

        var ctx = typeof apiClient.getContext === 'function' ? apiClient.getContext() : {};
        var activeYear = ctx.year || targetYear;
        var leagueId = getLeagueId();

        try {
            var rulesUrl = 'https://dnfl.live/dnfl_lts/' + activeYear + '/lts_rules.json?L=' + leagueId;

            var results = await Promise.all([
                apiClient.fetchData('league', { L: leagueId, YEAR: activeYear }, { ttl: (apiClient.TTL && apiClient.TTL.WEEKLY) || 604800000 }).catch(function() { return {}; }),
                apiClient.fetchRawText(rulesUrl, { ttl: (apiClient.TTL && apiClient.TTL.DAILY) || 86400000 }).catch(function() { return null; })
            ]);

            var leagueData = results[0] || {};
            var rawRules = results[1];

            cachedLeague = leagueData.league || leagueData || {};
            cachedFranchises = toArray(cachedLeague.franchises && cachedLeague.franchises.franchise);

            // Conference Discovery (Support Array or nested object or fallback from franchises)
            var rawConfs = cachedLeague.conferences ? (cachedLeague.conferences.conference || cachedLeague.conferences) : [];
            cachedConferences = toArray(rawConfs);

            if (cachedConferences.length === 0 && cachedFranchises.length > 0) {
                var confMap = {};
                cachedFranchises.forEach(function(f) {
                    var cId = f.conference ? norm(f.conference) : '';
                    if (cId && !confMap[cId]) {
                        confMap[cId] = true;
                        cachedConferences.push({ id: cId, name: 'Conference ' + cId });
                    }
                });
            }

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
                    console.warn('[DNFL.LTS] Corrupted lts_rules.json format.');
                }
            }

            populateConferenceSelect();
            updateView();

            // Fetch Multi-Week Results in Parallel matching Exporter engine pattern
            var fetchPromises = [];
            for (var w = 1; w <= cachedEndWeek; w++) {
                (function(weekNum) {
                    var p = apiClient.fetchData('weeklyResults', { W: String(weekNum), L: leagueId, YEAR: activeYear }, { ttl: (apiClient.TTL && apiClient.TTL.HOURLY) || 3600000 })
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
                                        var sc = (f.score !== undefined && f.score !== null && f.score !== '') ? f.score :
                                         ((f.points !== undefined && f.points !== null && f.points !== '') ? f.points :
                                         ((f.pts !== undefined && f.pts !== null && f.pts !== '') ? f.pts :
                                         ((f.pf !== undefined && f.pf !== null && f.pf !== '') ? f.pf : '0')));
                                        scores.push({ franchiseId: normFranchiseId(f.id), score: String(sc) });
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

            updateView();

        } catch (err) {
            console.error('[DNFL.LTS] Initialization error:', err);
        }
    }

    // Export Public API Namespace Synchronously at IIFE evaluation time
    window.DNFL.LTS = {
        init: init,
        updateView: updateView,
        toggleScores: toggleScores
    };

    // Lifecycle Binding
    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
