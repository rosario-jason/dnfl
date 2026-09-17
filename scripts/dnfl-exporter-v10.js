// dnfl-exporter-v10.js v10.0
/* ==========================================================================
   DNFL Commissioner Data Exporter Engine v10.0
   Repository: rosario-jason/dnfl
   File: scripts/dnfl-exporter-v9.js
   Architecture Constraint: 100% standard MFL APIs via window.DNFLClient.
   No manual data accumulation loops or redundant network calls.
   ========================================================================== */
/* global DNFLClient, Papa */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    // Module Context State
    let targetYear = window.current_year || null;
    if (!targetYear && window.location) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear();
    }

    // State Caches
    let cachedLeague = null;
    let cachedFranchises = [];
    let cachedPlayersMap = {};
    let currentReportData = null;
    let currentReportType = 'rosters';
    let currentReportFormat = 'markdown';
    let currentSelectedWeek = 1;

    /**
     * Normalizes 2-digit ID values (e.g., "0", 0 -> "00")
     */
    function norm(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        return s.length === 1 && /^\d$/.test(s) ? '0' + s : s;
    }

    /**
     * Normalizes 4-digit franchise IDs (e.g., "5" -> "0005")
     */
    function normFranchiseId(val) {
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        if (!s || s === '0000') return '';
        return s.padStart(4, '0');
    }

    /**
     * Ensures input is always an Array
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
     * Retrieves API Client Middleware Instance
     */
    function getApiClient() {
        const client = window.DNFLClient || window.DNFL?.Client;
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("DNFLClient API middleware is required but unavailable on window.DNFLClient.");
        }
        return client;
    }

    /**
     * Standard Player Database Metadata via standard MFL players API (&DETAILS=1)
     */
    async function getPlayersMap() {
        if (Object.keys(cachedPlayersMap).length > 0) return cachedPlayersMap;

        try {
            const client = getApiClient();
            const data = await client.fetchData('players', '&DETAILS=1');
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

                // Index by raw ID, unpadded ID, and padded ID to guarantee 100% lookup accuracy
                cachedPlayersMap[rawId] = pObj;
                cachedPlayersMap[unpaddedId] = pObj;
                cachedPlayersMap[paddedId] = pObj;
            });
        } catch (e) {
            console.error('[DNFL Exporter] Error loading players map via DNFLClient:', e);
        }
        return cachedPlayersMap;
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
     * Helper to fetch YTD points map using native MFL API (&W=YTD)
     */
    async function getYtdScoresMap() {
        const client = getApiClient();
        const ytdScoresData = await client.fetchData('playerScores', '&W=YTD');
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

    /* ==========================================================================
       REPORT GENERATORS (ALL DATA RETRIEVED VIA STANDARD MFL APIs)
       ========================================================================== */

    /**
     * REPORT 1: Rosters
     * Fetches rosters for selected week and YTD points natively via &W=YTD
     */
    async function generateRostersReport(week) {
        const client = getApiClient();
        await getLeagueInfo();
        const playersMap = await getPlayersMap();

        const weekNum = week || 1;
        const weekParam = `&W=${weekNum}`;

        // Direct standard API requests via DNFLClient
        const [rostersData, ytdMap] = await Promise.all([
            client.fetchData('rosters', weekParam),
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

    /**
     * REPORT 2: Matchup Scores
     * Standard MFL weeklyResults API
     */
    async function generateMatchupsReport(week) {
        const client = getApiClient();
        await getLeagueInfo();

        const weeklyData = await client.fetchData('weeklyResults', `&W=${week}`);
        const rawMatchups = weeklyData?.weeklyResults?.matchup || weeklyData?.weeklyResults?.matchUp || weeklyData?.weeklyResults?.schedule?.matchup;
        let matchups = toArray(rawMatchups);

        // Fallback: If weeklyResults returns a flat franchise list
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
                    matchups.push({
                        franchise: [f, oppObj]
                    });
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

    /**
     * REPORT 3: Weekly Lineup
     * Uses standard MFL APIs: weeklyResults (&DETAILS=1), playerScores (&W=YTD), and projectedScores (&W=week)
     */
    async function generateWeeklyDetailsReport(week) {
        const client = getApiClient();
        await getLeagueInfo();
        const playersMap = await getPlayersMap();

        const weekNum = week || 1;

        // Clean standard API requests via DNFLClient
        const [weeklyData, ytdMap, projScoresData] = await Promise.all([
            client.fetchData('weeklyResults', `&W=${weekNum}&DETAILS=1`),
            getYtdScoresMap(),
            client.fetchData('projectedScores', `&W=${weekNum}`)
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

        // Fallback: If weeklyResults returns a flat franchise list
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
                    matchups.push({
                        franchise: [f, oppObj]
                    });
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

    /**
     * REPORT 4: Standings
     * Standard MFL leagueStandings API
     */
    async function generateStandingsReport() {
        const client = getApiClient();
        await getLeagueInfo();

        const currentWk = parseInt(cachedLeague?.currentWk || 1);
        const lastRegWk = parseInt(cachedLeague?.lastRegularSeasonWeek || 14);
        const maxCompletedWk = Math.min(currentWk, lastRegWk);

        // Fetch standings data and weeklyResults up to current week in parallel for fallbacks
        const weeklyPromises = [];
        for (let w = 1; w <= maxCompletedWk; w++) {
            weeklyPromises.push(client.fetchData('weeklyResults', `&W=${w}`).catch(() => null));
        }

        const [standingsData, ...allWeeklyResults] = await Promise.all([
            client.fetchData('leagueStandings', '&COLUMN_NAMES=1&ALL=1'),
            ...weeklyPromises
        ]);

        // Map weekly opponent scores & streak histories per franchise
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

                    // Add opponent score to PA accumulator
                    weeklyPaMap[f1Id] = (weeklyPaMap[f1Id] || 0) + f2Score;
                    weeklyPaMap[f2Id] = (weeklyPaMap[f2Id] || 0) + f1Score;

                    // Record game result for streak calculation
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
        const client = getApiClient();
        await getLeagueInfo();

        const standingsData = await client.fetchData('leagueStandings', '&COLUMN_NAMES=1&ALL=1');

        const franchiseStandings = toArray(standingsData?.leagueStandings?.franchise);
        const divisions = toArray(cachedLeague?.divisions?.division);
        const conferences = toArray(cachedLeague?.conferences?.conference);

        const divMap = {};
        divisions.forEach(d => divMap[norm(d.id)] = d.name);

        const confMap = {};
        conferences.forEach(c => confMap[norm(c.id)] = c.name);

        // Build division to conference mapping
        const divToConfMap = {};
        divisions.forEach(d => divToConfMap[norm(d.id)] = norm(d.conference));

        const franchiseConfDivMap = {};
        cachedFranchises.forEach(f => {
            const fid = normFranchiseId(f.id);
            const divIdNorm = norm(f.division || f.div);
            const confIdNorm = norm(f.conference || f.conf || divToConfMap[divIdNorm]);
            franchiseConfDivMap[fid] = {
                confId: confIdNorm,
                divId: divIdNorm
            };
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
            
            // Robust multi-key fallback for Points Against (PA)
            let rawPa = s.pa !== undefined && s.pa !== "0" && s.pa !== 0 ? s.pa : (s.h2hpa || s.points_against || s.opp_pf || s.opp_points || s.pa_pts || s.opp_pts || 0);
            let pa = parseFloat(rawPa).toFixed(2);

            // Robust multi-key fallback for Streak
            let streak = 'N/A';
            if (s.strk) streak = String(s.strk).toUpperCase();
            else if (s.streak) streak = String(s.streak).toUpperCase();
            else if (s.h2hstrk) streak = String(s.h2hstrk).toUpperCase();
            else if (s.h2h_streak) streak = String(s.h2h_streak).toUpperCase();
            else if (s.current_streak) streak = String(s.current_streak).toUpperCase();
            else if (s.strk_type && s.strk_len) streak = `${s.strk_type.toUpperCase()}${s.strk_len}`;
            else if (s.streak_type && s.streak_len) streak = `${s.streak_type.toUpperCase()}${s.streak_len}`;

            // Fallback for PA if s.pa was 0 despite games played
            if (parseFloat(pa) === 0 && totalGames > 0 && weeklyPaMap[fid] !== undefined) {
                pa = parseFloat(weeklyPaMap[fid]).toFixed(2);
            }

            // Fallback for Streak if streak is N/A despite games played
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
                "Seed": idx + 1,
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

    function formatAsMarkdown(report) {
        let md = `# ${report.title}\n`;
        md += `> **Source**: DNFL League Exporter | **Season**: ${targetYear} | **Generated**: ${new Date().toLocaleString()}\n`;
        md += `> **Description**: ${report.description}\n\n`;

        md += '| ' + report.columns.join(' | ') + ' |\n';
        md += '| ' + report.columns.map(() => '---').join(' | ') + ' |\n';

        report.rows.forEach(row => {
            const values = report.columns.map(col => {
                let val = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
                return val.replace(/\|/g, '\\|');
            });
            md += '| ' + values.join(' | ') + ' |\n';
        });

        return md;
    }

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
                generatedAt: new Date().toISOString(),
                rowCount: report.rows.length
            },
            columns: report.columns,
            data: report.rows
        }, null, 2);
    }

    /* ==========================================================================
       UI CONTROLLER & RENDER ENGINE
       ========================================================================== */

    function renderPreviewTable(report) {
        const previewContainer = document.getElementById('dnfl-export-preview-container');
        if (!previewContainer) return;

        let html = `<table class="dnfl-table"><thead><tr>`;
        report.columns.forEach(col => {
            html += `<th>${col}</th>`;
        });
        html += `</tr></thead><tbody>`;

        const displayRows = report.rows.slice(0, 100);
        displayRows.forEach(row => {
            html += `<tr>`;
            report.columns.forEach(col => {
                html += `<td>${row[col] !== undefined ? row[col] : ''}</td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        if (report.rows.length > 100) {
            html += `<div style="padding: 10px; font-size: 0.8rem; color: var(--dnfl-text-muted); text-align: center;">Showing preview of first 100 rows (${report.rows.length} total rows in report).</div>`;
        }

        previewContainer.innerHTML = html;
    }

    function renderPreviewText(formattedContent) {
        const previewContainer = document.getElementById('dnfl-export-preview-container');
        if (!previewContainer) return;

        previewContainer.innerHTML = `<textarea id="dnfl-export-text-area" class="dnfl-form-control" style="width: 100%; height: 350px; font-family: monospace; font-size: 0.85rem; padding: 12px; box-sizing: border-box; background-color: var(--dnfl-bg-muted); color: var(--dnfl-text-main); border: 1px solid var(--dnfl-border-medium); border-radius: var(--dnfl-radius-md);" readonly></textarea>`;
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
        statusEl.innerText = '⚡ Requesting data via DNFLClient middleware...';
        if (actionsEl) actionsEl.style.display = 'none';

        try {
            if (currentReportType === 'rosters') {
                currentReportData = await generateRostersReport(currentSelectedWeek);
            } else if (currentReportType === 'matchups') {
                currentReportData = await generateMatchupsReport(currentSelectedWeek);
            } else if (currentReportType === 'weeklyDetails') {
                currentReportData = await generateWeeklyDetailsReport(currentSelectedWeek);
            } else if (currentReportType === 'standings') {
                currentReportData = await generateStandingsReport();
            }

            statusEl.innerText = `✅ Loaded ${currentReportData.rows.length} rows for report: ${currentReportData.title}`;
            statusEl.className = '';

            if (actionsEl) actionsEl.style.display = 'flex';

            let outputContent = '';
            if (currentReportFormat === 'markdown') {
                outputContent = formatAsMarkdown(currentReportData);
                renderPreviewText(outputContent);
            } else if (currentReportFormat === 'csv') {
                outputContent = formatAsCsv(currentReportData);
                renderPreviewTable(currentReportData);
            } else if (currentReportFormat === 'json') {
                outputContent = formatAsJson(currentReportData);
                renderPreviewText(outputContent);
            }

        } catch (err) {
            console.error('[DNFL Exporter Exception]:', err);
            statusEl.className = 'dnfl-status-error';
            statusEl.innerText = `❌ Error generating report: ${err.message}`;
        }
    }

    function handleCopyClipboard() {
        if (!currentReportData) return;

        let content = '';
        if (currentReportFormat === 'markdown') content = formatAsMarkdown(currentReportData);
        else if (currentReportFormat === 'csv') content = formatAsCsv(currentReportData);
        else if (currentReportFormat === 'json') content = formatAsJson(currentReportData);

        navigator.clipboard.writeText(content).then(() => {
            const btn = document.getElementById('dnfl-export-copy-btn');
            if (btn) {
                const originalText = btn.innerText;
                btn.innerText = '✅ Copied!';
                setTimeout(() => { btn.innerText = originalText; }, 2000);
            }
        }).catch(err => {
            console.error('Clipboard copy failed:', err);
            alert('Could not copy automatically. Please copy text directly from preview.');
        });
    }

    function handleDownloadFile() {
        if (!currentReportData) return;

        let content = '';
        let ext = 'md';
        let mime = 'text/markdown';

        if (currentReportFormat === 'markdown') {
            content = formatAsMarkdown(currentReportData);
            ext = 'md';
            mime = 'text/markdown';
        } else if (currentReportFormat === 'csv') {
            content = formatAsCsv(currentReportData);
            ext = 'csv';
            mime = 'text/csv';
        } else if (currentReportFormat === 'json') {
            content = formatAsJson(currentReportData);
            ext = 'json';
            mime = 'application/json';
        }

        const filename = `dnfl_${currentReportType}_${targetYear}_W${currentSelectedWeek}.${ext}`;
        const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
        const url = URL.URL ? URL.createObjectURL(blob) : window.webkitURL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function updateControlVisibility() {
        const reportSelect = document.getElementById('dnfl-export-report-select');
        const weekGroup = document.getElementById('dnfl-export-week-group');
        if (!reportSelect || !weekGroup) return;

        const val = reportSelect.value;
        // Week selector applies to rosters, matchups, and weeklyDetails
        if (val === 'rosters' || val === 'matchups' || val === 'weeklyDetails') {
            weekGroup.style.display = 'flex';
        } else {
            weekGroup.style.display = 'none';
        }
    }

    function populateWeekDropdown() {
        const weekSelect = document.getElementById('dnfl-export-week-select');
        if (!weekSelect) return;

        const currentYearNum = new Date().getFullYear();
        const parsedTargetYear = parseInt(targetYear) || currentYearNum;
        const isHistoricalYear = parsedTargetYear < currentYearNum;

        let lastRegWeek = 14;
        if (cachedLeague && cachedLeague.lastRegularSeasonWeek) {
            lastRegWeek = parseInt(cachedLeague.lastRegularSeasonWeek) || 14;
        }

        let currentWk = 1;
        if (cachedLeague && cachedLeague.currentWk) {
            currentWk = parseInt(cachedLeague.currentWk) || 1;
        }

        let maxWeek = lastRegWeek;

        if (!isHistoricalYear) {
            // For current season, restrict dropdown choices to regular season weeks up to current week
            maxWeek = Math.min(currentWk, lastRegWeek);
            if (maxWeek < 1) maxWeek = 1;
        }

        const previousSelected = weekSelect.value;
        weekSelect.innerHTML = '';

        for (let w = 1; w <= maxWeek; w++) {
            const opt = document.createElement('option');
            opt.value = w;
            opt.innerText = `Week ${w}`;
            weekSelect.appendChild(opt);
        }

        if (previousSelected && parseInt(previousSelected) <= maxWeek) {
            weekSelect.value = previousSelected;
        } else if (cachedLeague && cachedLeague.currentWk && parseInt(cachedLeague.currentWk) <= maxWeek) {
            weekSelect.value = cachedLeague.currentWk;
        } else {
            weekSelect.value = maxWeek;
        }
    }

    function init() {
        const container = document.getElementById('dnfl-exporter-container');
        if (!container) return;

        populateWeekDropdown();
        updateControlVisibility();

        const reportSelect = document.getElementById('dnfl-export-report-select');
        if (reportSelect) {
            reportSelect.addEventListener('change', updateControlVisibility);
        }

        const genBtn = document.getElementById('dnfl-export-generate-btn');
        if (genBtn) {
            genBtn.addEventListener('click', handleGenerateReport);
        }

        const copyBtn = document.getElementById('dnfl-export-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', handleCopyClipboard);
        }

        const downloadBtn = document.getElementById('dnfl-export-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', handleDownloadFile);
        }

        getLeagueInfo().then(() => {
            populateWeekDropdown();
        }).catch(() => {});
    }

    // Export Public API
    window.DNFL.Exporter = {
        init: init,
        generateRostersReport: generateRostersReport,
        generateMatchupsReport: generateMatchupsReport,
        generateWeeklyDetailsReport: generateWeeklyDetailsReport,
        generateStandingsReport: generateStandingsReport
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
