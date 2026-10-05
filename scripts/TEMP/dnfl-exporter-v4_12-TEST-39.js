/* ==========================================================================
   DNFL Commissioner Data Exporter Engine v4.12-TEST-34
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

    let leagueInfoPromise = null;

    async function getLeagueInfo() {
        if (cachedLeague && cachedLeague.currentWk) return cachedLeague;
        if (leagueInfoPromise) return leagueInfoPromise;

        leagueInfoPromise = (async () => {
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
        })();

        return leagueInfoPromise;
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
                        const resp = await fetch(url);
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

        const leagueFranchises = toArray(cachedLeague?.franchises?.franchise);
        const divisions = toArray(cachedLeague?.divisions?.division);
        const conferences = toArray(cachedLeague?.conferences?.conference);

        const confMap = {};
        conferences.forEach(c => confMap[norm(c.id)] = c.name);

        const divMap = {};
        divisions.forEach(d => divMap[norm(d.id)] = d.name);

        const divToConfMap = {};
        divisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

        const pastWeeklyPromises = [];
        for (let w = 1; w <= weekNum; w++) {
            pastWeeklyPromises.push(client.fetchData('weeklyResults', { W: w }).catch(() => null));
        }

        const rosterWeek = weekNum > 0 ? weekNum : 1;
        const [pastResults, rostersData] = await Promise.all([
            Promise.all(pastWeeklyPromises),
            client.fetchData('rosters', { W: rosterWeek }).catch(() => null)
        ]);

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

                if (pos !== 'K' && pos !== 'PK' && pos !== 'DEF' && pos !== 'ST' && pos !== 'DT' && pos !== 'DE') {
                    const tradeVal = fcMap[pid] || fcMap[unpaddedPid] || fcMap[paddedPid] || 0;
                    eligiblePlayers.push({
                        id: pid,
                        pos: pos,
                        tradeVal: tradeVal
                    });
                }
            });

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

            remainingPool.sort((a, b) => b.tradeVal - a.tradeVal);
            if (remainingPool.length > 0) {
                selectedStarters.push(remainingPool[0]);
            }

            const starterIds = new Set(selectedStarters.map(s => s.id));
            const benchPool = eligiblePlayers.filter(p => !starterIds.has(p.id)).sort((a, b) => b.tradeVal - a.tradeVal);
            const top7Bench = benchPool.slice(0, 7);

            const starterValSum = selectedStarters.reduce((acc, p) => acc + p.tradeVal, 0);
            const benchValSum = top7Bench.reduce((acc, p) => acc + p.tradeVal, 0);

            const avgStarterVal = starterValSum / 7.0;
            const avgBenchVal = benchValSum / 7.0;
            const rawRosterVal = (avgStarterVal * 0.70) + (avgBenchVal * 0.30);

            stats[fid].avgStarterVal = avgStarterVal;
            stats[fid].avgBenchVal = avgBenchVal;
            stats[fid].rawRosterVal = rawRosterVal;
        });

        const statList = Object.values(stats);

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
            s.starterIndex = scale60To100(s.avgStarterVal, minStarterVal, maxStarterVal);
            s.benchIndex = scale60To100(s.avgBenchVal, minBenchVal, maxBenchVal);
            s.rosterIndex = (s.starterIndex * 0.70) + (s.benchIndex * 0.30);

            const totalGames = s.wins + s.losses + s.ties;
            s.h2hPctVal = totalGames > 0 ? (s.wins + 0.5 * s.ties) / totalGames : 0.0;

            const totalAllPlay = s.allPlayWins + s.allPlayLosses + s.allPlayTies;
            s.allPlayPctVal = totalAllPlay > 0 ? (s.allPlayWins + 0.5 * s.allPlayTies) / totalAllPlay : 0.0;
        });

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

            const totalGames = s.wins + s.losses + s.ties;
            if (weekNum === 0 || totalGames === 0) {
                s.perfIndex = 60.0;
            } else {
                s.perfIndex = (s.pfScore * 0.40) + (s.h2hScore * 0.20) + (s.allPlayScore * 0.40);
            }
        });

        const perfWeight = Math.min(1.0, Math.max(0.0, weekNum / totalRegWeeks));
        const rosterWeight = 1.0 - perfWeight;

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

        statList.sort((a, b) => parseFloat(b.finalIndex) - parseFloat(a.finalIndex));

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
       REPORT GENERATOR 6: PUBLISHED POWER RANKINGS ENGINE
       ========================================================================== */

    let cachedPublishedWeeks = null;

    async function fetchPublishedWeeks() {
        if (cachedPublishedWeeks) return cachedPublishedWeeks;
        const client = getApiClient();
        const urls = [
            `https://dnfl.live/dnfl_rankings/${targetYear}/weeks.json`,
            `https://dnfl.live/dnfl_rankings/weeks.json`,
            `/dnfl_rankings/${targetYear}/weeks.json`,
            `/dnfl_rankings/weeks.json`
        ];

        for (const url of urls) {
            try {
                let text = null;
                if (client && typeof client.fetchRawText === 'function') {
                    text = await client.fetchRawText(url, { ttl: 86400000 }).catch(() => null);
                }
                if (!text) {
                    const resp = await fetch(url);
                    if (resp.ok) text = await resp.text();
                }
                if (text) {
                    const parsed = JSON.parse(text);
                    const list = Array.isArray(parsed) ? parsed : (parsed.weeks || []);
                    if (list.length > 0) {
                        cachedPublishedWeeks = list.map((w, idx) => {
                            const rawId = String(w.id || idx).trim();
                            let displayLabel = w.display || w.label || w.name || rawId;
                            if (rawId === '00' || rawId.includes('00') || rawId.includes('pre-season')) {
                                displayLabel = 'Pre-Season';
                            } else if (/^\d+$/.test(rawId)) {
                                displayLabel = `Week ${parseInt(rawId, 10)}`;
                            }
                            const filename = w.file || (rawId.includes('data') ? rawId : (rawId.includes('pre-season') ? 'data_00_pre-season.csv' : `data_${rawId.padStart(2, '0')}.csv`));
                            return {
                                id: rawId,
                                display: displayLabel,
                                file: filename,
                                weekNum: rawId.includes('pre-season') || rawId === '00' ? 0 : (parseInt(rawId.replace(/\D/g, ''), 10) || 0)
                            };
                        });
                        return cachedPublishedWeeks;
                    }
                }
            } catch (e) {}
        }

        cachedPublishedWeeks = [
            { id: "00_pre-season", display: "Pre-Season", file: "data_00_pre-season.csv", weekNum: 0 },
            { id: "01", display: "Week 1", file: "data_01.csv", weekNum: 1 },
            { id: "02", display: "Week 2", file: "data_02.csv", weekNum: 2 }
        ];
        return cachedPublishedWeeks;
    }

    async function fetchRankingCsv(fileOrId, weekNum) {
        const client = getApiClient();
        let cleanFile = String(fileOrId || '').trim();
        
        const candidateFiles = [];
        if (cleanFile) {
            candidateFiles.push(cleanFile);
            if (!cleanFile.endsWith('.csv')) {
                candidateFiles.push(cleanFile + '.csv');
            }
        }

        const wkVal = (weekNum !== undefined && weekNum !== null) ? parseInt(weekNum, 10) : (parseInt(cleanFile.replace(/\D/g, ''), 10) || 0);
        const padWk = String(wkVal).padStart(2, '0');

        if (wkVal === 0 || cleanFile.includes('pre-season')) {
            candidateFiles.push('data_00_pre-season.csv', 'data_00.csv', 'rankings_week_0.csv', 'data_pre-season.csv');
        } else {
            candidateFiles.push(`data_${padWk}.csv`, `data_${wkVal}.csv`, `rankings_week_${wkVal}.csv`, `rankings_week_${padWk}.csv`);
        }

        const uniqueFiles = [...new Set(candidateFiles)];

        for (const filename of uniqueFiles) {
            const urls = [
                `https://dnfl.live/dnfl_rankings/${targetYear}/${filename}`,
                `https://dnfl.live/dnfl_rankings/${filename}`,
                `https://raw.githubusercontent.com/rosario-jason/dnfl/main/dnfl_rankings/${targetYear}/${filename}`,
                `/dnfl_rankings/${targetYear}/${filename}`,
                `/dnfl_rankings/${filename}`
            ];

            for (const url of urls) {
                try {
                    let text = null;
                    if (client && typeof client.fetchRawText === 'function') {
                        text = await client.fetchRawText(url, { ttl: 86400000 }).catch(() => null);
                    }
                    if (!text) {
                        const resp = await fetch(url);
                        if (resp.ok) text = await resp.text();
                    }
                    if (text && text.includes(',')) {
                        return text;
                    }
                } catch (e) {}
            }
        }
        return null;
    }

    async function generatePublishedPowerRankingsReport(targetWeek) {
        const client = getApiClient();
        await getLeagueInfo();
        await getPlayersMap();

        const weeksList = await fetchPublishedWeeks();
        let selItem = null;
        let selIndex = -1;

        if (typeof targetWeek === 'string' && isNaN(parseInt(targetWeek, 10))) {
            selIndex = weeksList.findIndex(w => w.id === targetWeek || w.file === targetWeek);
        } else {
            const targetNum = parseInt(targetWeek, 10) || 0;
            selIndex = weeksList.findIndex(w => w.weekNum === targetNum);
        }

        if (selIndex === -1 && weeksList.length > 0) {
            selIndex = weeksList.length - 1;
        }

        selItem = weeksList[selIndex] || weeksList[weeksList.length - 1];
        const weekNum = selItem ? selItem.weekNum : 0;
        const isPreseason = weekNum === 0 || (selItem && selItem.id.includes('pre-season'));

        const prevItem = (!isPreseason && selIndex > 0) ? weeksList[selIndex - 1] : null;

        const [currCsvText, prevCsvText, standingsData] = await Promise.all([
            fetchRankingCsv(selItem.file || selItem.id, weekNum),
            prevItem ? fetchRankingCsv(prevItem.file || prevItem.id, prevItem.weekNum) : Promise.resolve(null),
            (!isPreseason && client) ? client.fetchData('leagueStandings', { W: weekNum, COLUMN_NAMES: 1, ALL: 1 }).catch(() => null) : Promise.resolve(null)
        ]);

        const standingsMap = {};
        if (standingsData?.leagueStandings) {
            const ls = standingsData.leagueStandings;
            const raw = ls.franchise || (ls.franchises ? ls.franchises.franchise : null);
            const fList = toArray(raw);
            fList.forEach(f => {
                const fid = normFranchiseId(f.id);
                const wins = parseInt(f.h2hw !== undefined ? f.h2hw : (f.wins || f.w || 0), 10);
                const losses = parseInt(f.h2hl !== undefined ? f.h2hl : (f.losses || f.l || 0), 10);
                const ties = parseInt(f.h2ht !== undefined ? f.h2ht : (f.ties || f.t || 0), 10);
                const rec = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
                const rawPf = parseFloat(f.pf !== undefined ? f.pf : (f.points || f.pts || 0));
                const pfStr = isNaN(rawPf) ? '0.00' : rawPf.toFixed(2);
                standingsMap[fid] = { record: rec, pf: pfStr };
            });
        }

        const prevRankMap = {};
        if (prevCsvText && window.Papa) {
            try {
                const prevParsed = (window.Papa || Papa).parse(prevCsvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
                prevParsed.data.forEach(r => {
                    const fid = normFranchiseId(r['Franchise ID'] || r['FranchiseId'] || r['TeamID'] || r['id']);
                    const rk = parseInt(r['Rank'] || 0, 10);
                    if (fid && rk > 0) prevRankMap[fid] = rk;
                });
            } catch (e) {}
        }

        if (!currCsvText) {
            throw new Error(`Published power rankings dataset for ${selItem ? selItem.display : 'Week ' + targetWeek} is not available.`);
        }

        if (!window.Papa && typeof Papa === "undefined") {
            throw new Error("PapaParse library is required to parse power rankings CSV.");
        }

        const parsed = (window.Papa || Papa).parse(currCsvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
        const rows = [];

        parsed.data.forEach(row => {
            const fid = normFranchiseId(row['Franchise ID'] || row['FranchiseId'] || row['TeamID'] || row['id']);
            if (!fid) return;

            const currentRank = parseInt(row['Rank'] || 0, 10);
            const powerIndexNum = parseFloat(row['Power Index'] || row['PowerIndex'] || row['power_index'] || 0);
            const powerIndexStr = isNaN(powerIndexNum) ? '0.0' : powerIndexNum.toFixed(1);

            const franchiseName = getFranchiseName(fid);

            let changeStr = '--';
            if (!isPreseason && prevRankMap[fid]) {
                const diff = prevRankMap[fid] - currentRank;
                if (diff > 0) changeStr = `+${diff}`;
                else if (diff < 0) changeStr = `${diff}`;
                else changeStr = '--';
            }

            let recordStr = '0-0';
            let pfStr = '0.00';

            if (isPreseason) {
                recordStr = String(row['Projected W-L'] || row['Projected Record'] || '0-0').trim();
                pfStr = '0.00';
            } else {
                const mflSt = standingsMap[fid] || {};
                recordStr = mflSt.record || '0-0';
                pfStr = mflSt.pf || '0.00';
            }

            const commentsStr = String(row['Rank Comments'] || row['Comments'] || row['Commentary'] || '').trim();

            rows.push({
                "Rank": currentRank,
                "Change": changeStr,
                "Franchise": franchiseName,
                "Power Index": powerIndexStr,
                "Record": recordStr,
                "Points For": pfStr,
                "Comments": commentsStr
            });
        });

        rows.sort((a, b) => a["Rank"] - b["Rank"]);

        const titleWeekStr = selItem ? selItem.display : (isPreseason ? 'Pre-Season' : `Week ${weekNum}`);

        return {
            title: `DNFL Published Power Rankings (${titleWeekStr}, ${targetYear})`,
            description: `Official published power rankings with live API team names, standings, and points for ${titleWeekStr}.`,
            columns: ["Rank", "Change", "Franchise", "Power Index", "Record", "Points For", "Comments"],
            rows: rows
        };
    }

    /* ==========================================================================
       REPORT GENERATOR 7: LEAGUE TRANSACTIONS ENGINE v4.12
       ========================================================================== */

    async function generateTransactionsReport(week) {
        const client = getApiClient();
        await getLeagueInfo();
        const playersMap = await getPlayersMap();
        const weekNum = (week !== undefined && week !== null && String(week).trim() !== "") ? parseInt(week, 10) : 0;

        const queryParams = { TRANS_TYPE: 'DEFAULT' };
        if (weekNum > 0) {
            queryParams.W = weekNum;
        }
        const transData = await client.fetchData('transactions', queryParams).catch(() => null);

        const rawTransactions = toArray(transData?.transactions?.transaction);
        const rows = [];

        function isPlayerId(token) {
            if (!token) return false;
            const clean = String(token).trim();
            if (!clean) return false;
            const unpadded = clean.replace(/^0+/, '');
            const padded = unpadded.padStart(4, '0');
            if (playersMap[clean] || playersMap[unpadded] || playersMap[padded]) {
                return true;
            }
            if (/^\d+$/.test(clean) && clean.length >= 4 && parseInt(clean, 10) >= 100) {
                return true;
            }
            return false;
        }

        function formatPlayerById(pid) {
            const cleanPid = String(pid).trim();
            if (!cleanPid) return '';
            const unpadded = cleanPid.replace(/^0+/, '');
            const padded = unpadded.padStart(4, '0');
            const pInfo = playersMap[cleanPid] || playersMap[unpadded] || playersMap[padded];
            if (pInfo && pInfo.name) {
                const posStr = pInfo.position && pInfo.position !== 'N/A' ? ' (' + pInfo.position + (pInfo.team && pInfo.team !== 'FA' ? ' - ' + pInfo.team : '') + ')' : '';
                return pInfo.name + posStr;
            }
            return 'Player ' + cleanPid;
        }

        function formatTransactionType(rawType) {
            if (!rawType) return 'Transaction';
            const t = String(rawType).trim().toUpperCase();
            if (t === 'FREE_AGENT' || t === 'ADD_DROP') return 'Add/Drop';
            if (t === 'BBID_WAIVER' || t === 'WAIVER') return 'Waiver';
            if (t === 'TRADE') return 'Trade';
            if (t === 'DROPPED' || t === 'DROP') return 'Dropped';
            if (t === 'IR') return 'IR';
            if (t === 'TAXI') return 'Taxi';
            if (t === 'COMMISH') return 'Commish';
            return t.charAt(0) + t.slice(1).toLowerCase();
        }

        function formatTimestamp(ts) {
            if (!ts) return 'N/A';
            const sec = parseInt(ts, 10);
            if (isNaN(sec)) return String(ts);
            const d = new Date(sec * 1000);
            return d.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                year: 'numeric'
            });
        }

        rawTransactions.forEach((t) => {
            let franchiseStr = '';
            if (t.franchise_name || t.franchisename) {
                franchiseStr = t.franchise_name || t.franchisename;
            } else if (t.franchise) {
                const fids = String(t.franchise).split(',').map(s => s.trim()).filter(Boolean);
                franchiseStr = fids.map(fid => getFranchiseName(fid)).join(' / ');
            } else {
                franchiseStr = 'League / All Franchises';
            }

            const typeStr = formatTransactionType(t.type);

            let detailStr = '';
            if (t.description || t.details) {
                detailStr = String(t.description || t.details).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
            } else if (t.transaction) {
                const rawDetails = String(t.transaction).trim();
                if (rawDetails.includes('|') || /^\d[\d,\s|.]*$/.test(rawDetails)) {
                    const parts = rawDetails.split('|').map(s => s.trim());
                    const addedPids = [];
                    const droppedPids = [];
                    let bidVal = t.bid || t.amount || t.bbid || null;

                    parts.forEach((part, pIdx) => {
                        if (!part) return;
                        const tokens = part.split(',').map(s => s.trim()).filter(Boolean);
                        tokens.forEach(tok => {
                            if (isPlayerId(tok)) {
                                if (pIdx === 0 && typeStr !== 'Dropped') {
                                    addedPids.push(tok);
                                } else {
                                    droppedPids.push(tok);
                                }
                            } else if (/^\d+(\.\d+)?$/.test(tok)) {
                                bidVal = tok;
                            }
                        });
                    });

                    const actionParts = [];
                    if (addedPids.length > 0) {
                        let addedText = 'Acquired ' + addedPids.map(formatPlayerById).join(', ');
                        if (bidVal !== null && bidVal !== undefined && String(bidVal).trim() !== '') {
                            const numericBid = parseFloat(bidVal);
                            const formattedBid = isNaN(numericBid) ? String(bidVal) : numericBid.toFixed(2);
                            addedText += ' for $' + formattedBid;
                        } else if (typeStr === 'Waiver') {
                            addedText += ' for $0.00';
                        }
                        actionParts.push(addedText);
                    }
                    if (droppedPids.length > 0) {
                        actionParts.push('Dropped ' + droppedPids.map(formatPlayerById).join(', '));
                    }

                    detailStr = actionParts.join(' | ') || rawDetails;
                } else {
                    detailStr = rawDetails.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                }
            } else {
                detailStr = 'N/A';
            }

            const rawTs = parseInt(t.timestamp || 0, 10);

            rows.push({
                "#": 0,
                "Franchise": franchiseStr,
                "Type": typeStr,
                "Transaction": detailStr,
                "Date": formatTimestamp(t.timestamp),
                _rawTimestamp: rawTs
            });
        });

        rows.sort((a, b) => b._rawTimestamp - a._rawTimestamp);

        rows.forEach((r, idx) => {
            r["#"] = idx + 1;
            delete r._rawTimestamp;
        });

        const reportTitleWeek = weekNum > 0 ? 'Week ' + weekNum : 'Full Season';

        return {
            title: 'DNFL League Transactions (' + reportTitleWeek + ', ' + targetYear + ')',
            description: 'Official league transaction log including waivers, trades, free agent add/drops, and roster moves for ' + reportTitleWeek + '.',
            columns: ["#", "Franchise", "Type", "Transaction", "Date"],
            rows: rows
        };
    }

    /* ==========================================================================
       REPORT GENERATOR 8: OFFICIAL LEAGUE RULES ENGINE v4.12
       ========================================================================== */

    
    /**
     * Async Loader for html2pdf.js Library
     */
    function ensureHtml2PdfLoaded() {
        if (window.html2pdf) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load PDF generation engine (html2pdf.js).'));
            document.head.appendChild(script);
        });
    }

    /**
     * Convert Markdown Rulebook to Print-Optimized HTML for PDF Generation
     */
    function compileMarkdownToPrintHtml(mdText, year) {
        if (!mdText) return '<div>No rulebook content available.</div>';

        const lines = mdText.split(/\r?\n/);
        let secIdx = 0;
        let subIdx = 0;
        let topIdx = 0;
        let currentSubLetter = 'A';

        const htmlOut = [];

        htmlOut.push(`
            <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 20px; line-height: 1.5; font-size: 11pt;">
                <div style="text-align: center; border-bottom: 3px solid #0577B1; padding-bottom: 12px; margin-bottom: 20px;">
                    <h1 style="font-size: 20pt; font-weight: 800; color: #0577B1; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Duke Networking Fantasy League</h1>
                    <h2 style="font-size: 13pt; font-weight: 700; color: #334155; margin: 6px 0 0 0; text-transform: uppercase;">Official Bylaws & League Rules — ${year} Season</h2>
                    <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">Published Document | League ID: ${getLeagueId()}</div>
                </div>
        `);

        let inList = false;
        let inTable = false;
        let tableRows = [];
        let tableCaption = '';

        function closeList() {
            if (inList) {
                htmlOut.push('</ol>');
                inList = false;
            }
        }

        function closeTable() {
            if (inTable) {
                closeList();
                htmlOut.push('<table style="width: 100%; border-collapse: collapse; margin: 12px 0 16px 0; font-size: 9.5pt; page-break-inside: avoid;">');
                if (tableCaption) {
                    htmlOut.push(`<caption><strong style="color: #0f172a; text-transform: uppercase; border-bottom: 2px solid #0577B1; padding-bottom: 2px;">${formatInline(tableCaption)}</strong></caption>`);
                }
                if (tableRows.length > 0) {
                    htmlOut.push('<thead><tr style="background-color: #f1f5f9; border-bottom: 2px solid #0577B1;">');
                    tableRows[0].forEach(h => {
                        htmlOut.push(`<th style="padding: 6px 10px; font-weight: 700; color: #0f172a; text-align: left; text-transform: uppercase; font-size: 8.5pt;">${formatInline(h.trim())}</th>`);
                    });
                    htmlOut.push('</tr></thead><tbody>');

                    for (let rIdx = 1; rIdx < tableRows.length; rIdx++) {
                        const bg = (rIdx % 2 === 1) ? '#ffffff' : '#f8fafc';
                        htmlOut.push(`<tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0;">`);
                        tableRows[rIdx].forEach(c => {
                            htmlOut.push(`<td style="padding: 6px 10px; color: #1e293b;">${formatInline(c.trim())}</td>`);
                        });
                        htmlOut.push('</tr>');
                    }
                    htmlOut.push('</tbody>');
                }
                htmlOut.push('</table>');
                inTable = false;
                tableRows = [];
                tableCaption = '';
            }
        }

        function formatInline(str) {
            if (!str) return '';
            let s = str;
            s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            s = s.replace(/__(.*?)__/g, '<strong>$1</strong>');
            s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
            s = s.replace(/_(.*?)_/g, '<em>$1</em>');
            return s;
        }

        function toRoman(num) {
            const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
            let roman = '';
            for (let i in lookup) {
                while (num >= lookup[i]) {
                    roman += i;
                    num -= lookup[i];
                }
            }
            return roman || 'I';
        }

        function toLetter(num) {
            let letter = '';
            while (num > 0) {
                let rem = (num - 1) % 26;
                letter = String.fromCharCode(65 + rem) + letter;
                num = Math.floor((num - 1) / 26);
            }
            return letter || 'A';
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const sline = line.trim();

            if (!sline) {
                closeList();
                continue;
            }

            // Level 1 Section (# Heading)
            if (sline.startsWith('# ') && !sline.startsWith('## ')) {
                closeList();
                closeTable();
                secIdx++;
                subIdx = 0;
                topIdx = 0;
                const rawTitle = sline.substring(2).trim();
                const roman = toRoman(secIdx);

                htmlOut.push(`
                    <div style="margin-top: 24px; margin-bottom: 12px; page-break-inside: avoid;">
                        <div style="background-color: #f1f5f9; border-left: 5px solid #0577B1; padding: 10px 14px; border-radius: 4px;">
                            <h2 style="font-size: 13pt; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">SECTION ${roman}. ${rawTitle}</h2>
                        </div>
                    </div>
                `);
                continue;
            }

            // Level 2 Subsection (## Heading)
            if (sline.startsWith('## ') && !sline.startsWith('### ')) {
                closeList();
                closeTable();
                subIdx++;
                topIdx = 0;
                const rawTitle = sline.substring(3).trim();
                currentSubLetter = toLetter(subIdx);

                htmlOut.push(`
                    <div style="margin-top: 16px; margin-bottom: 8px; page-break-inside: avoid;">
                        <h3 style="font-size: 11pt; font-weight: 700; color: #0577B1; margin: 0; padding: 4px 0;">${currentSubLetter}) ${rawTitle}</h3>
                    </div>
                `);
                continue;
            }

            // Level 3 Topic (### Heading)
            if (sline.startsWith('### ')) {
                closeList();
                closeTable();
                topIdx++;
                const rawTitle = sline.substring(4).trim();
                const topicCode = `${currentSubLetter}${topIdx}`;

                htmlOut.push(`
                    <div style="margin-top: 12px; margin-bottom: 6px; page-break-inside: avoid;">
                        <h4 style="font-size: 10.5pt; font-weight: 700; color: #0f172a; margin: 0;">${topicCode}. ${rawTitle}</h4>
                    </div>
                `);
                continue;
            }

            // Level 4 Sub-Header (#### Heading)
            if (sline.startsWith('#### ')) {
                closeList();
                closeTable();
                const rawTitle = sline.substring(5).trim();
                htmlOut.push(`<p style="font-weight: 700; font-style: italic; text-decoration: underline; color: #0f172a; margin: 10px 0 4px 0; padding-left: 1.5rem;">${formatInline(rawTitle)}</p>`);
                continue;
            }

            // Table Caption
            if (sline.startsWith('[Table:') && sline.endsWith(']')) {
                tableCaption = sline.substring(7, sline.length - 1).trim();
                continue;
            }

            // Table Grid Row
            if (sline.startsWith('|') && sline.endsWith('|')) {
                if (/^\|[\s:-|-]+\|$/.test(sline)) continue;
                const cols = sline.split('|').slice(1, -1).map(c => c.trim());
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(cols);
                continue;
            } else if (inTable) {
                closeTable();
            }

            // List Items
            const listMatch = sline.match(/^(?:\d+\.|\-|\*)\s+(.*)$/);
            if (listMatch) {
                const itemText = listMatch[1].trim();
                if (!inList) {
                    inList = true;
                    htmlOut.push('<ol style="margin: 4px 0 8px 0; padding-left: 1.5rem; list-style-position: outside;">');
                }
                htmlOut.push(`<li style="margin-bottom: 4px; color: #1e293b;">${formatInline(itemText)}</li>`);
                continue;
            } else if (inList) {
                closeList();
            }

            // Regular Paragraph / Note
            if (sline) {
                htmlOut.push(`<p style="margin: 4px 0 8px 0; padding-left: 1.5rem; color: #334155;">${formatInline(sline)}</p>`);
            }
        }

        closeList();
        closeTable();

        htmlOut.push('</div>');
        return htmlOut.join('\n');
    }


    async function generateRulesReport() {
        const client = getApiClient();
        const year = targetYear || 2026;

        const urls = [
            `https://dnfl.live/dnfl_rules/${year}/DNFL_Rulebook.md`,
            `/dnfl_rules/${year}/DNFL_Rulebook.md`,
            `https://dnfl.live/dnfl_rules/2026/DNFL_Rulebook.md`,
            `/dnfl_rules/2026/DNFL_Rulebook.md`
        ];

        let mdText = null;

        for (const url of urls) {
            try {
                if (client && typeof client.fetchRawText === 'function') {
                    mdText = await client.fetchRawText(url, { ttl: client.TTL ? client.TTL.DAILY : 86400000 }).catch(() => null);
                }
                if (!mdText) {
                    const resp = await fetch(url);
                    if (resp.ok) mdText = await resp.text();
                }
                if (mdText && mdText.trim().length > 0) {
                    break;
                }
            } catch (e) {
                // Try next URL candidate
            }
        }

        if (!mdText) {
            throw new Error(`Official ${year} Rulebook Markdown dataset is not available.`);
        }

        // Parse section headers for structured table view if needed
        const lines = mdText.split(/\r?\n/);
        const rows = [];
        let curSec = 'General';
        let curSub = 'Overview';
        let curTop = 'Details';

        lines.forEach(line => {
            const sline = line.trim();
            if (!sline) return;

            if (sline.startsWith('# ') && !sline.startsWith('## ')) {
                curSec = sline.substring(2).trim();
            } else if (sline.startsWith('## ') && !sline.startsWith('### ')) {
                curSub = sline.substring(3).trim();
            } else if (sline.startsWith('### ')) {
                curTop = sline.substring(4).trim();
            } else if (!sline.startsWith('|') && !sline.startsWith('[Table:')) {
                rows.push({
                    "Section": curSec,
                    "Subsection": curSub,
                    "Topic": curTop,
                    "Rule Text": sline.replace(/^\d+\.\s*|^[\-\*]\s*/, '')
                });
            }
        });

        return {
            title: `DNFL Official Rulebook (${year})`,
            description: `Official Bylaws, League Structure, Scoring System, Waivers/Trades, and Relegation Guidelines for the ${year} season.`,
            rawMarkdown: mdText,
            columns: ["Section", "Subsection", "Topic", "Rule Text"],
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
        if (report.rawMarkdown) {
            return JSON.stringify({
                metadata: {
                    title: report.title,
                    description: report.description,
                    season: targetYear,
                    leagueId: getLeagueId(),
                    generatedAt: new Date().toISOString()
                },
                rawMarkdown: report.rawMarkdown,
                structuredRules: report.rows
            }, null, 2);
        }

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
        if (report.rawMarkdown) {
            return report.rawMarkdown;
        }

        let md = `# ${report.title}\n`;
        md += `> **Source**: DNFL Exporter | **League ID**: ${getLeagueId()} | **Season**: ${targetYear} | **Generated**: ${new Date().toLocaleString()}\n`;
        md += `> **Description**: ${report.description}\n\n`;

        md += '| ' + report.columns.join(' | ') + ' |\n';
        md += '| ' + report.columns.map(() => '---').join(' | ') + ' |\n';

        report.rows.forEach(row => {
            const values = report.columns.map(col => {
                let val = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
                return val.replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
            });
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
        const copyBtn = document.getElementById('dnfl-export-copy-btn');
        const downloadBtn = document.getElementById('dnfl-export-download-btn');

        if (!statusEl || !reportSelect || !formatSelect) return;

        currentReportType = reportSelect.value;
        currentReportFormat = formatSelect.value;
        const rawWk = weekSelect ? weekSelect.value : '0';
        currentSelectedWeek = (rawWk !== undefined && rawWk !== null && rawWk !== '') ? parseInt(rawWk, 10) : 0;
        if (isNaN(currentSelectedWeek)) currentSelectedWeek = 0;

        statusEl.className = 'dnfl-status-loading';
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching MFL data via DNFL.Client...';
        if (actionsEl) actionsEl.classList.add('dnfl-is-hidden');

        try {
            if (currentReportType === 'publishedPowerRankings') {
                currentReportData = await generatePublishedPowerRankingsReport(currentSelectedWeek);
            } else if (currentReportType === 'powerRankings') {
                currentReportData = await generatePowerRankingsReport(currentSelectedWeek);
            } else if (currentReportType === 'rosters') {
                currentReportData = await generateRostersReport(currentSelectedWeek);
            } else if (currentReportType === 'matchups') {
                currentReportData = await generateMatchupsReport(currentSelectedWeek);
            } else if (currentReportType === 'weeklyDetails') {
                currentReportData = await generateWeeklyDetailsReport(currentSelectedWeek);
            } else if (currentReportType === 'standings') {
                currentReportData = await generateStandingsReport();
            } else if (currentReportType === 'transactions') {
                currentReportData = await generateTransactionsReport(currentSelectedWeek);
            } else if (currentReportType === 'rules') {
                currentReportData = await generateRulesReport();
            }

            statusEl.className = 'dnfl-status-success';
            if (currentReportType === 'rules') {
                statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Loaded Official Rulebook dataset for ${targetYear}`;
            } else {
                statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Loaded ${currentReportData.rows.length} rows for report: ${currentReportData.title}`;
            }
            
            if (actionsEl) actionsEl.classList.remove('dnfl-is-hidden');

            let outputContent = '';
            const copyBtns = document.querySelectorAll('#dnfl-export-copy-btn, .dnfl-export-copy-btn, [id*="copy-btn"]');

            if (currentReportFormat === 'pdf') {
                copyBtns.forEach(btn => btn.classList.add('dnfl-is-hidden'));
                if (downloadBtn) downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download File';
                
                const pdfHtml = compileMarkdownToPrintHtml(currentReportData.rawMarkdown, targetYear);
                const previewContainer = document.getElementById('dnfl-export-preview-container');
                if (previewContainer) {
                    previewContainer.innerHTML = `<div id="dnfl-pdf-preview-content" class="dnfl-table-wrapper dnfl-card-body">${pdfHtml}</div>`;
                }
            } else {
                copyBtns.forEach(btn => btn.classList.remove('dnfl-is-hidden'));
                if (downloadBtn) downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download File';

                if (currentReportFormat === 'csv') {
                    outputContent = formatAsCsv(currentReportData);
                    renderPreviewTable(currentReportData);
                } else if (currentReportFormat === 'json') {
                    outputContent = formatAsJson(currentReportData);
                    renderPreviewText(outputContent);
                } else { // markdown
                    outputContent = formatAsMarkdown(currentReportData);
                    renderPreviewText(outputContent);
                }
            }
        } catch (err) {
            console.error('[DNFL Exporter Exception]:', err);
            statusEl.className = 'dnfl-status-error';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Error generating report: ${err.message}`;
        }
    }

    function handleCopyClipboard() {
        if (!currentReportData) return;
        if (currentReportFormat === 'pdf') return; // Hidden in PDF mode

        let content = '';
        if (currentReportType === 'rules' && currentReportFormat === 'markdown') {
            content = currentReportData.rawMarkdown;
        } else if (currentReportFormat === 'csv') {
            content = formatAsCsv(currentReportData);
        } else if (currentReportFormat === 'json') {
            content = formatAsJson(currentReportData);
        } else {
            content = formatAsMarkdown(currentReportData);
        }

        navigator.clipboard.writeText(content).then(() => {
            const btn = document.getElementById('dnfl-export-copy-btn');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => btn.innerHTML = orig, 2000);
            }
        });
    }

    async function handleDownloadFile() {
        if (!currentReportData) return;

        if (currentReportFormat === 'pdf') {
            const year = targetYear || 2026;
            const filename = `DNFL_Official_Rulebook_${year}.pdf`;
            const downloadBtn = document.getElementById('dnfl-export-download-btn');
            const statusEl = document.getElementById('dnfl-export-status');

            if (downloadBtn) {
                downloadBtn.disabled = true;
                downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';
            }
            if (statusEl) {
                statusEl.className = 'dnfl-status-loading';
                statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Compiling PDF document...`;
            }

            try {
                await ensureHtml2PdfLoaded();

                const previewContainer = document.getElementById('dnfl-export-preview-container');
                let pdfTargetEl = document.getElementById('dnfl-pdf-preview-content');

                if (!pdfTargetEl && currentReportData && currentReportData.rawMarkdown) {
                    const pdfHtml = compileMarkdownToPrintHtml(currentReportData.rawMarkdown, year);
                    previewContainer.innerHTML = `<div id="dnfl-pdf-preview-content" style="background-color: #ffffff; padding: 20px; border-radius: 6px; border: 1px solid #cbd5e1; color: #0f172a;">${pdfHtml}</div>`;
                    pdfTargetEl = document.getElementById('dnfl-pdf-preview-content');
                }

                if (!pdfTargetEl) {
                    throw new Error('No rulebook content found to generate PDF.');
                }

                // Temporary scroll reset for full document canvas capture
                pdfTargetEl.classList.add('is-expanded');

                const opt = {
                    margin:       [0.4, 0.4, 0.4, 0.4],
                    filename:     filename,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2, useCORS: true, logging: false },
                    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
                    pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
                };

                await window.html2pdf().set(opt).from(pdfTargetEl).save();

                pdfTargetEl.classList.remove('is-expanded');

                if (statusEl) {
                    statusEl.className = 'dnfl-status-success';
                    statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Generated and downloaded ${filename}`;
                }

            } catch (err) {
                console.error('[DNFL Exporter PDF Generation Error]:', err);
                if (statusEl) {
                    statusEl.className = 'dnfl-status-error';
                    statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error generating PDF: ${err.message}`;
                }
            } finally {
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download File';
                }
            }
            return;
        }

        let content = '';
        let ext = 'csv';

        if (currentReportType === 'rules' && currentReportFormat === 'markdown') {
            content = currentReportData.rawMarkdown;
            ext = 'md';
        } else if (currentReportFormat === 'json') {
            content = formatAsJson(currentReportData);
            ext = 'json';
        } else if (currentReportFormat === 'markdown') {
            content = formatAsMarkdown(currentReportData);
            ext = 'md';
        } else {
            content = formatAsCsv(currentReportData);
            ext = 'csv';
        }

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
        const formatSelect = document.getElementById('dnfl-export-format-select');
        const weekSelect = document.getElementById('dnfl-export-week-select');

        if (!reportSelect || !formatSelect) return;

        const reportType = reportSelect.value;
        const csvOpt = formatSelect.querySelector('option[value="csv"]');
        const pdfOpt = formatSelect.querySelector('option[value="pdf"]');

        if (reportType === 'rules') {
            if (csvOpt) csvOpt.disabled = true;
            if (pdfOpt) pdfOpt.disabled = false;
            if (formatSelect.value === 'csv') {
                formatSelect.value = 'pdf';
            }
            if (weekSelect) {
                weekSelect.disabled = true;
                weekSelect.innerHTML = '<option value="0">Full Season</option>';
            }
        } else {
            if (csvOpt) csvOpt.disabled = false;
            if (pdfOpt) pdfOpt.disabled = true;
            if (formatSelect.value === 'pdf') {
                formatSelect.value = 'csv';
            }
            if (weekSelect) {
                weekSelect.disabled = false;
            }
            populateWeekDropdown();
        }
        updateActionToolbarForFormat();
    }

    function updateActionToolbarForFormat() {
        const formatSelect = document.getElementById('dnfl-export-format-select');
        const copyBtns = document.querySelectorAll('#dnfl-export-copy-btn, .dnfl-export-copy-btn, [id*="copy-btn"]');
        const downloadBtn = document.getElementById('dnfl-export-download-btn');
        if (!formatSelect) return;

        if (formatSelect.value === 'pdf') {
            copyBtns.forEach(btn => btn.classList.add('dnfl-is-hidden'));
        } else {
            copyBtns.forEach(btn => btn.classList.remove('dnfl-is-hidden'));
        }
        if (downloadBtn) {
            downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download File';
        }
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
        const reportSelect = document.getElementById('dnfl-export-report-select');
        if (!weekSelect) return;

        const reportType = reportSelect ? reportSelect.value : 'standings';

        if (reportType === 'rules') {
            weekSelect.disabled = true;
            weekSelect.innerHTML = '<option value="0">Full Season</option>';
            return;
        }

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

        if (reportType === 'standings') {
            const opt = document.createElement('option');
            opt.value = '0';
            opt.innerText = 'Current';
            weekSelect.appendChild(opt);
            weekSelect.value = '0';
            return;
        }

        if (reportType === 'publishedPowerRankings') {
            const opt0 = document.createElement('option');
            opt0.value = '0';
            opt0.innerText = 'Pre-Season';
            weekSelect.appendChild(opt0);
            for (let w = 1; w <= maxWeek; w++) {
                const opt = document.createElement('option');
                opt.value = String(w);
                opt.innerText = `Week ${w}`;
                weekSelect.appendChild(opt);
            }
            weekSelect.value = String(maxWeek);

            fetchPublishedWeeks().then(pubWeeks => {
                if (!pubWeeks || pubWeeks.length === 0) return;
                const weekSelectEl = document.getElementById('dnfl-export-week-select');
                if (!weekSelectEl) return;
                weekSelectEl.innerHTML = '';
                let maxWkVal = 0;
                pubWeeks.forEach(wObj => {
                    const wVal = typeof wObj === 'object' ? (wObj.week !== undefined ? wObj.week : wObj.id) : wObj;
                    const wNum = parseInt(wVal, 10);
                    if (isNaN(wNum)) return;
                    const opt = document.createElement('option');
                    opt.value = String(wNum);
                    opt.innerText = wNum === 0 ? 'Pre-Season' : `Week ${wNum}`;
                    weekSelectEl.appendChild(opt);
                    if (wNum > maxWkVal) maxWkVal = wNum;
                });
                if (userHasSelectedWeek && prevVal && weekSelectEl.querySelector(`option[value="${prevVal}"]`)) {
                    weekSelectEl.value = prevVal;
                } else {
                    weekSelectEl.value = String(maxWkVal);
                }
            }).catch(() => {});
            return;
        }

        let startWk = 1;
        if (reportType === 'rosters') {
            const opt0 = document.createElement('option');
            opt0.value = '0';
            opt0.innerText = 'Current';
            weekSelect.appendChild(opt0);
            startWk = 1;
        } else if (reportType === 'powerRankings') {
            const opt0 = document.createElement('option');
            opt0.value = '0';
            opt0.innerText = 'Pre-Season';
            weekSelect.appendChild(opt0);
            startWk = 1;
        } else if (reportType === 'transactions') {
            const opt0 = document.createElement('option');
            opt0.value = '0';
            opt0.innerText = 'All Weeks';
            weekSelect.appendChild(opt0);
            startWk = 1;
        }

        for (let w = startWk; w <= maxWeek; w++) {
            const opt = document.createElement('option');
            opt.value = String(w);
            opt.innerText = `Week ${w}`;
            weekSelect.appendChild(opt);
        }

        if (reportType === 'transactions') {
            if (userHasSelectedWeek && prevVal && parseInt(prevVal, 10) <= maxWeek) {
                weekSelect.value = prevVal;
            } else {
                weekSelect.value = '0';
            }
        } else if (reportType === 'rosters') {
            if (userHasSelectedWeek && prevVal && parseInt(prevVal, 10) <= maxWeek) {
                weekSelect.value = prevVal;
            } else {
                weekSelect.value = '0';
            }
        } else {
            if (userHasSelectedWeek && prevVal && parseInt(prevVal, 10) <= maxWeek && parseInt(prevVal, 10) >= startWk) {
                weekSelect.value = prevVal;
            } else if (detectedWk !== null && detectedWk <= maxWeek && detectedWk >= startWk) {
                weekSelect.value = String(detectedWk);
            } else {
                weekSelect.value = String(maxWeek);
            }
        }
    }

    let isInitialized = false;

    function init() {
        if (isInitialized) return;

        ensureViewportMeta();

        const container = document.getElementById('dnfl-exporter-container');
        if (!container) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(init, 100);
            }
            return;
        }

        isInitialized = true;

        updateControlVisibility();

        const reportSelect = document.getElementById('dnfl-export-report-select');
        if (reportSelect) {
            reportSelect.addEventListener('change', () => {
                updateControlVisibility();
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
            formatSelect.addEventListener('change', () => {
                updateControlVisibility();
                resetExportState();
            });
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
        generatePublishedPowerRankingsReport: generatePublishedPowerRankingsReport,
        generatePowerRankingsReport: generatePowerRankingsReport,
        generateRostersReport: generateRostersReport,
        generateMatchupsReport: generateMatchupsReport,
        generateWeeklyDetailsReport: generateWeeklyDetailsReport,
        generateStandingsReport: generateStandingsReport,
        generateTransactionsReport: generateTransactionsReport,
        generateRulesReport: generateRulesReport
    };

    window.addEventListener('dnfl:ready', init);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
