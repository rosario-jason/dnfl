/* ==========================================================================
   DNFL Commissioner Data Exporter Engine v4.12-TEST-12
   ========================================================================== */

(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    // Standings & Seeding Configuration Cache
    let STANDINGS_RULES = {};
    
    function scale60To100(val, minVal, maxVal) {
        if (maxVal <= minVal) return 80.0;
        const scaled = 60.0 + (40.0 * (val - minVal) / (maxVal - minVal));
        return Math.min(100.0, Math.max(60.0, scaled));
    }

    let FANTASYCALC_MAP = null;

    // Global Context Resolver Variables
    let targetYear = window.current_year || null;
    if (!targetYear && window.location) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear().toString();
    }

    function ensureViewportMeta() {
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0';
            document.head.appendChild(meta);
        }
    }

    function getLeagueId() {
        if (window.DNFL && window.DNFL.Client && typeof window.DNFL.Client.getContext === 'function') {
            return window.DNFL.Client.getContext().leagueId;
        }
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('L') || urlParams.get('l') || window.league_id || window.mflLeagueId || '22883';
    }

    function getApiClient() {
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null);
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("[DNFL Exporter] DNFL.Client API middleware is required but unavailable.");
        }
        return client;
    }

    // State Caches
    let cachedLeague = null;
    let cachedSched = null;
    let cachedFranchises = [];
    let cachedPlayersMap = {};
    let currentReportData = null;
    let currentReportType = 'standings';
    let currentReportFormat = 'csv';
    let currentSelectedWeek = 1;
    let retryCount = 0;
    const maxRetries = 50;

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

    async function getLeagueInfo() {
        if (cachedLeague && cachedLeague.currentWk) return cachedLeague;
        const client = getApiClient();
        try {
            const [leagueData, weeklyData] = await Promise.all([
                client.fetchData('league').catch(() => ({})),
                client.fetchData('weeklyResults').catch(() => ({}))
            ]);
            cachedLeague = leagueData?.league || {};
            cachedFranchises = toArray(cachedLeague?.franchises?.franchise);

            const curWk = weeklyData?.weeklyResults?.week 
                || weeklyData?.weeklyResults?.currentWk
                || (typeof window !== 'undefined' && (window.current_week || window.mflCurrentWk || window.mfl_current_week));
            
            if (curWk) {
                cachedLeague.currentWk = String(curWk);
            }
        } catch (err) {
            console.warn('[DNFL Exporter] Error in getLeagueInfo:', err);
            cachedLeague = cachedLeague || {};
        }
        return cachedLeague;
    }

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

    function getFranchiseName(fid) {
        const normFid = normFranchiseId(fid);
        const f = cachedFranchises.find(item => normFranchiseId(item.id) === normFid);
        return f ? f.name : `Franchise ${normFid}`;
    }

    function getFranchiseOwner(fid) {
        const normFid = normFranchiseId(fid);
        const f = cachedFranchises.find(item => normFranchiseId(item.id) === normFid);
        return f ? (f.owner_name || f.username || 'N/A') : 'N/A';
    }

    

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
        const yr = parseInt(targetYear, 10);
        if (STANDINGS_RULES[yr]) return STANDINGS_RULES[yr];

        for (const key in STANDINGS_RULES) {
            if (key.startsWith('_')) continue;
            if (key.includes('-')) {
                const [start, end] = key.split('-').map(s => parseInt(s.trim(), 10));
                if (yr >= start && yr <= end) return STANDINGS_RULES[key];
            }
            if (key.includes(',')) {
                const yearList = key.split(',').map(s => parseInt(s.trim(), 10));
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

    async function calculateTeamSeeds(franchiseStandings) {
        await loadStandingsRules();
        const baseRules = getYearRules();
        const teamSeeds = {};
        const divLeaders = {};
        const divRunnerUps = {};

        const hasSeasonStarted = franchiseStandings.some(s => {
            const games = parseInt(s.h2hw || 0, 10) + parseInt(s.h2hl || 0, 10) + parseInt(s.h2ht || 0, 10);
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

    async function generateStandingsReport() {
        const client = getApiClient();
        await getLeagueInfo();

        const currentWk = parseInt(cachedLeague?.currentWk || 1, 10);
        const lastRegWk = parseInt(cachedLeague?.lastRegularSeasonWeek || 12, 10);
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

            const wins = parseInt(s.h2hw || s.w || 0, 10);
            const losses = parseInt(s.h2hl || s.l || 0, 10);
            const ties = parseInt(s.h2ht || s.t || 0, 10);
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
                "Franchise Name": teamName,
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

        rows.sort((a, b) => (parseInt(a["Seed"], 10) || 999) - (parseInt(b["Seed"], 10) || 999));

        return {
            title: `DNFL Standings (${targetYear})`,
            description: `Official season standings, win-loss records, and points for/against.`,
            columns: ["Seed", "Franchise ID", "Franchise Name", "Owner", "Conference", "Division", "Wins", "Losses", "Ties", "Win Pct", "Points For (PF)", "Points Against (PA)", "Streak"],
            rows: rows
        };
    }

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
                    "Franchise Name": teamName,
                    "Player ID": pid,
                    "Player Name": pInfo.name,
                    "Position": pInfo.position,
                    "NFL Team": pInfo.team,
                    "Roster Status": p.status || 'ROSTER',
                    "YTD Points": ytdMap[pid] || ytdMap[unpaddedPid] || '0.00'
                });
            });
        });

        rows.sort((a, b) => a["Franchise Name"].localeCompare(b["Team Name"]) || a["Position"].localeCompare(b["Position"]));

        return {
            title: `DNFL Rosters (Week ${weekNum}, ${targetYear})`,
            description: `Complete roster listing across all franchises including native player YTD fantasy points for Week ${weekNum}.`,
            columns: ["Week", "Franchise ID", "Franchise Name", "Player ID", "Player Name", "Position", "NFL Team", "Roster Status", "YTD Points"],
            rows: rows
        };
    }

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
                        "Franchise Name": teamName,
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
       FANTASYCALC DATA ENGINE & ID LOOKUP MAP
       ========================================================================== */

    async function fetchFantasyCalcMap() {
        if (FANTASYCALC_MAP) return FANTASYCALC_MAP;

        const candidateUrls = [
            `https://dnfl.live/dnfl_market/${targetYear || '2026'}/fantasycalc_values.json`,
            'https://dnfl.live/dnfl_market/fantasycalc_values.json'
        ];
        const fcMap = {};

        try {
            const client = getApiClient();
            let rawJson = null;

            for (const url of candidateUrls) {
                try {
                    if (typeof client.fetchRawText === 'function') {
                        rawJson = await client.fetchRawText(url, { ttl: client.TTL ? client.TTL.DAILY : 86400000 }).catch(() => null);
                    }
                    if (!rawJson) {
                        const resp = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now());
                        if (resp.ok) rawJson = await resp.text();
                    }
                    if (rawJson && (rawJson.trim().startsWith('[') || rawJson.trim().startsWith('{'))) {
                        console.log(`[DNFL Exporter] Successfully loaded FantasyCalc feed from ${url}`);
                        break;
                    } else {
                        rawJson = null;
                    }
                } catch (e) {
                    rawJson = null;
                }
            }

            if (rawJson) {
                const data = JSON.parse(rawJson);
                const playerArray = Array.isArray(data) ? data : (data.players || []);

                playerArray.forEach(p => {
                    const pObj = p.player || p;
                    const mflId = pObj.mflId || pObj.mfl_id || p.mflId || p.mfl_id;
                    if (mflId !== undefined && mflId !== null && mflId !== '') {
                        const val = parseInt(p.value || p.tradeValue || pObj.value || pObj.tradeValue || 0, 10);
                        const rawId = String(mflId).trim();
                        const unpaddedId = rawId.replace(/^0+/, '') || '0';
                        const paddedId = unpaddedId.padStart(4, '0');

                        fcMap[rawId] = val;
                        fcMap[unpaddedId] = val;
                        fcMap[paddedId] = val;
                    }
                });
                console.log(`[DNFL Exporter] Ingested FantasyCalc values for ${Object.keys(fcMap).length / 3 | 0} players.`);
            } else {
                console.warn('[DNFL Exporter] FantasyCalc feed returned empty payload.');
            }
        } catch (err) {
            console.warn('[DNFL Exporter] Error fetching FantasyCalc market values:', err);
        }

        FANTASYCALC_MAP = fcMap;
        return FANTASYCALC_MAP;
    }

    async function testFantasyCalcFetch() {
        console.group('[DNFL Exporter] Testing FantasyCalc API Fetch & ID Mapping...');
        try {
            const map = await fetchFantasyCalcMap();
            const totalMapped = Object.keys(map).length;
            console.log(`✓ Total unique MFL players mapped: ${totalMapped / 3 | 0} (${totalMapped} dictionary keys)`);

            // Sample test lookups with real MFL IDs from FantasyCalc feed
            const sampleIds = ['13130', '15281', '15711', '12626', '14802', '99999'];
            sampleIds.forEach(id => {
                console.log(`  - Player MFL ID "${id}": Trade Value = ${map[id] || 0}`);
            });
            console.log('✓ Test complete!');
            console.groupEnd();
            return map;
        } catch (err) {
            console.error('✗ FantasyCalc test failed:', err);
            console.groupEnd();
            throw err;
        }
    }

    /* ==========================================================================
       REPORT GENERATOR 5: AUTOMATED POWER RANKINGS ENGINE v4.12
       ========================================================================== */

    async function generatePowerRankingsReport(targetWeek) {
        const client = getApiClient();
        await getLeagueInfo();
        await getPlayersMap();
        
        const fcMap = await fetchFantasyCalcMap();

        const weekNum = (targetWeek !== undefined && targetWeek !== null && targetWeek !== "") ? parseInt(targetWeek, 10) : 0;
        const totalRegWeeks = parseInt(cachedLeague?.lastRegularSeasonWeek || 12, 10);

        // Check for manual overrides for current year/week
        
        const leagueFranchises = toArray(cachedLeague?.franchises?.franchise);
        const divisions = toArray(cachedLeague?.divisions?.division);
        const conferences = toArray(cachedLeague?.conferences?.conference);

        const confMap = {};
        conferences.forEach(c => confMap[norm(c.id)] = c.name);

        const divMap = {};
        divisions.forEach(d => divMap[norm(d.id)] = d.name);

        const divToConfMap = {};
        divisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

        // 1. Fetch completed weeklyResults up to weekNum in parallel (if weekNum > 0)
        const pastWeeklyPromises = [];
        for (let w = 1; w <= weekNum; w++) {
            pastWeeklyPromises.push(client.fetchData('weeklyResults', { W: w }).catch(() => null));
        }

        // 2. Fetch rosters for the selected week (or current week)
        const rosterWeek = weekNum > 0 ? weekNum : 1;
        const [pastResults, rostersData] = await Promise.all([
            Promise.all(pastWeeklyPromises),
            client.fetchData('rosters', { W: rosterWeek }).catch(() => null)
        ]);

        // Initialize Franchise Accumulators
        const stats = {};
        leagueFranchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            const divIdNorm = norm(f.division || f.div);
            const confIdNorm = norm(f.conference || f.conf || divToConfMap[divIdNorm]);

            const confRaw = confMap[confIdNorm] || '';
            const divRaw = divMap[divIdNorm] || '';
            let confDivStr = 'DNFL';
            if (confRaw && divRaw) {
                confDivStr = `${confRaw} ${divRaw}`;
            } else if (confRaw) {
                confDivStr = confRaw;
            } else if (divRaw) {
                confDivStr = divRaw;
            }

            stats[fid] = {
                fid: fid,
                name: f.name || `Franchise ${fid}`,
                owner: f.owner_name || 'N/A',
                confName: confDivStr,
                wins: 0,
                losses: 0,
                ties: 0,
                pf: 0,
                pa: 0,
                allPlayWins: 0,
                allPlayLosses: 0,
                allPlayTies: 0,
                avgStarterVal: 0,
                avgBenchVal: 0,
                rawRosterVal: 0
            };
        });

        // Process Head-to-Head & All-Play Record up to weekNum
        if (weekNum > 0 && pastResults) {
            pastResults.forEach(wData => {
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
                            if (f1Score > f2Score) stats[f1Id].wins++;
                            else if (f2Score > f1Score) stats[f1Id].losses++;
                            else if (f1Score > 0) stats[f1Id].ties++;
                            weekScoresThisWeek.push({ fid: f1Id, score: f1Score });
                        }

                        if (stats[f2Id]) {
                            stats[f2Id].pf += f2Score;
                            stats[f2Id].pa += f1Score;
                            if (f2Score > f1Score) stats[f2Id].wins++;
                            else if (f1Score > f2Score) stats[f2Id].losses++;
                            else if (f2Score > 0) stats[f2Id].ties++;
                            weekScoresThisWeek.push({ fid: f2Id, score: f2Score });
                        }
                    }
                });

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
        }

        // Process Rosters & Calculate 7 Optimal Starters + Top 7 Bench Trade Values (Ignoring K and DEF)
        const rosterList = toArray(rostersData?.rosters?.franchise);
        rosterList.forEach(f => {
            const fid = normFranchiseId(f.id);
            if (!stats[fid]) return;

            const players = toArray(f.player);
            const eligiblePlayers = [];

            players.forEach(p => {
                const pid = String(p.id).trim();
                const unpaddedPid = pid.replace(/^0+/, '');
                const paddedPid = unpaddedPid.padStart(4, '0');
                const pInfo = cachedPlayersMap[pid] || cachedPlayersMap[unpaddedPid] || cachedPlayersMap[paddedPid] || {};
                const pos = (pInfo.position || p.position || p.pos || '').toUpperCase();

                // 1. Filter OUT Kickers and Defenses completely
                if (pos !== 'K' && pos !== 'PK' && pos !== 'DEF' && pos !== 'ST' && pos !== 'DT' && pos !== 'DE') {
                    const tradeVal = fcMap[pid] || fcMap[unpaddedPid] || fcMap[paddedPid] || 0;
                    eligiblePlayers.push({
                        id: pid,
                        pos: pos,
                        tradeVal: tradeVal
                    });
                }
            });

            // 2. Greedily select top 7 starters: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX
            const qbs = eligiblePlayers.filter(p => p.pos === 'QB').sort((a, b) => b.tradeVal - a.tradeVal);
            const rbs = eligiblePlayers.filter(p => p.pos === 'RB').sort((a, b) => b.tradeVal - a.tradeVal);
            const wrs = eligiblePlayers.filter(p => p.pos === 'WR').sort((a, b) => b.tradeVal - a.tradeVal);
            const tes = eligiblePlayers.filter(p => p.pos === 'TE').sort((a, b) => b.tradeVal - a.tradeVal);

            const selectedStarters = [];
            const remainingPool = [];

            if (qbs.length > 0) selectedStarters.push(qbs[0]);
            remainingPool.push(...qbs.slice(1));

            if (rbs.length > 0) selectedStarters.push(rbs[0]);
            if (rbs.length > 1) selectedStarters.push(rbs[1]);
            remainingPool.push(...rbs.slice(2));

            if (wrs.length > 0) selectedStarters.push(wrs[0]);
            if (wrs.length > 1) selectedStarters.push(wrs[1]);
            remainingPool.push(...wrs.slice(2));

            if (tes.length > 0) selectedStarters.push(tes[0]);
            remainingPool.push(...tes.slice(1));

            // FLEX Slot (highest remaining RB, WR, or TE)
            remainingPool.sort((a, b) => b.tradeVal - a.tradeVal);
            if (remainingPool.length > 0) {
                selectedStarters.push(remainingPool[0]);
            }

            const starterIds = new Set(selectedStarters.map(s => s.id));
            const benchPool = eligiblePlayers.filter(p => !starterIds.has(p.id)).sort((a, b) => b.tradeVal - a.tradeVal);

            // Select top 7 bench players (or pad with 0 if fewer than 7 remain)
            const top7Bench = benchPool.slice(0, 7);

            const starterValSum = selectedStarters.reduce((acc, p) => acc + p.tradeVal, 0);
            const benchValSum = top7Bench.reduce((acc, p) => acc + p.tradeVal, 0);

            // Always divide by 7 to preserve depth denominator
            const avgStarterVal = starterValSum / 7.0;
            const avgBenchVal = benchValSum / 7.0;
            const rawRosterVal = (avgStarterVal * 0.70) + (avgBenchVal * 0.30);

            stats[fid].avgStarterVal = avgStarterVal;
            stats[fid].avgBenchVal = avgBenchVal;
            stats[fid].rawRosterVal = rawRosterVal;
        });

        const statList = Object.values(stats);

        // Step 1: Compute Sub-Indices using True Min-Max 60-100 Scaling
        const starterVals = statList.map(s => s.avgStarterVal);
        const minStarterVal = Math.min(...starterVals);
        const maxStarterVal = Math.max(...starterVals);

        const benchVals = statList.map(s => s.avgBenchVal);
        const minBenchVal = Math.min(...benchVals);
        const maxBenchVal = Math.max(...benchVals);

        const pfVals = statList.map(s => s.pf);
        const minPf = Math.min(...pfVals);
        const maxPf = Math.max(...pfVals);

        statList.forEach(s => {
            // Starter & Bench Sub-Indices (60-100)
            s.starterIndex = scale60To100(s.avgStarterVal, minStarterVal, maxStarterVal);
            s.benchIndex = scale60To100(s.avgBenchVal, minBenchVal, maxBenchVal);

            // Roster Value Index (70% Starters / 30% Bench)
            s.rosterIndex = (s.starterIndex * 0.70) + (s.benchIndex * 0.30);

            // Performance Metrics
            const totalGames = s.wins + s.losses + s.ties;
            s.h2hPctVal = totalGames > 0 ? (s.wins + 0.5 * s.ties) / totalGames : 0.0;

            const totalAllPlay = s.allPlayWins + s.allPlayLosses + s.allPlayTies;
            s.allPlayPctVal = totalAllPlay > 0 ? (s.allPlayWins + 0.5 * s.allPlayTies) / totalAllPlay : 0.0;
        });

        // Performance Sub-Indices across league (60-100)
        const h2hVals = statList.map(s => s.h2hPctVal);
        const minH2h = Math.min(...h2hVals);
        const maxH2h = Math.max(...h2hVals);

        const allPlayVals = statList.map(s => s.allPlayPctVal);
        const minAllPlay = Math.min(...allPlayVals);
        const maxAllPlay = Math.max(...allPlayVals);

        statList.forEach(s => {
            s.pfScore = scale60To100(s.pf, minPf, maxPf);
            s.h2hScore = scale60To100(s.h2hPctVal, minH2h, maxH2h);
            s.allPlayScore = scale60To100(s.allPlayPctVal, minAllPlay, maxAllPlay);

            // Composite Performance Index (40% PF, 20% H2H, 40% All-Play)
            const totalGames = s.wins + s.losses + s.ties;
            if (weekNum === 0 || totalGames === 0) {
                s.perfIndex = 60.0;
            } else {
                s.perfIndex = (s.pfScore * 0.40) + (s.h2hScore * 0.20) + (s.allPlayScore * 0.40);
            }
        });

        // Step 2: Dynamic Season Weighting
        const perfWeight = Math.min(1.0, Math.max(0.0, weekNum / totalRegWeeks));
        const rosterWeight = 1.0 - perfWeight;

        // Step 3: Compute Final Power Rating Index
        statList.forEach(s => {
            if (weekNum === 0) {
                s.calculatedIndex = parseFloat(s.rosterIndex.toFixed(1));
            } else {
                const blended = (s.perfIndex * perfWeight) + (s.rosterIndex * rosterWeight);
                s.calculatedIndex = parseFloat(blended.toFixed(1));
            }
            s.finalIndex = s.calculatedIndex.toFixed(1);
            s.comment = '';
        });

        // Sort by Power Index descending
        statList.sort((a, b) => parseFloat(b.finalIndex) - parseFloat(a.finalIndex));

        // Format Output Rows
        const rows = statList.map((s, idx) => {
            const rank = idx + 1;
            const allPlayStr = `${s.allPlayWins}-${s.allPlayLosses}${s.allPlayTies > 0 ? '-' + s.allPlayTies : ''}`;
            const h2hStr = `${s.wins}-${s.losses}${s.ties > 0 ? '-' + s.ties : ''}`;

            return {
                "Rank": rank,
                "Franchise ID": s.fid,
                "Franchise Name": s.name,
                "Owner": s.owner,
                "Conference": s.confName,
                "Points For": s.pf.toFixed(2),
                "H2H Record": h2hStr,
                "H2H %": (s.h2hPctVal * 100).toFixed(1) + '%',
                "All-Play Record": allPlayStr,
                "All-Play %": (s.allPlayPctVal * 100).toFixed(1) + '%',
                "Performance Index": s.perfIndex.toFixed(1),
                "Starter Value": s.avgStarterVal.toFixed(1),
                "Starter Index": s.starterIndex.toFixed(1),
                "Bench Value": s.avgBenchVal.toFixed(1),
                "Bench Index": s.benchIndex.toFixed(1),
                "Roster Value Index": s.rosterIndex.toFixed(1),
                "Power Index": s.finalIndex,
                "Rank Comments": s.comment || ''
            };
        });

        return {
            title: `DNFL Power Rankings Data (${weekNum === 0 ? "Pre-Season" : "Week " + weekNum}, ${targetYear})`,
            description: `FantasyCalc Trade Value (7 Starters / Top 7 Bench) + MFL Realized Performance (${(perfWeight * 100).toFixed(1)}% Perf / ${(rosterWeight * 100).toFixed(1)}% Roster Value at Week ${weekNum} of ${totalRegWeeks}).`,
            columns: ["Rank", "Franchise ID", "Franchise Name", "Owner", "Conference", "Points For", "H2H Record", "H2H %", "All-Play Record", "All-Play %", "Performance Index", "Starter Value", "Starter Index", "Bench Value", "Bench Index", "Roster Value Index", "Power Index", "Rank Comments"],
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
        let md = `# ${report.title}
`;
        md += `> **Source**: DNFL Exporter | **League ID**: ${getLeagueId()} | **Season**: ${targetYear} | **Generated**: ${new Date().toLocaleString()}
`;
        md += `> **Description**: ${report.description}

`;

        md += '| ' + report.columns.join(' | ') + ' |\n';
        md += '| ' + report.columns.map(() => '---').join(' | ') + ' |\n';

        report.rows.forEach(row => {
            const values = report.columns.map(col => String(row[col] || '').replace(/\|/g, '\|'));
            md += '| ' + values.join(' | ') + ' |\n';
        });
        return md;
    }

    function resetExportState() {
        currentReportData = null;
        const statusEl = document.getElementById('dnfl-export-status');
        const actionsEl = document.getElementById('dnfl-export-actions');
        const previewContainer = document.getElementById('dnfl-export-preview-container');

        if (statusEl) {
            statusEl.className = 'dnfl-status-loading';
            statusEl.innerHTML = 'Select report options above and click Generate.';
        }
        if (actionsEl) {
            actionsEl.classList.add('dnfl-is-hidden');
        }
        if (previewContainer) {
            previewContainer.innerHTML = '';
        }
    }

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
            html += `<div class="dnfl-disclaimer-note">Showing preview of first 100 rows (${report.rows.length} total rows in report).</div>`;
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
        currentSelectedWeek = weekSelect ? parseInt(weekSelect.value || '1', 10) : 1;

        statusEl.className = 'dnfl-status-loading';
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching MFL data via DNFL.Client...';
        if (actionsEl) actionsEl.classList.add('dnfl-is-hidden');

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

            statusEl.className = 'dnfl-status-success';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Loaded ${currentReportData.rows.length} rows for report: ${currentReportData.title}`;
            
            if (actionsEl) actionsEl.classList.remove('dnfl-is-hidden');

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
        const requiresWeek = (val === 'rosters' || val === 'matchups' || val === 'weeklyDetails' || val === 'powerRankings');

        weekGroup.classList.toggle('dnfl-is-hidden', !requiresWeek);
    }

    let userHasSelectedWeek = false;

    function resolveCurrentWeek() {
        const rawWk = (cachedLeague && (cachedLeague.currentWk || cachedLeague.current_week))
            || (window.DNFL && window.DNFL.leagueMetadata && window.DNFL.leagueMetadata.currentWk)
            || (cachedSched && (cachedSched.currentWk || cachedSched.current_week || cachedSched.week))
            || (typeof window !== 'undefined' && (window.current_week || window.mflCurrentWk || window.mfl_current_week));
        if (rawWk) {
            const w = parseInt(rawWk, 10);
            if (!isNaN(w) && w > 0) return w;
        }
        return null;
    }

    function populateWeekDropdown() {
        const weekSelect = document.getElementById('dnfl-export-week-select');
        if (!weekSelect) return;

        const reportSelect = document.getElementById('dnfl-export-report-select');
        const currentReport = reportSelect ? reportSelect.value : 'standings';
        const allowPreseason = (currentReport === 'powerRankings');

        let lastRegWk = 12;
        if (cachedLeague && cachedLeague.lastRegularSeasonWeek) {
            lastRegWk = parseInt(cachedLeague.lastRegularSeasonWeek, 10) || 12;
        } else if (window.DNFL && window.DNFL.leagueMetadata && window.DNFL.leagueMetadata.lastRegularSeasonWeek) {
            lastRegWk = parseInt(window.DNFL.leagueMetadata.lastRegularSeasonWeek, 10) || 12;
        }

        const detectedWk = resolveCurrentWeek();
        let maxWeek = lastRegWk;

        const currentYearNum = new Date().getFullYear();
        const parsedTargetYear = parseInt(targetYear, 10) || currentYearNum;

        if (parsedTargetYear >= currentYearNum) {
            if (detectedWk !== null) {
                maxWeek = Math.min(detectedWk, lastRegWk);
            } else {
                maxWeek = 1;
            }
        } else {
            maxWeek = lastRegWk;
        }

        if (maxWeek < 1) maxWeek = 1;

        const prevVal = weekSelect.value;
        weekSelect.innerHTML = '';

        const startWk = allowPreseason ? 0 : 1;
        for (let w = startWk; w <= maxWeek; w++) {
            const opt = document.createElement('option');
            opt.value = String(w);
            opt.innerText = w === 0 ? 'Pre-Season (Week 0)' : `Week ${w}`;
            weekSelect.appendChild(opt);
        }

        // Auto-select detected current week or fallback cleanly
        if (!allowPreseason && prevVal === '0') {
            if (detectedWk !== null && detectedWk >= 1 && detectedWk <= maxWeek) {
                weekSelect.value = String(detectedWk);
            } else {
                weekSelect.value = '1';
            }
        } else if (userHasSelectedWeek && prevVal && parseInt(prevVal, 10) <= maxWeek && (prevVal !== '0' || allowPreseason)) {
            weekSelect.value = prevVal;
        } else if (detectedWk !== null && detectedWk <= maxWeek && (detectedWk !== 0 || allowPreseason)) {
            weekSelect.value = String(detectedWk);
        } else {
            weekSelect.value = allowPreseason ? '0' : '1';
        }
    }

    function init() {
        ensureViewportMeta();

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
        if (reportSelect) {
            reportSelect.addEventListener('change', () => {
                updateControlVisibility();
                populateWeekDropdown();
                resetExportState();
            });
        }

        const weekSelect = document.getElementById('dnfl-export-week-select');
        if (weekSelect) {
            weekSelect.addEventListener('change', () => {
                userHasSelectedWeek = true;
                resetExportState();
            });
        }

        const formatSelect = document.getElementById('dnfl-export-format-select');
        if (formatSelect) {
            formatSelect.addEventListener('change', resetExportState);
        }

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

    window.DNFL.Exporter = {
        init: init,
        fetchFantasyCalcMap: fetchFantasyCalcMap,
        testFantasyCalcFetch: testFantasyCalcFetch,
        generatePowerRankingsReport: generatePowerRankingsReport,
        generateRostersReport: generateRostersReport,
        generateMatchupsReport: generateMatchupsReport,
        generateWeeklyDetailsReport: generateWeeklyDetailsReport,
        generateStandingsReport: generateStandingsReport
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
