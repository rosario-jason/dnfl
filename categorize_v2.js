const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

// File paths
const inputFile = 'css/extracted_selectors.csv';
const outputFile = 'css/categorized_selectors_v2.csv';

const results = [];

// ==========================================
// 🧠 THE CATEGORIZATION DICTIONARY V2
// ==========================================
// The script reads top-to-bottom. Highly specific custom apps go first!
const rules = [
    // --- CUSTOM MFLSCRIPTS APPS (Popups) ---
    { keywords: ['popup-player', 'playerpopup', 'player-popup'], type: 'custom', category: 'popups - player' },
    { keywords: ['notification'], type: 'custom', category: 'popups - notifications' },
    { keywords: ['popup'], type: 'custom', category: 'popups - addon' },

    // --- CUSTOM MFLSCRIPTS APPS (Scoreboards) ---
    { keywords: ['mflscoring', 'replace-scoring', 'scorereplace'], type: 'custom', category: 'scoreboard - replace mflScoring' },
    { keywords: ['miniboxscore', 'mini-boxscore', 'mini-box'], type: 'custom', category: 'mini-boxscore' },
    { keywords: ['scoreboard-module', 'scoreboard_module'], type: 'custom', category: 'scoreboard module' },

    // --- CUSTOM MFLSCRIPTS APPS (Standings) ---
    { keywords: ['standings-settings', 'standings_settings', 'standings-setting'], type: 'custom', category: 'standing settings' },
    { keywords: ['standings-column', 'standings-col', 'standings_column'], type: 'custom', category: 'standings columns' },

    // --- CUSTOM MFLSCRIPTS APPS (Misc/Specific) ---
    { keywords: ['allplay', 'all-play'], type: 'custom', category: 'allplay' },
    { keywords: ['commish', 'commissioner'], type: 'custom', category: 'commissioner abilities' },
    { keywords: ['diceroll', 'dice-roll', 'dice'], type: 'custom', category: 'diceRoll' },
    { keywords: ['enhancedchat', 'enhanced-chat'], type: 'custom', category: 'enhancedChat' },
    { keywords: ['history'], type: 'custom', category: 'history' },
    { keywords: ['marquee'], type: 'custom', category: 'marquee' },
    { keywords: ['moduleexpand', 'module-expand', 'expand'], type: 'custom', category: 'moduleExpand' },
    { keywords: ['mondaynight', 'monday-night', 'mnf'], type: 'custom', category: 'Monday Night' },
    { keywords: ['overview'], type: 'custom', category: 'overview' },
    { keywords: ['seeding', 'playoff-seeding'], type: 'custom', category: 'playoff seeding' },
    { keywords: ['slider'], type: 'custom', category: 'slider' },
    { keywords: ['submitlineup', 'submit-lineup'], type: 'custom', category: 'submit lineups' },
    { keywords: ['.tab', 'tab-', '-tab', 'tabs'], type: 'custom', category: 'tabs' }, // using dots/hyphens so it doesn't match 'table'
    { keywords: ['rules', 'rule-'], type: 'custom', category: 'rules' },
    
    // --- CUSTOM MFLSCRIPTS APPS (Overlapping Names) ---
    // Update these keywords if your custom scripts use a specific prefix (e.g. 'mfl-roster')
    { keywords: ['custom-roster', 'mfl-roster'], type: 'custom', category: 'rosters' },
    { keywords: ['custom-schedule', 'mfl-schedule'], type: 'custom', category: 'schedule' },
    { keywords: ['custom-ir', 'mfl-ir'], type: 'custom', category: 'IR' },

    // --- BROAD SKINS / GLOBAL CUSTOM ---
    { keywords: ['glffl', 'habskin', 'nfltheme', 'mflscripts', '.ls', 'ls-'], type: 'custom', category: 'skin / global app' },

    // --- STANDARD CATEGORIES (MFL defaults) ---
    { keywords: ['myfantasyleague_menu', 'nav', 'menu'], type: 'standard', category: 'navigation' },
    { keywords: ['standings'], type: 'standard', category: 'standings' },
    { keywords: ['roster', 'lineup', 'starter', 'bench', 'taxi'], type: 'standard', category: 'rosters' },
    { keywords: ['schedule'], type: 'standard', category: 'schedule' },
    { keywords: ['.ir', '-ir', 'ir-'], type: 'standard', category: 'IR' }, // dots/hyphens so it doesn't match 'direction'
    { keywords: ['matchup', 'scoreboard', 'score'], type: 'standard', category: 'scoreboard' },
    { keywords: ['draft', 'pick'], type: 'standard', category: 'draft' },
    { keywords: ['player', 'freeagent', 'waiver', 'bid'], type: 'standard', category: 'players' },
    { keywords: ['franchise', 'team'], type: 'standard', category: 'franchise' },
    { keywords: ['trade'], type: 'standard', category: 'trades' },
    { keywords: ['message', 'chat', 'article', 'poll', 'home'], type: 'standard', category: 'league' },
    { keywords: ['wrapper', 'container', 'header', 'footer', 'body', 'page'], type: 'standard', category: 'layout' },
    { keywords: ['btn', 'button', 'input', 'select', 'form'], type: 'standard', category: 'forms' },
    
    // Catch-all for basic HTML tags
    { keywords: ['html', 'body', 'a', 'p', 'h1', 'h2', 'h3', 'table', 'tr', 'td'], type: 'standard', category: 'base html' }
];

const csvWriter = createObjectCsvWriter({
    path: outputFile,
    header: [
        { id: 'selector', title: 'Selector' },
        { id: 'type', title: 'Type' },
        { id: 'category', title: 'Category' }
    ]
});

function categorizeSelector(selector) {
    const lowerSelector = selector.toLowerCase();

    for (const rule of rules) {
        const isMatch = rule.keywords.some(keyword => lowerSelector.includes(keyword));
        if (isMatch) {
            return { type: rule.type, category: rule.category };
        }
    }

    return { type: 'unknown', category: 'uncategorized' };
}

console.log('Running v2 categorization script...');

fs.createReadStream(inputFile)
    .pipe(csv())
    .on('data', (data) => {
        const selectorName = Object.values(data)[1];
        
        if (selectorName) {
            const categorization = categorizeSelector(selectorName);
            results.push({
                selector: selectorName,
                type: categorization.type,
                category: categorization.category
            });
        }
    })
    .on('end', () => {
        csvWriter.writeRecords(results)
            .then(() => {
                console.log(`✅ Success! Processed ${results.length} selectors.`);
                console.log(`📂 New file created: ${outputFile}`);
            });
    });