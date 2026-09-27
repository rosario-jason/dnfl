/**
 * Duke Networking Fantasy League (DNFL) Last Team Standing (LTS) Module (v2_01)
 *
 * Primary Objective:
 * Ingests weekly scores via the MFL API middleware (DNFL.Client) to chronologically
 * calculate weekly survival eliminations (knocking out the lowest active scorer
 * each week during active LTS weeks), track weekly high/low scorers, and render:
 *   - Table 1: Weekly Scores (.dnfl-lts-scores-table)
 *   - Table 2: Weekly Summary (.dnfl-lts-summary-table)
 *   - Dynamic Legend Panel (#dnfl-lts-legend)
 *
 * Version: v2_01
 * Grounded in: dnfl-lts-developer_guide.md / dnfl-lts-template-v3.md
 */

(function () {
    'use strict';

    // Ensure global namespace exists
    window.DNFL = window.DNFL || {};

    var MODULE_NAME = 'DNFL.LTS';
    var CONTAINER_ID = 'dnfl-lts-container';

    // Module State Store
    var moduleState = {
        initialized: false,
        loading: false,
        error: null,
        leagueData: null,
        rulesConfig: {},
        weeklyResults: {},
        conferences: [],
        activeConferenceId: null,
        activeYear: null,
        leagueId: null,
        userFranchiseId: null,
        endWeek: 14,
        maxCompletedWeek: 0,
        scoresVisible: true,
        summaryVisible: true,
        retryCount: 0
    };

    /**
     * ID Normalization Utility
     */
    function normFranchiseId(id) {
        if (!id) return '';
        var s = String(id).trim();
        return s.length < 4 ? ('0000' + s).slice(-4) : s;
    }

    /**
     * Resolve Environment Context
     */
    function resolveContext(client) {
        var ctx = (client && typeof client.getContext === 'function') ? client.getContext() : {};
        
        // Resolve activeYear
        var year = ctx.year || window.current_year || window.year;
        if (!year) {
            var match = window.location.pathname.match(/\/(20\d{2})\//);
            year = match ? match[1] : new Date().getFullYear();
        }
        moduleState.activeYear = String(year);

        // Resolve leagueId
        moduleState.leagueId = String(ctx.leagueId || window.league_id || '22883');

        // Resolve userFranchiseId
        var rawFid = (client && typeof client.getFranchiseId === 'function') ? client.getFranchiseId() : (window.franchise_id || '');
        moduleState.userFranchiseId = normFranchiseId(rawFid);
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

        var iconHtml = iconUrl ? '<img src="' + iconUrl + '" alt="" class="dnfl-team-icon" onerror="this.style.display='none'" />' : '';

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
        var overrides = (moduleState.rulesConfig && moduleState.rulesConfig[confKey]) ? moduleState.rulesConfig[confKey] : {};
        var globalDefaults = (moduleState.rulesConfig && moduleState.rulesConfig['default']) ? moduleState.rulesConfig['default'] : {};

        return {
            lts_isEnabled: (overrides.lts_isEnabled !== undefined) ? overrides.lts_isEnabled : (globalDefaults.lts_isEnabled !== undefined ? globalDefaults.lts_isEnabled : true),
            highScore_isEnabled: (overrides.highScore_isEnabled !== undefined) ? overrides.highScore_isEnabled : (globalDefaults.highScore_isEnabled !== undefined ? globalDefaults.highScore_isEnabled : true),
            lts_startWeek: overrides.lts_startWeek || globalDefaults.lts_startWeek || 'auto',
            lts_endWeek: overrides.lts_endWeek || globalDefaults.lts_endWeek || 'auto'
        };
    }

    /**
     * Fetch Rules Configuration File (lts_rules.json)
     */
    function fetchRulesConfig(client) {
        var path = 'dnfl_lts/' + moduleState.activeYear + '/lts_rules.json';
        var ttl = client.TTL ? client.TTL.DAILY : 86400;

        return client.fetchData(path, {}, { ttl: ttl, dataType: 'json' })
            .then(function (data) {
                if (data && typeof data === 'object') {
                    moduleState.rulesConfig = data;
                }
            })
            .catch(function () {
                // Fallback attempt to remote domain if local 404
                var fallbackUrl = 'https://dnfl.live/dnfl_lts/' + moduleState.activeYear + '/lts_rules.json';
                return client.fetchData(fallbackUrl, {}, { ttl: ttl, dataType: 'json' })
                    .then(function (data) {
                        if (data && typeof data === 'object') {
                            moduleState.rulesConfig = data;
                        }
                    })
                    .catch(function () {
                        // Graceful fallback to Tier 1 default settings
                        moduleState.rulesConfig = {};
                    });
            });
    }

    /**
     * Main Data Retrieval Pipeline
     */
    function loadData() {
        var client = window.DNFLClient || window.DNFL.Client;
        if (!client) {
            return Promise.reject(new Error('DNFL API Client middleware (DNFLClient) is not available.'));
        }

        resolveContext(client);

        var weeklyTTL = client.TTL ? client.TTL.WEEKLY : 604800;
        var hourlyTTL = client.TTL ? client.TTL.HOURLY : 3600;

        // 1. Fetch League Metadata
        return client.fetchData('league', { L: moduleState.leagueId }, { ttl: weeklyTTL })
            .then(function (leagueData) {
                if (!leagueData || !leagueData.league) {
                    throw new Error('Invalid league data received from MFL API.');
                }
                moduleState.leagueData = leagueData.league;

                // Resolve regular season length (endWeek)
                var lastRegWeek = parseInt(leagueData.league.lastRegularSeasonWeek, 10);
                moduleState.endWeek = (!isNaN(lastRegWeek) && lastRegWeek > 0) ? lastRegWeek : 14;

                // Resolve Conferences
                var confs = [];
                if (leagueData.league.conferences && leagueData.league.conferences.conference) {
                    var rawConfs = leagueData.league.conferences.conference;
                    confs = Array.isArray(rawConfs) ? rawConfs : [rawConfs];
                }
                moduleState.conferences = confs;

                // Auto-detect active user's conference or default to first
                if (confs.length > 0) {
                    moduleState.activeConferenceId = confs[0].id;
                    if (moduleState.userFranchiseId && leagueData.league.franchises && leagueData.league.franchises.franchise) {
                        var franchises = Array.isArray(leagueData.league.franchises.franchise) ? leagueData.league.franchises.franchise : [leagueData.league.franchises.franchise];
                        var userFranchise = franchises.find(function (f) {
                            return normFranchiseId(f.id) === moduleState.userFranchiseId;
                        });
                        if (userFranchise && userFranchise.conference) {
                            moduleState.activeConferenceId = userFranchise.conference;
                        }
                    }
                }

                // 2. Fetch Rules Config in parallel
                var rulesPromise = fetchRulesConfig(client);

                // 3. Multi-week parallel API fetch for weeklyResults
                var weekPromises = [];
                for (var w = 1; w <= moduleState.endWeek; w++) {
                    (function (weekNum) {
                        var p = client.fetchData('weeklyResults', { W: String(weekNum), L: moduleState.leagueId }, { ttl: hourlyTTL })
                            .then(function (res) {
                                return { week: weekNum, data: res };
                            })
                            .catch(function () {
                                return { week: weekNum, data: null };
                            });
                        weekPromises.push(p);
                    })(w);
                }

                return Promise.all([rulesPromise, Promise.all(weekPromises)]);
            })
            .then(function (results) {
                var weekResultsArray = results[1];
                var maxComp = 0;

                weekResultsArray.forEach(function (item) {
                    if (item && item.data && item.data.weeklyResults && item.data.weeklyResults.matchup) {
                        moduleState.weeklyResults[item.week] = item.data.weeklyResults;
                        if (item.week > maxComp) {
                            maxComp = item.week;
                        }
                    }
                });

                moduleState.maxCompletedWeek = maxComp;
            });
    }

    /**
     * Compute Survival Logic for Selected Conference
     */
    function computeConferenceLTS(confId) {
        var confRules = getConferenceRules(confId);
        var league = moduleState.leagueData;
        if (!league) return null;

        // Get all franchises in conference
        var allFranchises = Array.isArray(league.franchises.franchise) ? league.franchises.franchise : [league.franchises.franchise];
        var confFranchises = allFranchises.filter(function (f) {
            return !confId || String(f.conference) === String(confId);
        });

        var totalTeams = confFranchises.length;

        // Calculate ltsStartWeek and ltsEndWeek
        var ltsStartWeek = 1;
        if (typeof confRules.lts_startWeek === 'number') {
            ltsStartWeek = confRules.lts_startWeek;
        } else if (confRules.lts_startWeek !== 'auto' && !isNaN(parseInt(confRules.lts_startWeek, 10))) {
            ltsStartWeek = parseInt(confRules.lts_startWeek, 10);
        } else {
            ltsStartWeek = Math.max(1, moduleState.endWeek - (totalTeams - 1) + 1);
        }

        var ltsEndWeek = ltsStartWeek + (totalTeams - 2);
        if (typeof confRules.lts_endWeek === 'number') {
            ltsEndWeek = confRules.lts_endWeek;
        } else if (confRules.lts_endWeek !== 'auto' && !isNaN(parseInt(confRules.lts_endWeek, 10))) {
            ltsEndWeek = parseInt(confRules.lts_endWeek, 10);
        }

        // Initialize active tracking
        var lts_activeTeams = new Set();
        var franchiseMap = {};
        confFranchises.forEach(function (f) {
            var fid = normFranchiseId(f.id);
            lts_activeTeams.add(fid);
            franchiseMap[fid] = f;
        });

        var lts_eliminations = {}; // { fid: { week, score, order } }
        var lts_weeklySummaries = []; // [ { week, eliminatedFid, knockoutScore, highScorerFid, highScore } ]
        var lts_highScorersMap = {}; // { week: highScorerFid }
        var lts_lowScorersMap = {}; // { week: lowScorerFid }
        var weeklyScoresMap = {}; // { fid: { week: score } }

        confFranchises.forEach(function (f) {
            weeklyScoresMap[normFranchiseId(f.id)] = {};
        });

        // Cumulative YTD points accumulator
        var ytdPointsMap = {};
        confFranchises.forEach(function (f) {
            ytdPointsMap[normFranchiseId(f.id)] = 0;
        });

        var eliminationOrder = 1;

        // Process week by week 1..endWeek
        for (var w = 1; w <= moduleState.endWeek; w++) {
            var weekRes = moduleState.weeklyResults[w];
            if (!weekRes || w > moduleState.maxCompletedWeek) continue;

            // Extract scores for this week
            var weekScores = {};
            var matchups = Array.isArray(weekRes.matchup) ? weekRes.matchup : [weekRes.matchup];

            matchups.forEach(function (m) {
                if (!m || !m.franchise) return;
                var frs = Array.isArray(m.franchise) ? m.franchise : [m.franchise];
                frs.forEach(function (fr) {
                    var fid = normFranchiseId(fr.id);
                    if (franchiseMap[fid]) {
                        var score = parseFloat(fr.score || 0);
                        weekScores[fid] = score;
                        weeklyScoresMap[fid][w] = score;
                        ytdPointsMap[fid] += score;
                    }
                });
            });

            // Find High Scorer across all conference teams for week w
            var highScore = -1;
            var highScorerFid = null;
            Object.keys(weekScores).forEach(function (fid) {
                if (weekScores[fid] > highScore) {
                    highScore = weekScores[fid];
                    highScorerFid = fid;
                }
            });
            if (highScorerFid) {
                lts_highScorersMap[w] = highScorerFid;
            }

            // LTS Survival Elimination Logic (active during ltsStartWeek..ltsEndWeek)
            var eliminatedThisWeek = null;
            var knockoutScore = null;

            if (confRules.lts_isEnabled && w >= ltsStartWeek && w <= ltsEndWeek) {
                var activeScores = [];
                lts_activeTeams.forEach(function (fid) {
                    if (weekScores[fid] !== undefined) {
                        activeScores.push({
                            fid: fid,
                            score: weekScores[fid],
                            ytd: ytdPointsMap[fid],
                            priorScore: (w > 1 && weeklyScoresMap[fid][w - 1] !== undefined) ? weeklyScoresMap[fid][w - 1] : 0
                        });
                    }
                });

                if (activeScores.length > 0) {
                    // Sort to find lowest score with tiebreakers
                    activeScores.sort(function (a, b) {
                        if (a.score !== b.score) return a.score - b.score; // Primary: lowest weekly score
                        if (a.ytd !== b.ytd) return a.ytd - b.ytd; // Tiebreaker 1: lowest YTD points
                        if (a.priorScore !== b.priorScore) return a.priorScore - b.priorScore; // Tiebreaker 2: lowest prior week score
                        return a.fid.localeCompare(b.fid); // Tiebreaker 3: franchise ID string
                    });

                    var knockedOut = activeScores[0];
                    eliminatedThisWeek = knockedOut.fid;
                    knockoutScore = knockedOut.score;

                    lts_eliminations[knockedOut.fid] = {
                        week: w,
                        score: knockedOut.score,
                        order: eliminationOrder++
                    };
                    lts_activeTeams.delete(knockedOut.fid);
                    lts_lowScorersMap[w] = knockedOut.fid;
                }
            }

            lts_weeklySummaries.push({
                week: w,
                eliminatedFid: eliminatedThisWeek,
                knockoutScore: knockoutScore,
                highScorerFid: highScorerFid,
                highScore: highScore > -1 ? highScore : null
            });
        }

        // Identify LTS Champion (the 1 remaining active team after ltsEndWeek)
        var championFid = null;
        if (confRules.lts_isEnabled && lts_activeTeams.size === 1 && moduleState.maxCompletedWeek >= ltsEndWeek) {
            championFid = Array.from(lts_activeTeams)[0];
        }

        return {
            confRules: confRules,
            confFranchises: confFranchises,
            totalTeams: totalTeams,
            ltsStartWeek: ltsStartWeek,
            ltsEndWeek: ltsEndWeek,
            lts_activeTeams: lts_activeTeams,
            lts_eliminations: lts_eliminations,
            lts_weeklySummaries: lts_weeklySummaries,
            lts_highScorersMap: lts_highScorersMap,
            lts_lowScorersMap: lts_lowScorersMap,
            weeklyScoresMap: weeklyScoresMap,
            championFid: championFid,
            franchiseMap: franchiseMap
        };
    }

    /**
     * Render Card Title Header
     */
    function renderCardTitle(data) {
        var titleEl = document.getElementById('dnfl-lts-card-title');
        if (!titleEl) return;

        var confName = 'League';
        if (moduleState.activeConferenceId && moduleState.conferences.length > 0) {
            var activeConf = moduleState.conferences.find(function (c) {
                return String(c.id) === String(moduleState.activeConferenceId);
            });
            if (activeConf && activeConf.name) {
                confName = activeConf.name;
            }
        }

        var isLtsOn = data && data.confRules && data.confRules.lts_isEnabled;

        if (isLtsOn) {
            titleEl.innerHTML = '<i class="fa-solid fa-medal dnfl-icon-amber"></i> ' +
                '<span class="dnfl-desktop-only">' + confName + ' Last Team Standing & Weekly Summary</span>' +
                '<span class="dnfl-mobile-only">' + confName + ' LTS & Weekly Summary</span>';
        } else {
            titleEl.innerHTML = '<i class="fa-solid fa-list dnfl-icon-amber"></i> ' + confName + ' Weekly Summary';
        }
    }

    /**
     * Render Conference Filter Dropdown
     */
    function renderConferenceSelect() {
        var selectEl = document.getElementById('dnfl-lts-conference-select');
        if (!selectEl) return;

        if (!moduleState.conferences || moduleState.conferences.length === 0) {
            selectEl.innerHTML = '<option value="">All Conferences</option>';
            return;
        }

        var html = '';
        moduleState.conferences.forEach(function (conf) {
            var selected = String(conf.id) === String(moduleState.activeConferenceId) ? ' selected="selected"' : '';
            html += '<option value="' + conf.id + '"' + selected + '>' + conf.name + '</option>';
        });
        selectEl.innerHTML = html;
    }

    /**
     * Render Table 1: Weekly Scores (.dnfl-lts-scores-table)
     */
    function renderScoresTable(data) {
        var container = document.getElementById('dnfl-lts-scores-container');
        if (!container) return;

        if (!data || !data.confFranchises || data.confFranchises.length === 0) {
            container.innerHTML = '<div class="dnfl-status-error"><i class="fa-solid fa-circle-exclamation"></i> No conference team data available.</div>';
            return;
        }

        var isLtsOn = data.confRules.lts_isEnabled;
        var isHsOn = data.confRules.highScore_isEnabled;
        var totalCols = 1 + moduleState.endWeek;

        var html = '<div id="dnfl-lts-scores-wrapper" class="dnfl-table-wrapper">';
        html += '<table class="dnfl-table dnfl-lts-scores-table">';

        // 1. Table Header Row (Section Title pinned sticky left inside table)
        html += '<thead>';
        html += '<tr class="dnfl-table-section-header">';
        html += '<td colspan="' + totalCols + '" class="dnfl-table-section-header-cell dnfl-sticky-col">';
        html += '<div class="dnfl-table-section-header-content"><h3>Weekly Scores</h3></div>';
        html += '</td>';
        html += '</tr>';

        // 2. Column Headers
        html += '<tr>';
        html += '<th class="dnfl-col-franchise dnfl-sticky-col">Franchise</th>';

        for (var w = 1; w <= moduleState.endWeek; w++) {
            var isLtsWeek = isLtsOn && w >= data.ltsStartWeek && w <= data.ltsEndWeek;
            var headerIcon = isLtsWeek ? ' <i class="fa-solid fa-skull dnfl-icon-red" title="LTS Elimination Week"></i>' : '';
            html += '<th class="dnfl-text-center">W' + w + headerIcon + '</th>';
        }
        html += '</tr>';
        html += '</thead>';

        html += 'tbody';

        // Function to render a franchise row
        function renderRow(f, rowIdx) {
            var fid = normFranchiseId(f.id);
            var isMyTeam = (fid === moduleState.userFranchiseId);
            var rowClass = (rowIdx % 2 === 0 ? 'dnfl-row-even' : 'dnfl-row-odd') + (isMyTeam ? ' dnfl-my-team' : '');

            var rHtml = '<tr class="' + rowClass + '">';
            rHtml += '<td class="dnfl-col-franchise dnfl-sticky-col">' + buildFranchiseCell(f) + '</td>';

            for (var w = 1; w <= moduleState.endWeek; w++) {
                rHtml += '<td class="dnfl-text-center">';

                if (w > moduleState.maxCompletedWeek) {
                    rHtml += '<span class="dnfl-text-muted">—</span>';
                } else {
                    var score = data.weeklyScoresMap[fid] ? data.weeklyScoresMap[fid][w] : undefined;
                    if (score === undefined) {
                        rHtml += '<span class="dnfl-text-muted">—</span>';
                    } else {
                        var scoreStr = score.toFixed(2);
                        var elimInfo = data.lts_eliminations[fid];

                        // Post-Elimination Score (eliminated in a week prior to w)
                        if (isLtsOn && elimInfo && elimInfo.week < w) {
                            rHtml += '<span class="dnfl-text-muted dnfl-italic">' + scoreStr + '</span>';
                        } else {
                            // Active or eliminated in current week w
                            var isLtsKnockout = isLtsOn && elimInfo && elimInfo.week === w;
                            var isChampionFinalWeek = isLtsOn && w === data.ltsEndWeek && fid === data.championFid;
                            var isHighScorer = data.lts_highScorersMap[w] === fid;

                            if (isChampionFinalWeek) {
                                rHtml += '<span class="dnfl-pill dnfl-pill-blue">' + scoreStr + ' <i class="fa-solid fa-medal"></i></span>';
                            } else if (isLtsKnockout) {
                                rHtml += '<span class="dnfl-pill dnfl-pill-red">' + scoreStr + ' <i class="fa-solid fa-skull"></i></span>';
                            } else if (isHighScorer) {
                                if (isHsOn) {
                                    rHtml += '<span class="dnfl-pill dnfl-pill-green">' + scoreStr + ' <i class="fa-solid fa-star"></i></span>';
                                } else {
                                    rHtml += '<span class="dnfl-badge dnfl-badge-green">' + scoreStr + '</span>';
                                }
                            } else if (data.lts_lowScorersMap[w] === fid && !isLtsOn) {
                                rHtml += '<span class="dnfl-badge dnfl-badge-red">' + scoreStr + '</span>';
                            } else {
                                rHtml += '<span class="dnfl-badge">' + scoreStr + '</span>';
                            }
                        }
                    }
                }

                rHtml += '</td>';
            }

            rHtml += '</tr>';
            return rHtml;
        }

        if (isLtsOn) {
            // Split teams into Active and Eliminated
            var activeList = [];
            var eliminatedList = [];

            data.confFranchises.forEach(function (f) {
                var fid = normFranchiseId(f.id);
                if (data.lts_eliminations[fid]) {
                    eliminatedList.push(f);
                } else {
                    activeList.push(f);
                }
            });

            // Sort Active Teams Alphabetically (A to Z)
            activeList.sort(function (a, b) {
                return (a.name || '').localeCompare(b.name || '');
            });

            // Sort Eliminated Teams in Reverse Order of Elimination (most recent first)
            eliminatedList.sort(function (a, b) {
                var fidA = normFranchiseId(a.id);
                var fidB = normFranchiseId(b.id);
                var orderA = data.lts_eliminations[fidA] ? data.lts_eliminations[fidA].order : 0;
                var orderB = data.lts_eliminations[fidB] ? data.lts_eliminations[fidB].order : 0;
                return orderB - orderA;
            });

            // Render Active Section Sub-Header Row
            html += '<tr class="dnfl-subhead-active"><td colspan="' + totalCols + '" class="dnfl-sticky-col">LTS Active Teams (' + activeList.length + ')</td></tr>';
            activeList.forEach(function (f, idx) {
                html += renderRow(f, idx);
            });

            // Render Eliminated Section Sub-Header Row
            if (eliminatedList.length > 0) {
                html += '<tr class="dnfl-subhead-eliminated"><td colspan="' + totalCols + '" class="dnfl-sticky-col">LTS Eliminated Teams (' + eliminatedList.length + ')</td></tr>';
                eliminatedList.forEach(function (f, idx) {
                    html += renderRow(f, idx);
                });
            }
        } else {
            // LTS Disabled: Single group sorted Alphabetically (A to Z)
            var sortedAll = data.confFranchises.slice().sort(function (a, b) {
                return (a.name || '').localeCompare(b.name || '');
            });
            sortedAll.forEach(function (f, idx) {
                html += renderRow(f, idx);
            });
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    /**
     * Render Table 2: Weekly Summary (.dnfl-lts-summary-table)
     */
    function renderSummaryTable(data) {
        var container = document.getElementById('dnfl-lts-summary-container');
        var section = document.getElementById('dnfl-lts-summary-section');
        if (!container || !section) return;

        var isLtsOn = data.confRules.lts_isEnabled;
        var isHsOn = data.confRules.highScore_isEnabled;

        // Automatically hide Table 2 if both features are disabled
        if (!isLtsOn && !isHsOn) {
            container.innerHTML = '';
            section.classList.add('dnfl-is-hidden');
            return;
        }

        section.classList.remove('dnfl-is-hidden');

        var totalCols = 1 + (isLtsOn ? 2 : 0) + (isHsOn ? 2 : 0);

        var html = '<div id="dnfl-lts-summary-wrapper" class="dnfl-table-wrapper">';
        html += '<table class="dnfl-table dnfl-lts-summary-table">';

        // 1. Table Header Row (Section Title pinned sticky left)
        html += '<thead>';
        html += '<tr class="dnfl-table-section-header">';
        html += '<td colspan="' + totalCols + '" class="dnfl-table-section-header-cell dnfl-sticky-col">';
        html += '<div class="dnfl-table-section-header-content"><h3>Weekly Summary</h3></div>';
        html += '</td>';
        html += '</tr>';

        // 2. Column Headers
        html += '<tr>';
        html += '<th class="dnfl-col-week">Week</th>';
        if (isLtsOn) {
            html += '<th class="dnfl-col-franchise">Eliminated Franchise</th>';
            html += '<th class="dnfl-col-score">Knockout Score</th>';
        }
        if (isHsOn) {
            html += '<th class="dnfl-col-franchise">Weekly High Scorer</th>';
            html += '<th class="dnfl-col-score">High Score</th>';
        }
        html += '</tr>';
        html += '</thead>';

        html += '<tbody>';

        if (moduleState.maxCompletedWeek === 0) {
            html += '<tr><td colspan="' + totalCols + '" class="dnfl-text-center dnfl-text-muted">No regular season scores finalized yet.</td></tr>';
        } else {
            for (var w = 1; w <= moduleState.maxCompletedWeek; w++) {
                var summary = data.lts_weeklySummaries.find(function (s) { return s.week === w; });
                var rowClass = (w % 2 === 0) ? 'dnfl-row-even' : 'dnfl-row-odd';

                html += '<tr class="' + rowClass + '">';
                html += '<td class="dnfl-col-week">Week ' + w + '</td>';

                if (isLtsOn) {
                    if (summary && summary.eliminatedFid) {
                        var elimFranchise = data.franchiseMap[summary.eliminatedFid];
                        html += '<td class="dnfl-col-franchise">' + buildFranchiseCell(elimFranchise) + '</td>';
                        html += '<td class="dnfl-col-score"><span class="dnfl-pill dnfl-pill-red">' + (summary.knockoutScore ? summary.knockoutScore.toFixed(2) : '—') + ' <i class="fa-solid fa-skull"></i></span></td>';
                    } else {
                        html += '<td class="dnfl-col-franchise"><span class="dnfl-text-muted">—</span></td>';
                        html += '<td class="dnfl-col-score"><span class="dnfl-text-muted">—</span></td>';
                    }
                }

                if (isHsOn) {
                    if (summary && summary.highScorerFid) {
                        var hsFranchise = data.franchiseMap[summary.highScorerFid];
                        html += '<td class="dnfl-col-franchise">' + buildFranchiseCell(hsFranchise) + '</td>';
                        html += '<td class="dnfl-col-score"><span class="dnfl-pill dnfl-pill-green">' + (summary.highScore ? summary.highScore.toFixed(2) : '—') + ' <i class="fa-solid fa-star"></i></span></td>';
                    } else {
                        html += '<td class="dnfl-col-franchise"><span class="dnfl-text-muted">—</span></td>';
                        html += '<td class="dnfl-col-score"><span class="dnfl-text-muted">—</span></td>';
                    }
                }

                html += '</tr>';
            }
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    /**
     * Render Dynamic Legend Panel (#dnfl-lts-legend)
     */
    function renderLegend(data) {
        var legendEl = document.getElementById('dnfl-lts-legend');
        if (!legendEl) return;

        if (!data || !data.confRules) {
            legendEl.innerHTML = '';
            return;
        }

        var isLtsOn = data.confRules.lts_isEnabled;
        var isHsOn = data.confRules.highScore_isEnabled;

        var html = '<div class="dnfl-legend-items">';

        // 1. LTS Champion
        if (isLtsOn) {
            html += '<div class="dnfl-legend-item">' +
                '<span class="dnfl-pill dnfl-pill-blue"><i class="fa-solid fa-medal"></i></span>' +
                '<span class="dnfl-legend-label">LTS Champion</span>' +
                '</div>';
        }

        // 2. High Score
        html += '<div class="dnfl-legend-item">' +
            '<span class="dnfl-pill dnfl-pill-green"><i class="fa-solid fa-star"></i></span>' +
            '<span class="dnfl-legend-label">High Score</span>' +
            '</div>';

        // 3. LTS Elimination
        if (isLtsOn) {
            html += '<div class="dnfl-legend-item">' +
                '<span class="dnfl-pill dnfl-pill-red"><i class="fa-solid fa-skull"></i></span>' +
                '<span class="dnfl-legend-label">LTS Elimination</span>' +
                '</div>';
        }

        // 4. High Score (Off)
        if (!isHsOn) {
            html += '<div class="dnfl-legend-item">' +
                '<span class="dnfl-badge dnfl-badge-green">&nbsp;</span>' +
                '<span class="dnfl-legend-label">High Score (Off)</span>' +
                '</div>';
        }

        // 5. Low Score (Safe)
        html += '<div class="dnfl-legend-item">' +
            '<span class="dnfl-badge dnfl-badge-red">&nbsp;</span>' +
            '<span class="dnfl-legend-label">Low Score (Safe)</span>' +
            '</div>';

        html += '</div>'; // end items

        // Dynamic note text on full-width row
        var noteText = '';
        if (isLtsOn) {
            noteText = '*LTS eliminations active Weeks ' + data.ltsStartWeek + '–' + data.ltsEndWeek + '.';
        } else {
            noteText = '*LTS eliminations feature disabled for this conference.';
        }
        html += '<div class="dnfl-legend-note">' + noteText + '</div>';

        legendEl.innerHTML = html;
    }

    /**
     * Update View Method (Public API)
     */
    function updateView() {
        var selectEl = document.getElementById('dnfl-lts-conference-select');
        if (selectEl && selectEl.value) {
            moduleState.activeConferenceId = selectEl.value;
        }

        var data = computeConferenceLTS(moduleState.activeConferenceId);
        if (!data) return;

        renderCardTitle(data);
        renderScoresTable(data);
        renderSummaryTable(data);
        renderLegend(data);
    }

    /**
     * Toggle Weekly Scores Table Visibility
     */
    function toggleScores() {
        var section = document.getElementById('dnfl-lts-scores-section');
        var btn = document.getElementById('dnfl-btn-lts-scores');
        if (!section || !btn) return;

        moduleState.scoresVisible = !moduleState.scoresVisible;

        if (moduleState.scoresVisible) {
            section.classList.remove('dnfl-is-hidden');
            btn.innerHTML = '<i class="fa-solid fa-table-cells"></i> Hide Scores';
        } else {
            section.classList.add('dnfl-is-hidden');
            btn.innerHTML = '<i class="fa-solid fa-table-cells"></i> Show Scores';
        }
    }

    /**
     * Toggle Weekly Summary Table Visibility
     */
    function toggleSummary() {
        var section = document.getElementById('dnfl-lts-summary-section');
        var btn = document.getElementById('dnfl-btn-lts-summary');
        if (!section || !btn) return;

        moduleState.summaryVisible = !moduleState.summaryVisible;

        if (moduleState.summaryVisible) {
            section.classList.remove('dnfl-is-hidden');
            btn.innerHTML = '<i class="fa-solid fa-list-check"></i> Hide Summary';
        } else {
            section.classList.add('dnfl-is-hidden');
            btn.innerHTML = '<i class="fa-solid fa-list-check"></i> Show Summary';
        }
    }

    /**
     * Primary Initialization Workflow
     */
    function init() {
        var container = document.getElementById(CONTAINER_ID);
        if (!container) {
            if (moduleState.retryCount < 50) {
                moduleState.retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        if (moduleState.initialized) return;
        moduleState.initialized = true;

        loadData()
            .then(function () {
                renderConferenceSelect();
                updateView();
            })
            .catch(function (err) {
                console.error('[DNFL.LTS] Initialization error:', err);
                container.innerHTML = '<div class="dnfl-card"><div class="dnfl-card-body"><div class="dnfl-status-error"><i class="fa-solid fa-circle-exclamation"></i> Failed to load Last Team Standing module: ' + (err.message || 'Network error') + '</div></div></div>';
            });
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
        document.addEventListener('DOMContentLoaded', init);
    }
    window.addEventListener('dnfl:ready', init);

})();
