/* ==========================================================================
   DNFL Podcast Module Engine (v3.00-TEST4)
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Provides an audio player interface and automated transcript renderer for 
   The Devil's Advocate podcast. Features robust schema normalization (fileId/id),
   CDN media URL resolution, on-demand Marked.js hydration, detailed step-by-step
   console logging, and resilient element readiness observers.
   ========================================================================== */

(function (window, document) {
    'use strict';

    const MODULE_NAME = '[DNFL.Podcast v3.00-TEST4]';

    // Global Namespace Setup
    window.DNFL = window.DNFL || {};
    const DNFL = window.DNFL;

    // Module State
    let podcastMFLYear = '';
    let episodeList = [];
    let currentEpisode = null;
    let isInitialized = false;

    /**
     * Resolve relative media URLs (.m4a, .md) to dnfl.live CDN domain
     */
    function resolveMediaUrl(url, year) {
        if (!url) return '';
        const trimmed = String(url).trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
        }
        if (trimmed.startsWith('/')) {
            return `https://dnfl.live${trimmed}`;
        }
        return `https://dnfl.live/dnfl_podcast/${year}/${trimmed}`;
    }

    /**
     * Ensure Marked.js library is loaded before parsing transcript markdown
     */
    async function ensureMarkedLoaded() {
        if (typeof marked !== 'undefined') return true;

        console.log(`${MODULE_NAME} Marked.js not detected on window. Triggering on-demand hydration...`);
        if (DNFL.Utils && typeof DNFL.Utils.loadLibrary === 'function') {
            try {
                await DNFL.Utils.loadLibrary('marked');
                const loaded = typeof marked !== 'undefined';
                console.log(`${MODULE_NAME} Marked.js hydration result:`, loaded ? 'SUCCESS' : 'FAILED');
                return loaded;
            } catch (err) {
                console.warn(`${MODULE_NAME} Error loading Marked.js library:`, err);
            }
        }
        return false;
    }

    /**
     * Resolve active season year context
     */
    function getTargetYear() {
        if (DNFL.Client && typeof DNFL.Client.getContext === 'function') {
            return DNFL.Client.getContext().year;
        }
        const pathMatch = window.location.pathname.match(/\/(\d{4})\//);
        return pathMatch ? pathMatch[1] : (window.year || new Date().getFullYear().toString());
    }

    /**
     * Initialize Podcast Module
     */
    async function init(yearOverride) {
        podcastMFLYear = yearOverride || getTargetYear();
        console.log(`${MODULE_NAME} Initializing for season year: ${podcastMFLYear}`);

        const selector = document.querySelector(
            '#dnfl_podcast_selector, #dnfl-podcast-select, #dnfl_podcast_select, #dnfl-podcast-selector, select[name="podcast_select"], select.dnfl-podcast-select'
        );

        if (!selector) {
            console.warn(`${MODULE_NAME} Dropdown selector element not found in DOM during init(). Waiting for element insertion...`);
            if (DNFL.Utils && typeof DNFL.Utils.onElementReady === 'function') {
                DNFL.Utils.onElementReady(
                    '#dnfl_podcast_selector, #dnfl-podcast-select, #dnfl_podcast_select, #dnfl-podcast-selector, select[name="podcast_select"], select.dnfl-podcast-select',
                    () => init(yearOverride)
                );
            }
            return;
        }

        if (isInitialized) {
            console.log(`${MODULE_NAME} Already initialized. Re-populating for selector...`);
        }
        isInitialized = true;

        console.log(`${MODULE_NAME} Selector element located:`, selector);

        const episodesUrl = `https://dnfl.live/dnfl_podcast/${podcastMFLYear}/episodes.json`;
        const apiClient = window.DNFLClient || DNFL.Client;

        try {
            if (!apiClient) throw new Error("DNFL API Client middleware unavailable.");

            console.log(`${MODULE_NAME} Fetching episode directory from: ${episodesUrl}`);
            const rawJson = await apiClient.fetchRawText(episodesUrl);
            const parsed = JSON.parse(rawJson);
            
            if (Array.isArray(parsed)) {
                episodeList = parsed;
            } else if (parsed && Array.isArray(parsed.episodes)) {
                episodeList = parsed.episodes;
            } else {
                throw new Error("Unexpected episodes.json schema format.");
            }
            console.log(`${MODULE_NAME} Successfully retrieved ${episodeList.length} episodes from episodes.json`);
        } catch (err) {
            console.warn(`${MODULE_NAME} Could not load episodes.json (${err.message}). Using fallback episode directory.`);
            episodeList = [
                {
                    fileId: "DA_S1E1",
                    title: "Episode 1: Season Preview & Power Rankings",
                    date: "2026-09-01",
                    audio: "DA_S1E1.m4a",
                    transcript: "DA_S1E1.md",
                    description: "Season 1, Episode 1 previewing the upcoming DNFL season."
                }
            ];
        }

        // Normalize episode schema attributes (handles fileId vs id)
        episodeList = episodeList.map(ep => {
            const epId = ep.fileId || ep.id || ep.episodeId || 'DA_S1E1';
            const epTitle = ep.title || ep.name || epId;
            const epAudio = ep.audio || ep.audioUrl || `${epId}.m4a`;
            const epTranscript = ep.transcript || ep.transcriptUrl || `${epId}.md`;

            return {
                id: epId,
                fileId: epId,
                title: epTitle,
                date: ep.date || '',
                description: ep.description || '',
                audio: resolveMediaUrl(epAudio, podcastMFLYear),
                transcript: resolveMediaUrl(epTranscript, podcastMFLYear)
            };
        });

        // Populate Episode Dropdown Selector
        selector.innerHTML = '';
        episodeList.forEach(ep => {
            const opt = document.createElement('option');
            opt.value = ep.id;
            opt.textContent = ep.date ? `${ep.title} (${ep.date})` : ep.title;
            selector.appendChild(opt);
        });

        // Attach Change Event Listener
        selector.onchange = function () {
            console.log(`${MODULE_NAME} Episode selection changed to: ${this.value}`);
            loadEpisode(this.value);
        };

        // Load most recent episode by default
        if (episodeList.length > 0) {
            selector.value = episodeList[0].id;
            console.log(`${MODULE_NAME} Auto-loading default episode: ${episodeList[0].id}`);
            await loadEpisode(episodeList[0].id);
        }
    }

    /**
     * Load selected episode audio stream and transcript
     */
    async function loadEpisode(episodeId) {
        currentEpisode = episodeList.find(ep => ep.id === episodeId || ep.fileId === episodeId) || episodeList[0];
        if (!currentEpisode) {
            console.warn(`${MODULE_NAME} Could not find episode matching ID: ${episodeId}`);
            return;
        }

        console.log(`${MODULE_NAME} Loading episode payload:`, currentEpisode);

        // Update Audio Player
        const player = document.querySelector(
            '#dnfl_podcast_player, #dnfl-podcast-player, .dnfl-audio, audio'
        );
        if (player) {
            player.src = currentEpisode.audio;
            player.load();
            console.log(`${MODULE_NAME} Audio stream player updated: ${currentEpisode.audio}`);
        } else {
            console.warn(`${MODULE_NAME} Audio player element not found in DOM.`);
        }

        // Update Metadata Elements
        const titleEl = document.querySelector('#dnfl_podcast_title, #dnfl-podcast-title');
        if (titleEl) titleEl.textContent = currentEpisode.title;

        const descEl = document.querySelector('#dnfl_podcast_desc, #dnfl-podcast-desc');
        if (descEl) descEl.textContent = currentEpisode.description || '';

        const dateEl = document.querySelector('#dnfl_podcast_date, #dnfl-podcast-date');
        if (dateEl) dateEl.textContent = currentEpisode.date ? `Released: ${currentEpisode.date}` : '';

        // Load Transcript
        await loadTranscript(currentEpisode.transcript);
    }

    /**
     * Fetch and render episode markdown transcript
     */
    async function loadTranscript(transcriptUrl) {
        const transcriptEl = document.querySelector(
            '#dnfl-podcast-transcript, #dnfl_transcriptWrapper, #dnfl_podcast_transcript'
        );
        if (!transcriptEl) {
            console.warn(`${MODULE_NAME} Transcript container element not found in DOM.`);
            return;
        }

        if (!transcriptUrl) {
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">No transcript available for this episode.</p>';
            return;
        }

        const apiClient = window.DNFLClient || DNFL.Client;

        try {
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">Loading transcript...</p>';
            console.log(`${MODULE_NAME} Fetching transcript markdown from: ${transcriptUrl}`);
            const rawMarkdown = await apiClient.fetchRawText(transcriptUrl);

            // Hydrate Marked.js on-demand before parsing
            const markedReady = await ensureMarkedLoaded();

            if (markedReady && typeof marked.parse === 'function') {
                transcriptEl.innerHTML = marked.parse(rawMarkdown);
                console.log(`${MODULE_NAME} Transcript successfully rendered via marked.parse()`);
            } else if (typeof marked === 'function') {
                transcriptEl.innerHTML = marked(rawMarkdown);
                console.log(`${MODULE_NAME} Transcript successfully rendered via marked()`);
            } else {
                console.warn(`${MODULE_NAME} Marked.js unavailable. Using fallback plain-text formatting.`);
                transcriptEl.innerHTML = `<div style="white-space: pre-wrap;">${rawMarkdown}</div>`;
            }
        } catch (err) {
            console.error(`${MODULE_NAME} Transcript fetch error:`, err);
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text" style="color: var(--dnfl-alert-red);">Error loading transcript.</p>';
        }
    }

    /**
     * Toggle transcript container visibility (Expand/Collapse)
     */
    function toggleTranscript() {
        const wrapper = document.querySelector(
            '#dnfl-podcast-transcript, #dnfl_transcriptWrapper, #dnfl_podcast_transcript'
        );
        const btn = document.querySelector(
            '#dnfl_transcriptToggleBtn, #dnfl-transcript-toggle-btn'
        );
        if (!wrapper) return;

        if (wrapper.style.display === 'none' || getComputedStyle(wrapper).display === 'none') {
            wrapper.style.display = 'block';
            if (btn) btn.textContent = 'Hide Transcript';
        } else {
            wrapper.style.display = 'none';
            if (btn) btn.textContent = 'Show Transcript';
        }
    }

    // Export module onto DNFL namespace
    DNFL.Podcast = {
        init: init,
        loadEpisode: loadEpisode,
        toggleTranscript: toggleTranscript
    };

    // Auto-Initialization
    function autoInit() {
        console.log(`${MODULE_NAME} Auto-init triggered. Checking DOM readiness...`);
        const selectors = [
            '#dnfl_podcast_selector',
            '#dnfl-podcast-select',
            '#dnfl_podcast_select',
            '#dnfl-podcast-selector',
            'select[name="podcast_select"]',
            'select.dnfl-podcast-select',
            '#dnfl-podcast-transcript',
            '#dnfl_transcriptWrapper',
            '.dnfl-media-player-block'
        ].join(', ');

        if (DNFL.Utils && typeof DNFL.Utils.onElementReady === 'function') {
            DNFL.Utils.onElementReady(selectors, () => init());
        } else if (document.querySelector(selectors)) {
            init();
        } else {
            console.warn(`${MODULE_NAME} Target DOM elements not found at boot. Registering DOMContentLoaded fallback...`);
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => init());
            }
        }
    }

    window.addEventListener('dnfl:ready', autoInit);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

})(window, document);
