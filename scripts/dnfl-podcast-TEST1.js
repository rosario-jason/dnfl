/* ==========================================================================
   DNFL Podcast Module Engine (v3.00-TEST1)
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Provides an audio player interface and automated transcript renderer for 
   The Devil's Advocate podcast. Features on-demand Marked.js hydration,
   dynamic episode switching, and collapsible transcript viewing.
   ========================================================================== */

(function (window, document) {
    'use strict';

    // Global Namespace Setup
    window.DNFL = window.DNFL || {};
    const DNFL = window.DNFL;

    // Module State
    let podcastMFLYear = '';
    let episodeList = [];
    let currentEpisode = null;

    /**
     * Ensure Marked.js library is loaded before parsing transcript markdown
     */
    async function ensureMarkedLoaded() {
        if (typeof marked !== 'undefined') return true;

        if (DNFL.Utils && typeof DNFL.Utils.loadLibrary === 'function') {
            try {
                await DNFL.Utils.loadLibrary('marked');
                return typeof marked !== 'undefined';
            } catch (err) {
                console.warn('[DNFL.Podcast] Error loading Marked.js library:', err);
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

        const selector = document.getElementById('dnfl_podcast_selector') || document.getElementById('dnfl-podcast-select');
        if (!selector) return;

        const episodesUrl = `https://dnfl.live/dnfl_podcast/${podcastMFLYear}/episodes.json`;
        const apiClient = window.DNFLClient || DNFL.Client;

        try {
            if (!apiClient) throw new Error("DNFL API Client middleware unavailable.");

            const rawJson = await apiClient.fetchRawText(episodesUrl);
            episodeList = JSON.parse(rawJson);
        } catch (err) {
            console.warn('[DNFL.Podcast] Could not load episodes.json, using fallback directory:', err.message);
            episodeList = [
                {
                    id: "DA_S1E1",
                    title: "Episode 1: Season Preview & Power Rankings",
                    date: "2026-09-01",
                    audio: `https://dnfl.live/dnfl_podcast/${podcastMFLYear}/DA_S1E1.m4a`,
                    transcript: `https://dnfl.live/dnfl_podcast/${podcastMFLYear}/DA_S1E1.md`,
                    description: "Season 1, Episode 1 previewing the upcoming DNFL season."
                }
            ];
        }

        // Populate Episode Dropdown
        selector.innerHTML = '';
        episodeList.forEach(ep => {
            const opt = document.createElement('option');
            opt.value = ep.id;
            opt.textContent = `${ep.title} (${ep.date || 'Latest'})`;
            selector.appendChild(opt);
        });

        // Add change listener to selector
        selector.onchange = function () {
            loadEpisode(this.value);
        };

        // Load most recent episode by default
        if (episodeList.length > 0) {
            selector.value = episodeList[0].id;
            await loadEpisode(episodeList[0].id);
        }
    }

    /**
     * Load selected episode audio stream and transcript
     */
    async function loadEpisode(episodeId) {
        currentEpisode = episodeList.find(ep => ep.id === episodeId) || episodeList[0];
        if (!currentEpisode) return;

        // Update Audio Player
        const player = document.getElementById('dnfl_podcast_player') || document.querySelector('.dnfl-audio');
        if (player) {
            player.src = currentEpisode.audio;
            player.load();
        }

        // Update Metadata Elements
        const titleEl = document.getElementById('dnfl_podcast_title');
        if (titleEl) titleEl.textContent = currentEpisode.title;

        const descEl = document.getElementById('dnfl_podcast_desc');
        if (descEl) descEl.textContent = currentEpisode.description || '';

        const dateEl = document.getElementById('dnfl_podcast_date');
        if (dateEl) dateEl.textContent = currentEpisode.date ? `Released: ${currentEpisode.date}` : '';

        // Load Transcript
        await loadTranscript(currentEpisode.transcript);
    }

    /**
     * Fetch and render episode markdown transcript
     */
    async function loadTranscript(transcriptUrl) {
        const transcriptEl = document.getElementById('dnfl-podcast-transcript') || document.getElementById('dnfl_transcriptWrapper');
        if (!transcriptEl) return;

        if (!transcriptUrl) {
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">No transcript available for this episode.</p>';
            return;
        }

        const apiClient = window.DNFLClient || DNFL.Client;

        try {
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">Loading transcript...</p>';
            const rawMarkdown = await apiClient.fetchRawText(transcriptUrl);

            // Hydrate Marked.js on-demand before parsing
            const markedReady = await ensureMarkedLoaded();

            if (markedReady && typeof marked.parse === 'function') {
                transcriptEl.innerHTML = marked.parse(rawMarkdown);
            } else if (typeof marked === 'function') {
                transcriptEl.innerHTML = marked(rawMarkdown);
            } else {
                // Fallback: Format text with linebreaks if Marked fails to load
                transcriptEl.innerHTML = `<div style="white-space: pre-wrap;">${rawMarkdown}</div>`;
            }
        } catch (err) {
            console.error('[DNFL.Podcast] Transcript fetch error:', err);
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text" style="color: var(--dnfl-alert-red);">Error loading transcript.</p>';
        }
    }

    /**
     * Toggle transcript container visibility (Expand/Collapse)
     */
    function toggleTranscript() {
        const wrapper = document.getElementById('dnfl-podcast-transcript') || document.getElementById('dnfl_transcriptWrapper');
        const btn = document.getElementById('dnfl_transcriptToggleBtn') || document.getElementById('dnfl-transcript-toggle-btn');
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
        if (document.getElementById('dnfl_podcast_selector') || 
            document.getElementById('dnfl-podcast-select') || 
            document.getElementById('dnfl-podcast-transcript') ||
            document.getElementById('dnfl_transcriptWrapper')) {
            init();
        }
    }

    window.addEventListener('dnfl:ready', autoInit);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

})(window, document);
