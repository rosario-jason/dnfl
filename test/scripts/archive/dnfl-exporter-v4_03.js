/* ==========================================================================
   DNFL Commissioner Data Exporter Engine v4.03
   Duke Networking Fantasy League (DNFL)
   Aligned with dnfl-standings-v3_36.js & dnfl-api-client-v3_36.txt architecture.
   Provides centralized API fetching, multi-tier isolated caching (_L{leagueId}_Y{year}),
   event-driven initialization, and multi-format data export generators.
   ========================================================================== */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    // Standings & Seeding Configuration Cache (Shared with dnfl-standings.js)
    let STANDINGS_RULES = {};

    // Global Context Resolver Variables
    let targetYear = window.current_year || null;
    if (!targetYear && window.location) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear().toString();
    }

    /**
     * Dynamic League ID Resolver (Aligned with dnfl-standings-v3_36.js)
     */
    function getLeagueId() {
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.getContext === 'function') {
            return window.DNFL.Client.getContext().leagueId;
        }
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('L') || urlParams.get('l') || window.league_id || window.mflLeagueId || '22883';
    }

    /**
     * Retrieves API Client Middleware Instance (Aligned with dnfl-standings-v3_36.js)
     */
    function getApiClient() {
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("[DNFL Exporter] DNFL.Client API middleware is required but unavailable.");
        }
        return client;
    }

    // State Caches
    let cachedLeague = null;
    let cachedFranchises = [];
    let cachedPlayersMap = {};
    let currentReportData = null;
    let currentReportType = 'rosters';
    let currentReportFormat = 'csv';
    let currentSelectedWeek = 1;
    let retryCount = 0;
    const maxRetries = 50;

    /**
     * Helper to normalize 2-digit ID values (e.g. "0", 0 -> "00")
     */
    function norm(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    /**
     * Helper to normalize 4-digit franchise IDs (e.g. "5", 5 -> "0005")
     */
    function normFranchiseId(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    /**
     * Helper to safely convert MFL payload values into Arrays
     */
    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    /**
     * Reformats MFL player names from "LastName, FirstName" to "FirstName LastName"
     */
    function formatPlayerName(rawName) {
        if (!rawName) return 'Unknown Player';
        const str = String(rawName).trim();
        if (str.includes(',')) {
            const parts = str.split(',').map(s => s.trim());
            if (parts.length >= 2) {
                return `${parts[1]} ${parts[0]}`;
            }
        }
        return str;
    }

    /**
     * Standard League Info (Franchises, Divisions, Conferences) via standard MFL league API
     */
    async function getLeagueInfo() {
        if (cachedLeague) return cachedLeague;
        const client = getApiClient();
        const data = await client.fetchData('league');
        cachedLeague = data?.league || {};
        cachedFranchises = toArray(cachedLeague?.franchises?.franchise);
        return cachedLeague;
    }

    /**
     * Standard Player Database Metadata via standard MFL players API (&DETAILS=1)
     */
    async function getPlayersMap() {
        if (Object.keys(cachedPlayersMap).length > 0) return cachedPlayersMap;
        try {
            const client = getApiClient();
            const data = await client.fetchData('players', { DETAILS: 1 });
            const pArray = toArray(data?.players?.player);

            pArray.forEach(p => {
                const rawId = String(p.id).trim();
                const unpaddedId = rawId.replace(/^0+/, '');
                const paddedId = unpaddedId.padStart(4, '0');

                const pObj = {
                    id: rawId,
                    name: formatPlayerName(p.name),
                    position: p.position || p.pos || 'N/A',
                    team: p.team || p.nflTeam || 'FA'
                };

                cachedPlayersMap[rawId] = pObj;
                cachedPlayersMap[unpaddedId] = pObj;
                cachedPlayersMap[paddedId] = pObj;
            });
        } catch (e) {
            console.error('[DNFL Exporter] Error loading players map via DNFL.Client:', e);
        }
        return cachedPlayersMap;
    }

    /**
     * Helper to fetch YTD points map using native MFL API (&W=YTD)
     */
    async function getYtdScoresMap() {
        const client = getApiClient();
        const ytdScoresData = await client.fetchData('playerScores', { W: 'YTD' });
        const ytdMap = {};

        if (ytdScoresData?.playerScores?.playerScore) {
            toArray(ytdScoresData.playerScores.playerScore).forEach(ps => {
                const pid = String(ps.id).trim();
                const unpaddedPid = pid.replace(/^0+/, '');
                const score = ps.score || ps.points || ps.ytd || 0;
                const formattedScore = parseFloat(score).toFixed(2);
                ytdMap[pid] = formattedScore;
                ytdMap[unpaddedPid] = formattedScore;
            });
        }

        return ytdMap;
    }

    /**
     * Maps Franchise ID to Franchise Name
     */
    function getFranchiseName(fid) {
        const normFid = normFranchiseId(fid);
        const f = cachedFranchises.find(item => normFranchiseId(item.id) === normFid);
        return f ? f.name : `Franchise ${normFid}`;
    }

    /**
     * Maps Franchise ID to Owner Name
     */
    function getFranchiseOwner(fid) {
        const normFid = normFranchiseId(fid);
        const f = cachedFranchises.find(item => normFranchiseId(item.id) === normFid);
        return f ? (f.owner_name || f.username || 'N/A') : 'N/A';
    }

    /**
     * Helper to load standings rules dynamically from standings_rules.json (Aligned with dnfl-standings.js)
     */
    async function loadStandingsRules() {
        if (Object.keys(STANDINGS_RULES).length > 0) return STANDINGS_RULES;
        try {
            const rulesUrl = 'https://dnfl.live/dnfl_standings/standings_rules.json';
            const client = getApiClient();
            const rawRulesJson = await client.fetchRawText(rulesUrl).catch(() => null);
            if (rawRulesJson) {
                STANDINGS_RULES = JSON.parse(rawRulesJson);
            }
        } catch (e) {
            console.warn('[DNFL Exporter] Could not load standings_rules.json, applying fallback.', e);
        }

        if (!STANDINGS_RULES || !STANDINGS_RULES['default']) {
            STANDINGS_RULES = {
                'default': {
                    seedingScope: 'conference',
                    seedingModel: 'standard_div_winners_first',
                    playoffCutoff: 6,
                    hasDivisionCrown: true
                }
            };
        }
        return STANDINGS_RULES;
    }

    function getYearRules() {
        const yr = parseInt(targetYear);
        if (STANDINGS_RULES[yr]) return STANDINGS_RULES[yr];

        for (const key in STANDINGS_RULES) {
            if (key.startsWith('_')) continue;
            if (key.includes('-')) {
                const [start, end] = key.split('-').map(s => parseInt(s.trim()));
                if (yr >= start && yr <= end) return STANDINGS_RULES[key];
            }
            if (key.includes(',')) {
                const yearList = key.split(',').map(s => parseInt(s.trim()));
                if (yearList.includes(yr)) return STANDINGS_RULES[key];
            }
        }
        return STANDINGS_RULES['default'] || {};
    }

    function getConfRules(baseRules, confId) {
        const normConfId = norm(confId);
        if (!normConfId || !baseRules.conferenceOverrides || !baseRules.conferenceOverrides[normConfId]) {
            return baseRules;
        }
        return { ...baseRules, ...baseRules.conferenceOverrides[normConfId] };
    }

    /**
     * Replicates calculateSeedsAndBadges() from dnfl-standings-v3_36.js
     */
    async function calculateTeamSeeds(franchiseStandings) {
        await loadStandingsRules();
        const baseRules = getYearRules();
        const teamSeeds = {};
        const divLeaders = {};
        const divRunnerUps = {};

        const hasSeasonStarted = franchiseStandings.some(s => {
            const games = parseInt(s.h2hw || 0) + parseInt(s.h2hl || 0) + parseInt(s.h2ht || 0);
            const pf = parseFloat(s.pf || 0);
            return games > 0 || pf > 0;
        });

        if (!hasSeasonStarted) {
            franchiseStandings.forEach((s, idx) => {
                teamSeeds[normFranchiseId(s.id)] = idx + 1;
            });
            return teamSeeds;
        }

        const divisions = toArray(cachedLeague?.divisions?.division);
        const conferences = toArray(cachedLeague?.conferences?.conference);
        const leagueFranchises = toArray(cachedLeague?.franchises?.franchise);

        const divToConfMap = {};
        divisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

        const getMflIndex = (id) => franchiseStandings.findIndex(s => normFranchiseId(s.id) === normFranchiseId(id));
        const getPf = (id) => {
            const s = franchiseStandings.find(item => normFranchiseId(item.id) === normFranchiseId(id));
            return parseFloat(s?.pf || s?.h2hpf || s?.points_for || 0);
        };

        const sortByPfThenMfl = (a, b) => {
            const pfDiff = getPf(b) - getPf(a);
            if (pfDiff !== 0) return pfDiff;
            return getMflIndex(a) - getMflIndex(b);
        };

        divisions.forEach(div => {
            const divIdNorm = norm(div.id);
            const teamsInDiv = leagueFranchises.filter(f => norm(f.division || f.div) === divIdNorm).map(f => normFranchiseId(f.id));
            teamsInDiv.sort((a, b) => getMflIndex(a) - getMflIndex(b));

            if (teamsInDiv.length > 0) divLeaders[divIdNorm] = teamsInDiv[0];
            if (teamsInDiv.length > 1) divRunnerUps[divIdNorm] = teamsInDiv[1];
        });

        let scopesToProcess = [];

        if (baseRules.seedingScope === 'league') {
            scopesToProcess.push({
                scopeId: 'league',
                teams: leagueFranchises.map(f => normFranchiseId(f.id)),
                leaders: Object.values(divLeaders),
                runnersUp: Object.values(divRunnerUps)
            });
        } else {
            conferences.forEach(conf => {
                const confIdNorm = norm(conf.id);
                const confTeams = leagueFranchises.filter(f => {
                    const fDivNorm = norm(f.division || f.div);
                    const fConfNorm = norm(f.conference || f.conf || divToConfMap[fDivNorm]);
                    return fConfNorm === confIdNorm;
                }).map(f => normFranchiseId(f.id));

                const confDivs = divisions.filter(d => norm(d.conference) === confIdNorm).map(d => norm(d.id));
                const confLeaders = confDivs.map(dId => divLeaders[dId]).filter(id => id !== undefined);
                const confRunners = confDivs.map(dId => divRunnerUps[dId]).filter(id => id !== undefined);

                scopesToProcess.push({
                    scopeId: confIdNorm,
                    teams: confTeams,
                    leaders: confLeaders,
                    runnersUp: confRunners
                });
            });
        }

        if (baseRules.seedingModel === 'manual' && baseRules.manualSeeds) {
            Object.keys(baseRules.manualSeeds).forEach(fid => {
                teamSeeds[normFranchiseId(fid)] = baseRules.manualSeeds[fid];
            });
        } else {
            scopesToProcess.forEach(scope => {
                const confRules = scope.scopeId !== 'league' ? getConfRules(baseRules, scope.scopeId) : baseRules;

                if (confRules.seedingModel === 'tiered_div_finish_pf') {
                    const winners = scope.leaders.slice();
                    winners.sort(sortByPfThenMfl);
                    winners.forEach((id, idx) => teamSeeds[id] = idx + 1);

                    const runners = scope.runnersUp.slice();
                    runners.sort(sortByPfThenMfl);
                    runners.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length);

                    const assigned = new Set([...winners, ...runners]);
                    const remaining = scope.teams.filter(id => !assigned.has(id));
                    remaining.sort(sortByPfThenMfl);
                    remaining.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length + runners.length);

                } else if (confRules.seedingModel === 'standard_div_winners_first') {
                    const winners = scope.leaders.slice();
                    winners.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    winners.forEach((id, idx) => teamSeeds[id] = idx + 1);

                    const remaining = scope.teams.filter(id => !winners.includes(id));
                    remaining.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    remaining.forEach((id, idx) => teamSeeds[id] = idx + 1 + winners.length);

                } else if (confRules.seedingModel === 'mfl_native') {
                    const allTeams = scope.teams.slice();
                    allTeams.sort((a, b) => getMflIndex(a) - getMflIndex(b));
                    allTeams.forEach((id, idx) => teamSeeds[id] = idx + 1);
                }
            });
        }

        return teamSeeds;
    }

    /* ==========================================================================
       REPORT GENERATOR 1: AUTOMATED POWER RANKINGS
       ========================================================================== */
    async function generatePowerRankingsReport(targetWeek) {
        const client = getApiClient();
        await getLeagueInfo();

        const weekNum = parseInt(targetWeek) || 1;
        const leagueFranchises = toArray(cachedLeague?.franchises?.franchise);
        const divisions = toArray(cachedLeague?.divisions?.division);
        const conferences = toArray(cachedLeague?.conferences?.conference);

        const divMap = {};
        divisions.forEach(d => divMap[norm(d.id)] = d.name);

        const confMap = {};
        conferences.forEach(c => confMap[norm(c.id)] = c.name);

        const divToConfMap = {};
        divisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

        // 1. Fetch weeklyResults up to targetWeek in parallel via DNFL.Client
        const weeklyPromises = [];
        for (let w = 1; w <= weekNum; w++) {
            weeklyPromises.push(client.fetchData('weeklyResults', { W: w }).catch(() => null));
        }

        const weeklyResultsArray = await Promise.all(weeklyPromises);

        // Data accumulators per franchise
        const stats = {};
        leagueFranchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            const divIdNorm = norm(f.division || f.div);
            const confIdNorm = norm(f.conference || f.conf || divToConfMap[divIdNorm]);

            stats[fid] = {
                fid: fid,
                name: f.name || `Franchise ${fid}`,
                owner: f.owner_name || 'N/A',
                confName: confMap[confIdNorm] || 'DNFL',
                wins: 0,
                losses: 0,
                ties: 0,
                pf: 0,
                pa: 0,
                weeklyScores: [],
                allPlayWins: 0,
                allPlayLosses: 0,
                allPlayTies: 0
            };
        });

        // 2. Process Weekly Head-to-Head and All-Play Records
        weeklyResultsArray.forEach((wData, idx) => {
            if (!wData?.weeklyResults) return;
            const rawMatchups = wData.weeklyResults.matchup || wData.weeklyResults.matchUp || wData.weeklyResults.schedule?.matchup;
            const matchups = toArray(rawMatchups);

            const weekScoresThisWeek = [];

            matchups.forEach(m => {
                const franchises = toArray(m.franchise);
                if (franchises.length >= 2) {
                    const f1 = franchises[0];
                    const f2 = franchises[1];
                    const f1Id = normFranchiseId(f1.id);
                    const f2Id = normFranchiseId(f2.id);
                    const f1Score = parseFloat(f1.score || 0);
                    const f2Score = parseFloat(f2.score || 0);

                    if (stats[f1Id]) {
                        stats[f1Id].pf += f1Score;
                        stats[f1Id].pa += f2Score;
                        stats[f1Id].weeklyScores.push(f1Score);
                        if (f1Score > f2Score) stats[f1Id].wins++;
                        else if (f2Score > f1Score) stats[f1Id].losses++;
                        else if (f1Score > 0) stats[f1Id].ties++;
                        weekScoresThisWeek.push({ fid: f1Id, score: f1Score });
                    }

                    if (stats[f2Id]) {
                        stats[f2Id].pf += f2Score;
                        stats[f2Id].pa += f1Score;
                        stats[f2Id].weeklyScores.push(f2Score);
                        if (f2Score > f1Score) stats[f2Id].wins++;
                        else if (f1Score > f2Score) stats[f2Id].losses++;
                        else if (f2Score > 0) stats[f2Id].ties++;
                        weekScoresThisWeek.push({ fid: f2Id, score: f2Score });
                    }
                }
            });

            // Compute All-Play record for this week
            weekScoresThisWeek.forEach(itemA => {
                weekScoresThisWeek.forEach(itemB => {
                    if (itemA.fid !== itemB.fid) {
                        if (itemA.score > itemB.score) stats[itemA.fid].allPlayWins++;
                        else if (itemB.score > itemA.score) stats[itemA.fid].allPlayLosses++;
                        else if (itemA.score > 0) stats[itemA.fid].allPlayTies++;
                    }
                });
            });
        });

        const statList = Object.values(stats);
        const maxPf = Math.max(...statList.map(s => s.pf), 1);

        // 3. Compute Composite Weighted Power Index (0 to 100)
        statList.forEach(s => {
            const totalGames = s.wins + s.losses + s.ties;
            const actualWinPct = totalGames > 0 ? (s.wins + 0.5 * s.ties) / totalGames : 0;

            const totalAllPlay = s.allPlayWins + s.allPlayLosses + s.allPlayTies;
            const allPlayPct = totalAllPlay > 0 ? (s.allPlayWins + 0.5 * s.allPlayTies) / totalAllPlay : 0;

            const pfRatio = s.pf / maxPf;

            const last3Scores = s.weeklyScores.slice(-3);
            const avg3Week = last3Scores.length > 0 ? last3Scores.reduce((a, b) => a + b, 0) / last3Scores.length : 0;
            const trendScore = avg3Week / (maxPf / Math.max(weekNum, 1));

            // Weighted Power Index Formula: PF (35%) + H2H Win% (30%) + All-Play Win% (25%) + 3-Wk Trend (10%)
            const rawIndex = (pfRatio * 35) + (actualWinPct * 30) + (allPlayPct * 25) + (trendScore * 10);
            s.powerScore = parseFloat(rawIndex.toFixed(2));
            s.actualWinPct = actualWinPct;
            s.allPlayPct = allPlayPct;
        });

        // 4. Sort by Power Score descending
        statList.sort((a, b) => b.powerScore - a.powerScore);

        // 5. Assign Ranks and Tiers
        const rows = statList.map((s, idx) => {
            const rank = idx + 1;
            let tier = 'Tier 4: Rebuilding';
            if (rank <= 6) tier = 'Tier 1: Championship Contenders';
            else if (rank <= 18) tier = 'Tier 2: Playoff Lock';
            else if (rank <= 28) tier = 'Tier 3: On the Bubble';

            const allPlayStr = `${s.allPlayWins}-${s.allPlayLosses}${s.allPlayTies > 0 ? '-' + s.allPlayTies : ''}`;
            const h2hStr = `${s.wins}-${s.losses}${s.ties > 0 ? '-' + s.ties : ''}`;

            return {
                "Rank": rank,
                "Franchise ID": s.fid,
                "Team Name": s.name,
                "Owner": s.owner,
                "Conference": s.confName,
                "Power Score": s.powerScore.toFixed(2),
                "Record (H2H)": h2hStr,
                "Points For (PF)": s.pf.toFixed(2),
                "All-Play Record": allPlayStr,
                "All-Play Win %": (s.allPlayPct * 100).toFixed(1) + '%',
                "Tier": tier
            };
        });

        return {
            title: `DNFL Power Rankings Data (Week ${weekNum}, ${targetYear})`,
            description: `Automated composite power ranking calculation based on PF (35%), Head-to-Head Win% (30%), All-Play Win% (25%), and 3-week scoring trend (10%) through Week ${weekNum}.`,
            columns: ["Rank", "Franchise ID", "Team Name", "Owner", "Conference", "Power Score", "Record (H2H)", "Points For (PF)", "All-Play Record", "All-Play Win %", "Tier"],
            rows: rows
        };
    }

    /* ==========================================================================
       REPORT GENERATOR 2: ROSTERS
       ========================================================================== */
    async function generateRostersReport(week) {
        const client = getApiClient();
        await getLeagueInfo();
        const playersMap = await getPlayersMap();

        const weekNum = week || 1;

        const [rostersData, ytdMap] = await Promise.all([
            client.fetchData('rosters', { W: weekNum }),
            getYtdScoresMap()
        ]);

        const rosterList = toArray(rostersData?.rosters?.franchise);
        const rows = [];

        rosterList.forEach(f => {
            const fid = normFranchiseId(f.id);
            const teamName = getFranchiseName(fid);
            const players = toArray(f.player);

            players.forEach(p => {
                const pid = String(p.id).trim();
                const unpaddedPid = pid.replace(/^0+/, '');
                const pInfo = playersMap[pid] || playersMap[unpaddedPid] || { 
                    name: formatPlayerName(p.name || ('Player ' + pid)), 
                    position: p.position || p.pos || 'N/A', 
                    team: p.team || p.nflTeam || 'FA' 
                };

                rows.push({
                    "Week": weekNum,
                    "Franchise ID": fid,
                    "Team Name": teamName,
                    "Player ID": pid,
                    "Player Name": pInfo.name,
                    "Position": pInfo.position,
                    "NFL Team": pInfo.team,
                    "Roster Status": p.status || 'ROSTER',
                    "YTD Points": ytdMap[pid] || ytdMap[unpaddedPid] || '0.00'
                });
            });
        });

        rows.sort((a, b) => a["Team Name"].localeCompare(b["Team Name"]) || a["Position"].localeCompare(b["Position"]));

        return {
            title: `DNFL Rosters (Week ${weekNum}, ${targetYear})`,
            description: `Complete roster listing across all franchises including native player YTD fantasy points for Week ${weekNum}.`,
            columns: ["Week", "Franchise ID", "Team Name", "Player ID", "Player Name", "Position", "NFL Team", "Roster Status", "YTD Points"],
            rows: rows
        };
    }

    /* ==========================================================================
       REPORT GENERATOR 3: MATCHUP SCORES
       ========================================================================== */
    async function generateMatchupsReport(week) {
        const client = getApiClient();
        await getLeagueInfo();

        const weeklyData = await client.fetchData('weeklyResults', { W: week });
        const rawMatchups = weeklyData?.weeklyResults?.matchup || weeklyData?.weeklyResults?.matchUp || weeklyData?.weeklyResults?.schedule?.matchup;
        let matchups = toArray(rawMatchups);

        if (matchups.length === 0 && weeklyData?.weeklyResults?.franchise) {
            const fList = toArray(weeklyData.weeklyResults.franchise);
            const processedFids = new Set();
            fList.forEach(f => {
                const fid = normFranchiseId(f.id);
                const oppId = normFranchiseId(f.opponent || f.opp || f.vs);
                if (!processedFids.has(fid)) {
                    processedFids.add(fid);
                    if (oppId) processedFids.add(oppId);
                    const oppObj = fList.find(o => normFranchiseId(o.id) === oppId) || {};
                    matchups.push({ franchise: [f, oppObj] });
                }
            });
        }

        const rows = [];

        matchups.forEach((m, idx) => {
            const franchises = toArray(m.franchise);
            if (franchises.length >= 2) {
                const team1 = franchises[0];
                const team2 = franchises[1];

                const t1Id = normFranchiseId(team1.id);
                const t2Id = normFranchiseId(team2.id);

                const t1Name = getFranchiseName(t1Id);
                const t2Name = getFranchiseName(t2Id);

                const t1Score = parseFloat(team1.score || 0);
                const t2Score = parseFloat(team2.score || 0);

                let winner = 'TIE';
                let margin = Math.abs(t1Score - t2Score).toFixed(2);

                if (t1Score > t2Score) winner = t1Name;
                else if (t2Score > t1Score) winner = t2Name;

                rows.push({
                    "Week": week,
                    "Matchup #": idx + 1,
                    "Franchise 1 ID": t1Id,
                    "Franchise 1 Name": t1Name,
                    "Franchise 1 Score": t1Score.toFixed(2),
                    "Franchise 2 ID": t2Id,
                    "Franchise 2 Name": t2Name,
                    "Franchise 2 Score": t2Score.toFixed(2),
                    "Winning Team": winner,
                    "Margin of Victory": margin,
                    "Franchise 1 Optimal Score": parseFloat(team1.opt_pts || team1.optScore || 0).toFixed(2),
                    "Franchise 2 Optimal Score": parseFloat(team2.opt_pts || team2.optScore || 0).toFixed(2)
                });
            }
        });

        return {
            title: `DNFL Matchup Scores (Week ${week}, ${targetYear})`,
            description: `Summary of head-to-head matchup results, final team scores, margins of victory, and optimal scores for Week ${week}.`,
            columns: ["Week", "Matchup #", "Franchise 1 ID", "Franchise 1 Name", "Franchise 1 Score", "Franchise 2 ID", "Franchise 2 Name", "Franchise 2 Score", "Winning Team", "Margin of Victory", "Franchise 1 Optimal Score", "Franchise 2 Optimal Score"],
            rows: rows
        };
    }

    /* ==========================================================================
       REPORT GENERATOR 4: WEEKLY LINEUP DETAILS
       ========================================================================== */
    async function generateWeeklyDetailsReport(week) {
        const client = getApiClient();
        await getLeagueInfo();
        const playersMap = await getPlayersMap();

        const weekNum = week || 1;

        const [weeklyData, ytdMap, projScoresData] = await Promise.all([
            client.fetchData('weeklyResults', { W: weekNum, DETAILS: 1 }),
            getYtdScoresMap(),
            client.fetchData('projectedScores', { W: weekNum })
        ]);

        const projMap = {};
        if (projScoresData?.projectedScores?.playerScore) {
            toArray(projScoresData.projectedScores.playerScore).forEach(ps => {
                const pid = String(ps.id).trim();
                const unpaddedPid = pid.replace(/^0+/, '');
                const proj = ps.score || ps.projected_score || ps.points || 0;
                projMap[pid] = parseFloat(proj).toFixed(2);
                projMap[unpaddedPid] = parseFloat(proj).toFixed(2);
            });
        }

        const rawMatchups = weeklyData?.weeklyResults?.matchup || weeklyData?.weeklyResults?.matchUp || weeklyData?.weeklyResults?.schedule?.matchup;
        let matchups = toArray(rawMatchups);

        if (matchups.length === 0 && weeklyData?.weeklyResults?.franchise) {
            const fList = toArray(weeklyData.weeklyResults.franchise);
            const processedFids = new Set();
            fList.forEach(f => {
                const fid = normFranchiseId(f.id);
                const oppId = normFranchiseId(f.opponent || f.opp || f.vs);
                if (!processedFids.has(fid)) {
                    processedFids.add(fid);
                    if (oppId) processedFids.add(oppId);
                    const oppObj = fList.find(o => normFranchiseId(o.id) === oppId) || {};
                    matchups.push({ franchise: [f, oppObj] });
                }
            });
        }

        const rows = [];

        matchups.forEach((m, mIdx) => {
            const franchises = toArray(m.franchise);
            franchises.forEach(f => {
                const fid = normFranchiseId(f.id);
                const teamName = getFranchiseName(fid);
                const players = toArray(f.players?.player || f.player);

                players.forEach(p => {
                    const pid = String(p.id).trim();
                    const unpaddedPid = pid.replace(/^0+/, '');
                    const pInfo = playersMap[pid] || playersMap[unpaddedPid] || { 
                        name: formatPlayerName(p.name || ('Player ' + pid)), 
                        position: p.position || p.pos || 'N/A', 
                        team: p.team || p.nflTeam || 'FA' 
                    };

                    const statusStr = (p.status || 'starter').toUpperCase();

                    rows.push({
                        "Week": weekNum,
                        "Matchup #": mIdx + 1,
                        "Franchise ID": fid,
                        "Team Name": teamName,
                        "Player ID": pid,
                        "Player Name": pInfo.name,
                        "Position": pInfo.position,
                        "NFL Team": pInfo.team,
                        "Lineup Status": statusStr,
                        "Week Score": parseFloat(p.score || 0).toFixed(2),
                        "YTD Points": ytdMap[pid] || ytdMap[unpaddedPid] || '0.00',
                        "Projected Week Score": projMap[pid] || projMap[unpaddedPid] || '0.00'
                    });
                });
            });
        });

        rows.sort((a, b) => {
            if (a["Matchup #"] !== b["Matchup #"]) return a["Matchup #"] - b["Matchup #"];
            if (a["Franchise ID"] !== b["Franchise ID"]) return a["Franchise ID"].localeCompare(b["Franchise ID"]);
            if (a["Lineup Status"] !== b["Lineup Status"]) return a["Lineup Status"] === 'STARTER' ? -1 : 1;
            return parseFloat(b["Week Score"]) - parseFloat(a["Week Score"]);
        });

        return {
            title: `DNFL Weekly Lineup (Week ${weekNum}, ${targetYear})`,
            description: `Player-level detailed scores, starting vs. bench lineup status, native YTD points, and projected week scores across all fantasy matchups for Week ${weekNum}.`,
            columns: ["Week", "Matchup #", "Franchise ID", "Team Name", "Player ID", "Player Name", "Position", "NFL Team", "Lineup Status", "Week Score", "YTD Points", "Projected Week Score"],
            rows: rows
        };
    }

    /* ==========================================================================
       REPORT GENERATOR 5: STANDINGS
       ========================================================================== */
    async function generateStandingsReport() {
        const client = getApiClient();
        await getLeagueInfo();

        const currentWk = parseInt(cachedLeague?.currentWk || 1);
        const lastRegWk = parseInt(cachedLeague?.lastRegularSeasonWeek || 14);
        const maxCompletedWk = Math.min(currentWk, lastRegWk);

        const weeklyPromises = [];
        for (let w = 1; w <= maxCompletedWk; w++) {
            weeklyPromises.push(client.fetchData('weeklyResults', { W: w }).catch(() => null));
        }

        const [standingsData, ...allWeeklyResults] = await Promise.all([
            client.fetchData('leagueStandings', { COLUMN_NAMES: 1, ALL: 1 }),
            ...weeklyPromises
        ]);

        const weeklyPaMap = {};
        const weeklyGameHistory = {};

        allWeeklyResults.forEach((weeklyData, wIdx) => {
            if (!weeklyData?.weeklyResults) return;
            const weekNum = wIdx + 1;
            const rawMatchups = weeklyData.weeklyResults.matchup || weeklyData.weeklyResults.matchUp || weeklyData.weeklyResults.schedule?.matchup;
            let matchups = toArray(rawMatchups);

            if (matchups.length === 0 && weeklyData.weeklyResults.franchise) {
                const fList = toArray(weeklyData.weeklyResults.franchise);
                const processedFids = new Set();
                fList.forEach(f => {
                    const fid = normFranchiseId(f.id);
                    const oppId = normFranchiseId(f.opponent || f.opp || f.vs);
                    if (!processedFids.has(fid)) {
                        processedFids.add(fid);
                        if (oppId) processedFids.add(oppId);
                        const oppObj = fList.find(o => normFranchiseId(o.id) === oppId) || {};
                        matchups.push({ franchise: [f, oppObj] });
                    }
                });
            }

            matchups.forEach(m => {
                const franchises = toArray(m.franchise);
                if (franchises.length >= 2) {
                    const f1 = franchises[0];
                    const f2 = franchises[1];
                    const f1Id = normFranchiseId(f1.id);
                    const f2Id = normFranchiseId(f2.id);
                    const f1Score = parseFloat(f1.score || 0);
                    const f2Score = parseFloat(f2.score || 0);

                    weeklyPaMap[f1Id] = (weeklyPaMap[f1Id] || 0) + f2Score;
                    weeklyPaMap[f2Id] = (weeklyPaMap[f2Id] || 0) + f1Score;

                    if (!weeklyGameHistory[f1Id]) weeklyGameHistory[f1Id] = [];
                    if (!weeklyGameHistory[f2Id]) weeklyGameHistory[f2Id] = [];

                    if (f1Score > f2Score) {
                        weeklyGameHistory[f1Id].push({ week: weekNum, res: 'W' });
                        weeklyGameHistory[f2Id].push({ week: weekNum, res: 'L' });
                    } else if (f2Score > f1Score) {
                        weeklyGameHistory[f1Id].push({ week: weekNum, res: 'L' });
                        weeklyGameHistory[f2Id].push({ week: weekNum, res: 'W' });
                    } else if (f1Score > 0 || f2Score > 0) {
                        weeklyGameHistory[f1Id].push({ week: weekNum, res: 'T' });
                        weeklyGameHistory[f2Id].push({ week: weekNum, res: 'T' });
                    }
                }
            });
        });

        const franchiseStandings = toArray(standingsData?.leagueStandings?.franchise);
        const teamSeedsMap = await calculateTeamSeeds(franchiseStandings);
        const divisions = toArray(cachedLeague?.divisions?.division);
        const conferences = toArray(cachedLeague?.conferences?.conference);

        const divMap = {};
        divisions.forEach(d => divMap[norm(d.id)] = d.name);

        const confMap = {};
        conferences.forEach(c => confMap[norm(c.id)] = c.name);

        const divToConfMap = {};
        divisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

        const franchiseConfDivMap = {};
        cachedFranchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            const divIdNorm = norm(f.division || f.div);
            const confIdNorm = norm(f.conference || f.conf || divToConfMap[divIdNorm]);
            franchiseConfDivMap[fid] = { confId: confIdNorm, divId: divIdNorm };
        });

        const rows = [];

        franchiseStandings.forEach((s, idx) => {
            const fid = normFranchiseId(s.id);
            const teamName = getFranchiseName(fid);
            const ownerName = getFranchiseOwner(fid);

            const structInfo = franchiseConfDivMap[fid] || {};
            const confId = norm(s.conference || s.conf || structInfo.confId);
            const divId = norm(s.division || s.div || structInfo.divId);

            const wins = parseInt(s.h2hw || s.w || 0);
            const losses = parseInt(s.h2hl || s.l || 0);
            const ties = parseInt(s.h2ht || s.t || 0);
            const totalGames = wins + losses + ties;
            const pct = totalGames > 0 ? ((wins + 0.5 * ties) / totalGames).toFixed(3) : '.000';

            const pf = parseFloat(s.pf || s.h2hpf || s.points_for || 0).toFixed(2);
            
            let rawPa = s.pa !== undefined && s.pa !== "0" && s.pa !== 0 ? s.pa : (s.h2hpa || s.points_against || s.opp_pf || s.opp_points || s.pa_pts || s.opp_pts || 0);
            let pa = parseFloat(rawPa).toFixed(2);

            let streak = 'N/A';
            if (s.strk) streak = String(s.strk).toUpperCase();
            else if (s.streak) streak = String(s.streak).toUpperCase();
            else if (s.h2hstrk) streak = String(s.h2hstrk).toUpperCase();
            else if (s.h2h_streak) streak = String(s.h2h_streak).toUpperCase();

            if (parseFloat(pa) === 0 && totalGames > 0 && weeklyPaMap[fid] !== undefined) {
                pa = parseFloat(weeklyPaMap[fid]).toFixed(2);
            }

            if ((streak === 'N/A' || streak === '') && totalGames > 0 && weeklyGameHistory[fid] && weeklyGameHistory[fid].length > 0) {
                const history = weeklyGameHistory[fid];
                const lastRes = history[history.length - 1].res;
                let count = 0;
                for (let i = history.length - 1; i >= 0; i--) {
                    if (history[i].res === lastRes) count++;
                    else break;
                }
                streak = `${lastRes}${count}`;
            }

            rows.push({
                "Seed": teamSeedsMap[fid] !== undefined ? teamSeedsMap[fid] : (idx + 1),
                "Franchise ID": fid,
                "Team Name": teamName,
                "Owner": ownerName,
                "Conference": confMap[confId] || (confId ? `Conference ${confId}` : 'N/A'),
                "Division": divMap[divId] || (divId ? `Division ${divId}` : 'N/A'),
                "Wins": wins,
                "Losses": losses,
                "Ties": ties,
                "Win Pct": pct,
                "Points For (PF)": pf,
                "Points Against (PA)": pa,
                "Streak": streak
            });
        });

        rows.sort((a, b) => (parseInt(a["Seed"]) || 999) - (parseInt(b["Seed"]) || 999));

        return {
            title: `DNFL Standings (${targetYear})`,
            description: `Official season standings, win-loss records, and points for/against.`,
            columns: ["Seed", "Franchise ID", "Team Name", "Owner", "Conference", "Division", "Wins", "Losses", "Ties", "Win Pct", "Points For (PF)", "Points Against (PA)", "Streak"],
            rows: rows
        };
    }

    /* ==========================================================================
       FORMATTERS & EXPORT GENERATORS
       ========================================================================== */
    function formatAsCsv(report) {
        if (window.Papa && typeof window.Papa.unparse === 'function') {
            return window.Papa.unparse({
                fields: report.columns,
                data: report.rows.map(r => report.columns.map(col => r[col]))
            });
        }

        let csv = report.columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
        report.rows.forEach(row => {
            const line = report.columns.map(col => {
                let val = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
                return `"${val.replace(/"/g, '""')}"`;
            }).join(',');
            csv += line + '\n';
        });
        return csv;
    }

    function formatAsJson(report) {
        return JSON.stringify({
            metadata: {
                title: report.title,
                description: report.description,
                season: targetYear,
                leagueId: getLeagueId(),
                generatedAt: new Date().toISOString(),
                rowCount: report.rows.length
            },
            columns: report.columns,
            data: report.rows
        }, null, 2);
    }

    function formatAsMarkdown(report) {
        let md = `# ${report.title}\n`;
        md += `> **Source**: DNFL Exporter | **League ID**: ${getLeagueId()} | **Season**: ${targetYear} | **Generated**: ${new Date().toLocaleString()}\n`;
        md += `> **Description**: ${report.description}\n\n`;

        md += '| ' + report.columns.join(' | ') + ' |\n';
        md += '| ' + report.columns.map(() => '---').join(' | ') + ' |\n';

        report.rows.forEach(row => {
            const values = report.columns.map(col => String(row[col] || '').replace(/\|/g, '\\|'));
            md += '| ' + values.join(' | ') + ' |\n';
        });
        return md;
    }

    /* ==========================================================================
       UI CONTROLLER & EVENT LISTENERS
       ========================================================================== */
    function renderPreviewTable(report) {
        const previewContainer = document.getElementById('dnfl-export-preview-container');
        if (!previewContainer) return;

        let html = `<table class="dnfl-table"><thead><tr>`;
        report.columns.forEach(col => html += `<th>${col}</th>`);
        html += `</tr></thead><tbody>`;

        report.rows.slice(0, 100).forEach(row => {
            html += `<tr>`;
            report.columns.forEach(col => html += `<td>${row[col] !== undefined ? row[col] : ''}</td>`);
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        if (report.rows.length > 100) {
            html += `<div style="padding: 10px; font-size: 0.8rem; color: var(--dnfl-text-subtle, #555555); text-align: center;">Showing preview of first 100 rows (${report.rows.length} total rows in report).</div>`;
        }
        previewContainer.innerHTML = html;
    }

    function renderPreviewText(formattedContent) {
        const previewContainer = document.getElementById('dnfl-export-preview-container');
        if (!previewContainer) return;
        previewContainer.innerHTML = `<textarea id="dnfl-export-text-area" class="dnfl-form-control dnfl-preview-textarea" readonly></textarea>`;
        const textarea = document.getElementById('dnfl-export-text-area');
        if (textarea) textarea.value = formattedContent;
    }

    async function handleGenerateReport() {
        const statusEl = document.getElementById('dnfl-export-status');
        const actionsEl = document.getElementById('dnfl-export-actions');
        const reportSelect = document.getElementById('dnfl-export-report-select');
        const formatSelect = document.getElementById('dnfl-export-format-select');
        const weekSelect = document.getElementById('dnfl-export-week-select');

        if (!statusEl || !reportSelect || !formatSelect) return;

        currentReportType = reportSelect.value;
        currentReportFormat = formatSelect.value;
        currentSelectedWeek = weekSelect ? parseInt(weekSelect.value || '1') : 1;

        statusEl.className = 'dnfl-status-loading';
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching MFL data via DNFL.Client...';
        if (actionsEl) actionsEl.style.display = 'none';

        try {
            if (currentReportType === 'powerRankings') {
                currentReportData = await generatePowerRankingsReport(currentSelectedWeek);
            } else if (currentReportType === 'rosters') {
                currentReportData = await generateRostersReport(currentSelectedWeek);
            } else if (currentReportType === 'matchups') {
                currentReportData = await generateMatchupsReport(currentSelectedWeek);
            } else if (currentReportType === 'weeklyDetails') {
                currentReportData = await generateWeeklyDetailsReport(currentSelectedWeek);
            } else if (currentReportType === 'standings') {
                currentReportData = await generateStandingsReport();
            }

            statusEl.className = '';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Loaded ${currentReportData.rows.length} rows for report: ${currentReportData.title}`;
            if (actionsEl) actionsEl.style.display = 'flex';

            let outputContent = '';
            if (currentReportFormat === 'csv') {
                outputContent = formatAsCsv(currentReportData);
                renderPreviewTable(currentReportData);
            } else if (currentReportFormat === 'json') {
                outputContent = formatAsJson(currentReportData);
                renderPreviewText(outputContent);
            } else {
                outputContent = formatAsMarkdown(currentReportData);
                renderPreviewText(outputContent);
            }
        } catch (err) {
            console.error('[DNFL Exporter Exception]:', err);
            statusEl.className = 'dnfl-status-error';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Error generating report: ${err.message}`;
        }
    }

    function handleCopyClipboard() {
        if (!currentReportData) return;
        let content = currentReportFormat === 'csv' ? formatAsCsv(currentReportData) : (currentReportFormat === 'json' ? formatAsJson(currentReportData) : formatAsMarkdown(currentReportData));
        navigator.clipboard.writeText(content).then(() => {
            const btn = document.getElementById('dnfl-export-copy-btn');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => btn.innerHTML = orig, 2000);
            }
        });
    }

    function handleDownloadFile() {
        if (!currentReportData) return;
        let content = formatAsCsv(currentReportData);
        let ext = 'csv';
        if (currentReportFormat === 'json') { content = formatAsJson(currentReportData); ext = 'json'; }
        else if (currentReportFormat === 'markdown') { content = formatAsMarkdown(currentReportData); ext = 'md'; }

        const filename = `dnfl_${currentReportType}_L${getLeagueId()}_W${currentSelectedWeek}.${ext}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function updateControlVisibility() {
        const reportSelect = document.getElementById('dnfl-export-report-select');
        const weekGroup = document.getElementById('dnfl-export-week-group');
        if (!reportSelect || !weekGroup) return;

        const val = reportSelect.value;
        if (val === 'rosters' || val === 'matchups' || val === 'weeklyDetails' || val === 'powerRankings') {
            weekGroup.style.display = 'flex';
        } else {
            weekGroup.style.display = 'none';
        }
    }

    function populateWeekDropdown() {
        const weekSelect = document.getElementById('dnfl-export-week-select');
        if (!weekSelect) return;

        let maxWeek = 14;
        if (cachedLeague && cachedLeague.lastRegularSeasonWeek) {
            maxWeek = parseInt(cachedLeague.lastRegularSeasonWeek) || 14;
        }

        let currentWk = 1;
        if (cachedLeague && cachedLeague.currentWk) {
            currentWk = parseInt(cachedLeague.currentWk) || 1;
        }

        const currentYearNum = new Date().getFullYear();
        const parsedTargetYear = parseInt(targetYear) || currentYearNum;
        if (parsedTargetYear >= currentYearNum) {
            maxWeek = Math.min(currentWk, maxWeek);
            if (maxWeek < 1) maxWeek = 1;
        }

        weekSelect.innerHTML = '';
        for (let w = 1; w <= maxWeek; w++) {
            const opt = document.createElement('option');
            opt.value = w;
            opt.innerText = `Week ${w}`;
            weekSelect.appendChild(opt);
        }

        weekSelect.value = maxWeek;
    }

    /**
     * Framework Initialization Function
     */
    function init() {
        const container = document.getElementById('dnfl-exporter-container');
        if (!container) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        populateWeekDropdown();
        updateControlVisibility();

        const reportSelect = document.getElementById('dnfl-export-report-select');
        if (reportSelect) reportSelect.addEventListener('change', updateControlVisibility);

        const genBtn = document.getElementById('dnfl-export-generate-btn');
        if (genBtn) genBtn.addEventListener('click', handleGenerateReport);

        const copyBtn = document.getElementById('dnfl-export-copy-btn');
        if (copyBtn) copyBtn.addEventListener('click', handleCopyClipboard);

        const downloadBtn = document.getElementById('dnfl-export-download-btn');
        if (downloadBtn) downloadBtn.addEventListener('click', handleDownloadFile);

        getLeagueInfo().then(() => {
            populateWeekDropdown();
        }).catch(() => {});
    }

    // Export public interface onto window.DNFL namespace (Aligned with dnfl-standings.js)
    window.DNFL.Exporter = {
        init: init,
        generatePowerRankingsReport: generatePowerRankingsReport,
        generateRostersReport: generateRostersReport,
        generateMatchupsReport: generateMatchupsReport,
        generateWeeklyDetailsReport: generateWeeklyDetailsReport,
        generateStandingsReport: generateStandingsReport
    };

    // Event-Driven & DOM Ready Listeners (Aligned 1:1 with dnfl-standings-v3_36.js)
    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
