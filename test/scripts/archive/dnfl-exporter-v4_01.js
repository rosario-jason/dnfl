/* ==========================================================================
   DNFL Commissioner Data Exporter v4.01
   Duke Networking Fantasy League (DNFL)
   ========================================================================== */
(function() {
    'use strict';

    window.DNFL = window.DNFL || {};

    let targetYear = window.current_year || null;
    if (!targetYear && window.location) {
        const pathSegments = window.location.pathname.split('/');
        const foundYear = pathSegments.find(segment => /^20\d{2}$/.test(segment));
        targetYear = foundYear ? foundYear : new Date().getFullYear();
    }

    let cachedLeague = null;
    let cachedFranchises = [];
    let currentReportData = null;
    let currentReportType = 'powerRankings';
    let currentReportFormat = 'csv';
    let currentSelectedWeek = 1;

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

    function getApiClient() {
        const client = window.DNFL?.Client || window.DNFLClient;
        if (!client || typeof client.fetchData !== 'function') {
            throw new Error("DNFL.Client API middleware is required but unavailable.");
        }
        return client;
    }

    async function getLeagueInfo() {
        if (cachedLeague) return cachedLeague;
        const client = getApiClient();
        const data = await client.fetchData('league');
        cachedLeague = data?.league || {};
        cachedFranchises = toArray(cachedLeague?.franchises?.franchise);
        return cachedLeague;
    }

    function getFranchiseName(fid) {
        const normFid = normFranchiseId(fid);
        const f = cachedFranchises.find(item => normFranchiseId(item.id) === normFid);
        return f ? f.name : `Franchise ${normFid}`;
    }

    /* ==========================================================================
       AUTOMATED POWER RANKINGS CALCULATION ENGINE
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

        // Fetch weeklyResults up to targetWeek in parallel
        const weeklyPromises = [];
        for (let w = 1; w <= weekNum; w++) {
            weeklyPromises.push(client.fetchData('weeklyResults', `&W=${w}`).catch(() => null));
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

        // Process Weekly Head-to-Head and All-Play Records
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

        // Find Max Points For for normalization
        const maxPf = Math.max(...statList.map(s => s.pf), 1);

        // Compute Composite Weighted Power Index (0 to 100)
        statList.forEach(s => {
            const totalGames = s.wins + s.losses + s.ties;
            const actualWinPct = totalGames > 0 ? (s.wins + 0.5 * s.ties) / totalGames : 0;

            const totalAllPlay = s.allPlayWins + s.allPlayLosses + s.allPlayTies;
            const allPlayPct = totalAllPlay > 0 ? (s.allPlayWins + 0.5 * s.allPlayTies) / totalAllPlay : 0;

            const pfRatio = s.pf / maxPf;

            // 3-Week Moving Average Trend
            const last3Scores = s.weeklyScores.slice(-3);
            const avg3Week = last3Scores.length > 0 ? last3Scores.reduce((a, b) => a + b, 0) / last3Scores.length : 0;
            const trendScore = avg3Week / (maxPf / Math.max(weekNum, 1));

            // Weighted Power Index Formula: PF (35%) + Actual Win% (30%) + All-Play Win% (25%) + 3-Wk Trend (10%)
            const rawIndex = (pfRatio * 35) + (actualWinPct * 30) + (allPlayPct * 25) + (trendScore * 10);
            s.powerScore = parseFloat(rawIndex.toFixed(2));
            s.actualWinPct = actualWinPct;
            s.allPlayPct = allPlayPct;
        });

        // Sort by Power Score descending
        statList.sort((a, b) => b.powerScore - a.powerScore);

        // Assign Ranks and Tiers
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
       STANDARD REPORT GENERATORS
       ========================================================================== */
    async function generateRostersReport(week) {
        const client = getApiClient();
        await getLeagueInfo();
        const weekNum = week || 1;

        const [rostersData, ytdScoresData] = await Promise.all([
            client.fetchData('rosters', `&W=${weekNum}`),
            client.fetchData('playerScores', '&W=YTD')
        ]);

        const ytdMap = {};
        if (ytdScoresData?.playerScores?.playerScore) {
            toArray(ytdScoresData.playerScores.playerScore).forEach(ps => {
                const pid = String(ps.id).trim();
                const score = ps.score || ps.points || ps.ytd || 0;
                ytdMap[pid] = parseFloat(score).toFixed(2);
            });
        }

        const rosterList = toArray(rostersData?.rosters?.franchise);
        const rows = [];

        rosterList.forEach(f => {
            const fid = normFranchiseId(f.id);
            const teamName = getFranchiseName(fid);
            const players = toArray(f.player);

            players.forEach(p => {
                const pid = String(p.id).trim();
                rows.push({
                    "Week": weekNum,
                    "Franchise ID": fid,
                    "Team Name": teamName,
                    "Player ID": pid,
                    "Roster Status": p.status || 'ROSTER',
                    "YTD Points": ytdMap[pid] || '0.00'
                });
            });
        });

        return {
            title: `DNFL Rosters (Week ${weekNum}, ${targetYear})`,
            description: `Complete roster listing across all franchises with YTD points for Week ${weekNum}.`,
            columns: ["Week", "Franchise ID", "Team Name", "Player ID", "Roster Status", "YTD Points"],
            rows: rows
        };
    }

    async function generateMatchupsReport(week) {
        const client = getApiClient();
        await getLeagueInfo();
        const weeklyData = await client.fetchData('weeklyResults', `&W=${week}`);
        const rawMatchups = weeklyData?.weeklyResults?.matchup || weeklyData?.weeklyResults?.schedule?.matchup;
        const matchups = toArray(rawMatchups);
        const rows = [];

        matchups.forEach((m, idx) => {
            const franchises = toArray(m.franchise);
            if (franchises.length >= 2) {
                const t1 = franchises[0];
                const t2 = franchises[1];
                const t1Id = normFranchiseId(t1.id);
                const t2Id = normFranchiseId(t2.id);
                const t1Score = parseFloat(t1.score || 0);
                const t2Score = parseFloat(t2.score || 0);

                let winner = 'TIE';
                if (t1Score > t2Score) winner = getFranchiseName(t1Id);
                else if (t2Score > t1Score) winner = getFranchiseName(t2Id);

                rows.push({
                    "Week": week,
                    "Matchup #": idx + 1,
                    "Franchise 1 ID": t1Id,
                    "Franchise 1 Name": getFranchiseName(t1Id),
                    "Franchise 1 Score": t1Score.toFixed(2),
                    "Franchise 2 ID": t2Id,
                    "Franchise 2 Name": getFranchiseName(t2Id),
                    "Franchise 2 Score": t2Score.toFixed(2),
                    "Winning Team": winner,
                    "Margin": Math.abs(t1Score - t2Score).toFixed(2)
                });
            }
        });

        return {
            title: `DNFL Matchup Scores (Week ${week}, ${targetYear})`,
            description: `Summary of head-to-head matchup results for Week ${week}.`,
            columns: ["Week", "Matchup #", "Franchise 1 ID", "Franchise 1 Name", "Franchise 1 Score", "Franchise 2 ID", "Franchise 2 Name", "Franchise 2 Score", "Winning Team", "Margin"],
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
                generatedAt: new Date().toISOString(),
                rowCount: report.rows.length
            },
            columns: report.columns,
            data: report.rows
        }, null, 2);
    }

    function formatAsMarkdown(report) {
        let md = `# ${report.title}\n`;
        md += `> **Source**: DNFL Exporter | **Season**: ${targetYear} | **Generated**: ${new Date().toLocaleString()}\n\n`;
        md += '| ' + report.columns.join(' | ') + ' |\n';
        md += '| ' + report.columns.map(() => '---').join(' | ') + ' |\n';

        report.rows.forEach(row => {
            const values = report.columns.map(col => String(row[col] || '').replace(/\|/g, '\\|'));
            md += '| ' + values.join(' | ') + ' |\n';
        });
        return md;
    }

    /* ==========================================================================
       UI CONTROLLER
       ========================================================================== */
    function renderPreviewTable(report) {
        const previewContainer = document.getElementById('dnfl-export-preview-container');
        if (!previewContainer) return;

        let html = `<table class="dnfl-table"><thead><tr>`;
        report.columns.forEach(col => html += `<th>${col}</th>`);
        html += `</tr></thead><tbody>`;

        report.rows.slice(0, 50).forEach(row => {
            html += `<tr>`;
            report.columns.forEach(col => html += `<td>${row[col] !== undefined ? row[col] : ''}</td>`);
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        previewContainer.innerHTML = html;
    }

    function renderPreviewText(formattedContent) {
        const previewContainer = document.getElementById('dnfl-export-preview-container');
        if (!previewContainer) return;
        previewContainer.innerHTML = `<textarea class="dnfl-form-control" style="width:100%; height:320px; font-family:monospace; padding:12px;" readonly>${formattedContent}</textarea>`;
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
        statusEl.innerText = '⚡ Fetching MFL data and calculating Power Rankings...';
        if (actionsEl) actionsEl.style.display = 'none';

        try {
            if (currentReportType === 'powerRankings') {
                currentReportData = await generatePowerRankingsReport(currentSelectedWeek);
            } else if (currentReportType === 'rosters') {
                currentReportData = await generateRostersReport(currentSelectedWeek);
            } else if (currentReportType === 'matchups') {
                currentReportData = await generateMatchupsReport(currentSelectedWeek);
            }

            statusEl.innerText = `✅ Generated ${currentReportData.rows.length} rows: ${currentReportData.title}`;
            statusEl.className = '';
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
            statusEl.innerText = `❌ Error: ${err.message}`;
        }
    }

    function handleCopyClipboard() {
        if (!currentReportData) return;
        let content = currentReportFormat === 'csv' ? formatAsCsv(currentReportData) : formatAsJson(currentReportData);
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

        const filename = `dnfl_power_rankings_W${currentSelectedWeek}.${ext}`;
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function populateWeekDropdown() {
        const weekSelect = document.getElementById('dnfl-export-week-select');
        if (!weekSelect) return;
        weekSelect.innerHTML = '';
        for (let w = 1; w <= 14; w++) {
            const opt = document.createElement('option');
            opt.value = w;
            opt.innerText = `Week ${w}`;
            weekSelect.appendChild(opt);
        }
    }

    function init() {
        const container = document.getElementById('dnfl-exporter-container');
        if (!container) return;

        populateWeekDropdown();

        const genBtn = document.getElementById('dnfl-export-generate-btn');
        if (genBtn) genBtn.addEventListener('click', handleGenerateReport);

        const copyBtn = document.getElementById('dnfl-export-copy-btn');
        if (copyBtn) copyBtn.addEventListener('click', handleCopyClipboard);

        const downloadBtn = document.getElementById('dnfl-export-download-btn');
        if (downloadBtn) downloadBtn.addEventListener('click', handleDownloadFile);
    }

    window.DNFL.Exporter = {
        init: init,
        generatePowerRankingsReport: generatePowerRankingsReport
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
