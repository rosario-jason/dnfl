/* ==========================================================================
   DNFL Commissioner Data Exporter Engine v1.0
   Repository: rosario-jason/dnfl
   File: scripts/dnfl-exporter-v1.js
   ========================================================================== */
/* global DNFLClient, Papa */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    // Module State
    let activeHost = window.location.hostname || "myfantasyleague.com";
    let targetYear = window.current_year || null;
    if (!targetYear) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear();
    }
    const leagueId = window.league_id || null;

    // Data Caches
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
     * Helper to safely ensure values are Arrays
     */
    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    /**
     * Helper to register missing endpoints dynamically in DNFLClient registry
     */
    function registerClientEndpoint(type, frequency = 'daily', includeLeague = true, extraArgs = '') {
        const client = window.DNFLClient || window.DNFL?.Client;
        if (client && client.MFL_REQUEST_REGISTRY) {
            const exists = client.MFL_REQUEST_REGISTRY.find(row => row[1] === type);
            if (!exists) {
                client.MFL_REQUEST_REGISTRY.push([frequency, type, includeLeague, extraArgs]);
            }
        }
    }

    /**
     * Dynamic Direct MFL Fetcher for parameterized endpoints (e.g., W=1)
     */
    async function fetchMflDirect(mflRequestType, extraParams = '') {
        const client = window.DNFLClient || window.DNFL?.Client;
        const lId = window.league_id || leagueId;
        const activeYear = window.current_year || targetYear;
        const apiKey = window.apiKey || new URLSearchParams(window.location.search).get('APIKEY') || '';
        
        let url = `https://${activeHost}/${activeYear}/export?TYPE=${mflRequestType}&JSON=1`;
        if (lId) url += `&L=${lId}`;
        if (apiKey) url += `&APIKEY=${apiKey}`;
        if (extraParams) url += extraParams;

        if (client && typeof client.fetchRawText === 'function') {
            try {
                const rawText = await client.fetchRawText(url);
                return JSON.parse(rawText);
            } catch (e) {
                console.warn(`[DNFL Exporter] Direct fetch failed for ${mflRequestType}, retrying raw fetch:`, e);
            }
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`MFL API rejected request: HTTP ${res.status}`);
        return await res.json();
    }

    /**
     * Helper to fetch Player Database Metadata
     */
    async function getPlayersMap() {
        if (Object.keys(cachedPlayersMap).length > 0) return cachedPlayersMap;

        try {
            registerClientEndpoint('players', 'daily', false, '&DETAILS=1');
            const client = window.DNFLClient || window.DNFL?.Client;
            let data = null;
            if (client && typeof client.fetchData === 'function') {
                data = await client.fetchData('players');
            }
            if (!data) {
                data = await fetchMflDirect('players', '&DETAILS=1');
            }
            const pArray = toArray(data?.players?.player);
            pArray.forEach(p => {
                cachedPlayersMap[p.id] = {
                    id: p.id,
                    name: p.name || 'Unknown Player',
                    position: p.position || 'N/A',
                    team: p.team || 'FA'
                };
            });
        } catch (e) {
            console.error('[DNFL Exporter] Error loading players map:', e);
        }
        return cachedPlayersMap;
    }

    /**
     * Helper to fetch League Info (Franchises, Divisions, Conferences)
     */
    async function getLeagueInfo() {
        if (cachedLeague) return cachedLeague;

        const client = window.DNFLClient || window.DNFL?.Client;
        let data = null;
        if (client && typeof client.fetchData === 'function') {
            data = await client.fetchData('league');
        }
        if (!data) {
            data = await fetchMflDirect('league');
        }

        cachedLeague = data?.league || {};
        cachedFranchises = toArray(cachedLeague?.franchises?.franchise);
        return cachedLeague;
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
       REPORT GENERATORS
       ========================================================================== */

    /**
     * REPORT 1: Current Rosters for all teams with YTD points & ROS projections
     */
    async function generateRostersReport() {
        await getLeagueInfo();
        const playersMap = await getPlayersMap();

        registerClientEndpoint('rosters', 'daily', true, '');
        registerClientEndpoint('playerScores', 'hourly', true, '&W=YTD');
        
        const client = window.DNFLClient || window.DNFL?.Client;
        const [rostersData, ytdScoresData, rosScoresData] = await Promise.all([
            (client ? client.fetchData('rosters') : null) || fetchMflDirect('rosters'),
            fetchMflDirect('playerScores', '&W=YTD').catch(() => null),
            fetchMflDirect('projectedScores', '&W=ROS').catch(() => null)
        ]);

        const ytdMap = {};
        if (ytdScoresData?.playerScores?.playerScore) {
            toArray(ytdScoresData.playerScores.playerScore).forEach(ps => {
                ytdMap[ps.id] = parseFloat(ps.score || 0).toFixed(2);
            });
        }

        const rosMap = {};
        if (rosScoresData?.projectedScores?.playerScore) {
            toArray(rosScoresData.projectedScores.playerScore).forEach(ps => {
                rosMap[ps.id] = parseFloat(ps.score || 0).toFixed(2);
            });
        }

        const rosterList = toArray(rostersData?.rosters?.franchise);
        const rows = [];

        rosterList.forEach(f => {
            const fid = normFranchiseId(f.id);
            const teamName = getFranchiseName(fid);
            const players = toArray(f.player);

            players.forEach(p => {
                const pid = p.id;
                const pInfo = playersMap[pid] || { name: 'Player ' + pid, position: 'N/A', team: 'N/A' };
                rows.push({
                    "Franchise ID": fid,
                    "Team Name": teamName,
                    "Player ID": pid,
                    "Player Name": pInfo.name,
                    "Position": pInfo.position,
                    "NFL Team": pInfo.team,
                    "Roster Status": p.status || 'ROSTER',
                    "YTD Points": ytdMap[pid] || '0.00',
                    "ROS Projected Points": rosMap[pid] || 'N/A'
                });
            });
        });

        // Sort by Team Name, Position, YTD Points
        rows.sort((a, b) => a["Team Name"].localeCompare(b["Team Name"]) || a["Position"].localeCompare(b["Position"]));

        return {
            title: `DNFL Current Rosters with YTD & ROS Projections (${targetYear})`,
            description: `Complete roster listing across all franchises including player YTD fantasy points and rest-of-season projections.`,
            columns: ["Franchise ID", "Team Name", "Player ID", "Player Name", "Position", "NFL Team", "Roster Status", "YTD Points", "ROS Projected Points"],
            rows: rows
        };
    }

    /**
     * REPORT 2: Weekly Matchup Score Summary
     */
    async function generateMatchupsReport(week) {
        await getLeagueInfo();

        const weeklyData = await fetchMflDirect('weeklyResults', `&W=${week}`);
        const matchups = toArray(weeklyData?.weeklyResults?.matchup);
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
                    "Franchise 1 Opt Score": parseFloat(team1.opt_pts || 0).toFixed(2),
                    "Franchise 2 Opt Score": parseFloat(team2.opt_pts || 0).toFixed(2)
                });
            }
        });

        return {
            title: `DNFL Weekly Matchup Score Summary (Week ${week}, ${targetYear})`,
            description: `Summary of head-to-head matchup results, final scores, margins of victory, and optimal scores for Week ${week}.`,
            columns: ["Week", "Matchup #", "Franchise 1 ID", "Franchise 1 Name", "Franchise 1 Score", "Franchise 2 ID", "Franchise 2 Name", "Franchise 2 Score", "Winning Team", "Margin of Victory", "Franchise 1 Opt Score", "Franchise 2 Opt Score"],
            rows: rows
        };
    }

    /**
     * REPORT 3: Detailed Live Scoring Summary for all games in a week
     */
    async function generateLiveScoringReport(week) {
        await getLeagueInfo();
        const playersMap = await getPlayersMap();

        const liveData = await fetchMflDirect('liveScoring', `&W=${week}&DETAILS=1`);
        const matchups = toArray(liveData?.liveScoring?.matchup || liveData?.liveScoring?.matchUp);
        const rows = [];

        matchups.forEach((m, mIdx) => {
            const franchises = toArray(m.franchise);
            franchises.forEach(f => {
                const fid = normFranchiseId(f.id);
                const teamName = getFranchiseName(fid);
                const players = toArray(f.players?.player || f.player);

                players.forEach(p => {
                    const pid = p.id;
                    const pInfo = playersMap[pid] || { name: 'Player ' + pid, position: 'N/A', team: 'N/A' };
                    rows.push({
                        "Week": week,
                        "Matchup #": mIdx + 1,
                        "Franchise ID": fid,
                        "Team Name": teamName,
                        "Player ID": pid,
                        "Player Name": pInfo.name,
                        "Position": pInfo.position,
                        "NFL Team": pInfo.team,
                        "Lineup Status": (p.status || 'starter').toUpperCase(),
                        "Player Score": parseFloat(p.score || 0).toFixed(2),
                        "Game Seconds Remaining": p.gameSecondsRemaining || '0'
                    });
                });
            });
        });

        // Sort by Matchup #, Franchise ID, Lineup Status (Starter first), Player Score desc
        rows.sort((a, b) => {
            if (a["Matchup #"] !== b["Matchup #"]) return a["Matchup #"] - b["Matchup #"];
            if (a["Franchise ID"] !== b["Franchise ID"]) return a["Franchise ID"].localeCompare(b["Franchise ID"]);
            if (a["Lineup Status"] !== b["Lineup Status"]) return a["Lineup Status"] === 'STARTER' ? -1 : 1;
            return parseFloat(b["Player Score"]) - parseFloat(a["Player Score"]);
        });

        return {
            title: `DNFL Detailed Live Scoring Breakdown (Week ${week}, ${targetYear})`,
            description: `Player-level detailed scoring and starting/bench lineup status across all fantasy matchups for Week ${week}.`,
            columns: ["Week", "Matchup #", "Franchise ID", "Team Name", "Player ID", "Player Name", "Position", "NFL Team", "Lineup Status", "Player Score", "Game Seconds Remaining"],
            rows: rows
        };
    }

    /**
     * REPORT 4: Season Standings (DNFL Module Parity)
     */
    async function generateStandingsReport() {
        await getLeagueInfo();

        registerClientEndpoint('leagueStandings', 'daily', true, '&COLUMN_NAMES=1&ALL=1');
        const client = window.DNFLClient || window.DNFL?.Client;
        const standingsData = (client ? await client.fetchData('leagueStandings') : null) || await fetchMflDirect('leagueStandings', '&COLUMN_NAMES=1&ALL=1');

        const franchiseStandings = toArray(standingsData?.leagueStandings?.franchise);
        const divisions = toArray(cachedLeague?.divisions?.division);
        const conferences = toArray(cachedLeague?.conferences?.conference);

        const divMap = {};
        divisions.forEach(d => divMap[norm(d.id)] = d.name);

        const confMap = {};
        conferences.forEach(c => confMap[norm(c.id)] = c.name);

        const rows = [];

        franchiseStandings.forEach((s, idx) => {
            const fid = normFranchiseId(s.id);
            const teamName = getFranchiseName(fid);
            const ownerName = getFranchiseOwner(fid);

            const confId = norm(s.conference || s.conf);
            const divId = norm(s.division || s.div);

            const wins = parseInt(s.h2hw || s.w || 0);
            const losses = parseInt(s.h2hl || s.l || 0);
            const ties = parseInt(s.h2ht || s.t || 0);
            const totalGames = wins + losses + ties;
            const pct = totalGames > 0 ? ((wins + 0.5 * ties) / totalGames).toFixed(3) : '.000';

            const pf = parseFloat(s.pf || 0).toFixed(2);
            const pa = parseFloat(s.pa || 0).toFixed(2);

            rows.push({
                "Rank": idx + 1,
                "Franchise ID": fid,
                "Team Name": teamName,
                "Owner": ownerName,
                "Conference": confMap[confId] || confId || 'N/A',
                "Division": divMap[divId] || divId || 'N/A',
                "Wins": wins,
                "Losses": losses,
                "Ties": ties,
                "Win Pct": pct,
                "Points For (PF)": pf,
                "Points Against (PA)": pa,
                "Streak": s.streak || 'N/A',
                "Div Record": `${s.divw || 0}-${s.divl || 0}-${s.divt || 0}`
            });
        });

        return {
            title: `DNFL Season Standings & Team Metrics (${targetYear})`,
            description: `Official season standings, win-loss records, points for/against, and divisional metrics.`,
            columns: ["Rank", "Franchise ID", "Team Name", "Owner", "Conference", "Division", "Wins", "Losses", "Ties", "Win Pct", "Points For (PF)", "Points Against (PA)", "Streak", "Div Record"],
            rows: rows
        };
    }

    /* ==========================================================================
       FORMATTERS & EXPORT GENERATORS
       ========================================================================== */

    /**
     * Converts Report Data Object to Markdown (AI Prompt Ready)
     */
    function formatAsMarkdown(report) {
        let md = `# ${report.title}\n`;
        md += `> **Source**: DNFL League Exporter | **Season**: ${targetYear} | **Generated**: ${new Date().toLocaleString()}\n`;
        md += `> **Description**: ${report.description}\n\n`;

        // Table Header
        md += '| ' + report.columns.join(' | ') + ' |\n';
        md += '| ' + report.columns.map(() => '---').join(' | ') + ' |\n';

        // Table Rows
        report.rows.forEach(row => {
            const values = report.columns.map(col => {
                let val = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
                return val.replace(/\|/g, '\\|'); // Escape table pipes
            });
            md += '| ' + values.join(' | ') + ' |\n';
        });

        return md;
    }

    /**
     * Converts Report Data Object to CSV
     */
    function formatAsCsv(report) {
        if (window.Papa && typeof window.Papa.unparse === 'function') {
            return window.Papa.unparse({
                fields: report.columns,
                data: report.rows.map(r => report.columns.map(col => r[col]))
            });
        }

        // Custom Fallback CSV Generator
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

    /**
     * Converts Report Data Object to Structured JSON
     */
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

    /**
     * Renders Table Preview in DOM
     */
    function renderPreviewTable(report) {
        const previewContainer = document.getElementById('dnfl-export-preview-container');
        if (!previewContainer) return;

        let html = `<table class="dnfl-table"><thead><tr>`;
        report.columns.forEach(col => {
            html += `<th>${col}</th>`;
        });
        html += `</tr></thead><tbody>`;

        const displayRows = report.rows.slice(0, 100); // Preview cap for performance
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

    /**
     * Renders Code/Textarea Preview for Markdown or JSON
     */
    function renderPreviewText(formattedContent) {
        const previewContainer = document.getElementById('dnfl-export-preview-container');
        if (!previewContainer) return;

        previewContainer.innerHTML = `<textarea id="dnfl-export-text-area" class="dnfl-form-control" style="width: 100%; height: 350px; font-family: monospace; font-size: 0.85rem; padding: 12px; box-sizing: border-box; background-color: var(--dnfl-bg-muted); color: var(--dnfl-text-main); border: 1px solid var(--dnfl-border-medium); border-radius: var(--dnfl-radius-md);" readonly></textarea>`;
        const textarea = document.getElementById('dnfl-export-text-area');
        if (textarea) textarea.value = formattedContent;
    }

    /**
     * Triggers Full Report Generation Workflow
     */
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
        statusEl.innerText = '⚡ Fetching and compiling DNFL league data...';
        if (actionsEl) actionsEl.style.display = 'none';

        try {
            if (currentReportType === 'rosters') {
                currentReportData = await generateRostersReport();
            } else if (currentReportType === 'matchups') {
                currentReportData = await generateMatchupsReport(currentSelectedWeek);
            } else if (currentReportType === 'liveScoring') {
                currentReportData = await generateLiveScoringReport(currentSelectedWeek);
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

    /**
     * Copy to Clipboard Handler
     */
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

    /**
     * File Download Handler
     */
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
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Toggles Week Selector visibility based on report choice
     */
    function updateControlVisibility() {
        const reportSelect = document.getElementById('dnfl-export-report-select');
        const weekGroup = document.getElementById('dnfl-export-week-group');
        if (!reportSelect || !weekGroup) return;

        const val = reportSelect.value;
        if (val === 'matchups' || val === 'liveScoring') {
            weekGroup.style.display = 'flex';
        } else {
            weekGroup.style.display = 'none';
        }
    }

    /**
     * Populates Week Selector Dropdown (1..18)
     */
    function populateWeekDropdown() {
        const weekSelect = document.getElementById('dnfl-export-week-select');
        if (!weekSelect) return;

        weekSelect.innerHTML = '';
        for (let w = 1; w <= 18; w++) {
            const opt = document.createElement('option');
            opt.value = w;
            opt.innerText = `Week ${w}`;
            weekSelect.appendChild(opt);
        }

        // Set default to current week if available from league info
        if (cachedLeague && cachedLeague.currentWk) {
            weekSelect.value = cachedLeague.currentWk;
        } else {
            weekSelect.value = 1;
        }
    }

    /**
     * UI Initialization Routine
     */
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

        // Fetch initial league info to populate week default
        getLeagueInfo().then(() => {
            populateWeekDropdown();
        });
    }

    // Export Public API
    window.DNFL.Exporter = {
        init: init,
        generateRostersReport: generateRostersReport,
        generateMatchupsReport: generateMatchupsReport,
        generateLiveScoringReport: generateLiveScoringReport,
        generateStandingsReport: generateStandingsReport
    };

    // Auto-init DOM listener
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
