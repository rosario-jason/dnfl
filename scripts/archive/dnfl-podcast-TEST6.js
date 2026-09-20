/* ==========================================================================
   DNFL Podcast Module Engine (v3.00-TEST6)
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Streamlined, modern podcast module taking full advantage of the updated
   DNFL.Client middleware and preloaded Marked.js parser.
   ========================================================================== */

(function (window, document) {
    'use strict';

    // Global Namespace
    window.DNFL = window.DNFL || {};
    const DNFL = window.DNFL;

    // Module State
    let podcastYear = '';
    let episodeList = [];
    let currentEpisode = null;

    /**
     * Resolve media or transcript path to dnfl.live CDN URL
     */
    function resolveCdnUrl(path, year) {
        if (!path) return '';
        const trimmed = String(path).trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
        }
        if (trimmed.startsWith('/')) {
            return `https://dnfl.live${trimmed}`;
        }
        return `https://dnfl.live/dnfl_podcast/${year}/${trimmed}`;
    }

    /**
     * Initialize Podcast Module
     */
    async function init(yearOverride) {
        podcastYear = yearOverride || (DNFL.Client ? DNFL.Client.getContext().year : new Date().getFullYear().toString());

        const selector = document.getElementById('dnfl_podcast_selector') || document.getElementById('dnfl_episodeSelector');
        if (!selector) return;

        const episodesUrl = `https://dnfl.live/dnfl_podcast/${podcastYear}/episodes.json`;

        try {
            console.log(`[DNFL.Podcast] Loading episode index: ${episodesUrl}`);
            const rawJson = await DNFL.Client.fetchRawText(episodesUrl);
            const parsed = JSON.parse(rawJson);
            const rawEpisodes = Array.isArray(parsed) ? parsed : (parsed.episodes || []);

            episodeList = rawEpisodes.map(ep => {
                const id = ep.fileId || ep.id || 'DA_S1E1';
                return {
                    id: id,
                    title: ep.title || id,
                    date: ep.date || '',
                    description: ep.description || '',
                    audio: resolveCdnUrl(ep.audio || `${id}.m4a`, podcastYear),
                    transcript: resolveCdnUrl(ep.transcript || `${id}.md`, podcastYear)
                };
            });
            console.log(`[DNFL.Podcast] Loaded ${episodeList.length} episodes for ${podcastYear}`);
        } catch (err) {
            console.error('[DNFL.Podcast] Error loading episodes.json:', err);
            return;
        }

        // Populate Dropdown Options
        selector.innerHTML = '';
        episodeList.forEach(ep => {
            const opt = document.createElement('option');
            opt.value = ep.id;
            opt.textContent = ep.date ? `${ep.title} (${ep.date})` : ep.title;
            selector.appendChild(opt);
        });

        selector.onchange = function () {
            loadEpisode(this.value);
        };

        // Auto-load most recent episode
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
        const player = document.getElementById('dnfl_podcast_player') || document.getElementById('dnfl_podcastAudioPlayer');
        if (player) {
            player.src = currentEpisode.audio;
            player.load();
        }

        // Update Metadata Labels
        const titleEl = document.getElementById('dnfl_podcast_title') || document.getElementById('dnfl_nowPlayingLabel');
        if (titleEl) titleEl.textContent = currentEpisode.title;

        const descEl = document.getElementById('dnfl_podcast_desc');
        if (descEl) descEl.textContent = currentEpisode.description || '';

        const dateEl = document.getElementById('dnfl_podcast_date');
        if (dateEl) dateEl.textContent = currentEpisode.date ? `Released: ${currentEpisode.date}` : '';

        // Fetch and Render Transcript
        await loadTranscript(currentEpisode.transcript);
    }

    /**
     * Fetch and render markdown transcript using Marked.js
     */
    async function loadTranscript(transcriptUrl) {
        const transcriptEl = document.getElementById('dnfl_podcast_transcript') || document.getElementById('dnfl_transcriptContainer');
        if (!transcriptEl) return;

        if (!transcriptUrl) {
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">No transcript available for this episode.</p>';
            return;
        }

        try {
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">Loading transcript...</p>';
            const rawMarkdown = await DNFL.Client.fetchRawText(transcriptUrl);

            // Render via preloaded Marked.js parser
            if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                transcriptEl.innerHTML = marked.parse(rawMarkdown);
            } else if (typeof marked === 'function') {
                transcriptEl.innerHTML = marked(rawMarkdown);
            } else {
                transcriptEl.innerHTML = `<div style="white-space: pre-wrap;">${rawMarkdown}</div>`;
            }
        } catch (err) {
            console.error('[DNFL.Podcast] Error loading transcript:', err);
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">Error loading transcript.</p>';
        }
    }

    /**
     * Toggle transcript container visibility (Expand / Collapse)
     */
    function toggleTranscript() {
        const wrapper = document.getElementById('dnfl_podcast_transcript') || document.getElementById('dnfl_transcriptContainer');
        const btn = document.getElementById('dnfl_transcriptToggleBtn');
        if (!wrapper) return;

        const isHidden = wrapper.style.display === 'none' || getComputedStyle(wrapper).display === 'none';
        wrapper.style.display = isHidden ? 'block' : 'none';
        if (btn) btn.textContent = isHidden ? '[ Hide Transcript ]' : '[ Show Transcript ]';
    }

    // Export Module API
    DNFL.Podcast = {
        init: init,
        loadEpisode: loadEpisode,
        toggleTranscript: toggleTranscript
    };

    // Auto-Initialize on Framework Readiness or DOM Load
    function autoInit() {
        if (document.getElementById('dnfl_podcast_selector') || 
            document.getElementById('dnfl_episodeSelector') ||
            document.getElementById('dnfl_podcast_transcript') || 
            document.getElementById('dnfl_transcriptContainer')) {
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
