/* ==========================================================================
   DNFL Podcast Module Engine v3.36
   Duke Networking Fantasy League (DNFL)
   ==========================================================================
   Streamlined, modern podcast player module. Strictly targets the new HPM spec 
   with zero legacy fallbacks or redundant code.
   ========================================================================== */

(function (window, document) {
    'use strict';

    window.DNFL = window.DNFL || {};
    const DNFL = window.DNFL;

    let podcastYear = '';
    let episodeList = [];

    /**
     * Resolve media or transcript path to dnfl.live CDN URL
     */
    function resolveCdnUrl(path, year) {
        if (!path) return '';
        return path.startsWith('http') ? path : `https://dnfl.live/dnfl_podcast/${year}/${path}`;
    }

    /**
     * Initialize Podcast Module
     */
    async function init(yearOverride) {
        // Middleware availability guard
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
        if (!client) {
            console.error('[DNFL.Podcast] API Client middleware is unavailable.');
            return;
        }

        podcastYear = yearOverride || client.getContext().year || new Date().getFullYear().toString();

        const selector = document.getElementById('dnfl_podcast_selector');
        if (!selector) return;

        const episodesUrl = `https://dnfl.live/dnfl_podcast/${podcastYear}/episodes.json`;

        try {
            const rawJson = await DNFL.Client.fetchRawText(episodesUrl);
            const parsed = JSON.parse(rawJson);
            const rawEpisodes = Array.isArray(parsed) ? parsed : (parsed.episodes || []);

            episodeList = rawEpisodes.map(ep => {
                const id = ep.fileId || ep.id;
                return {
                    id: id,
                    title: ep.title || id,
                    date: ep.date || '',
                    description: ep.description || '',
                    audio: resolveCdnUrl(ep.audio || `${id}.m4a`, podcastYear),
                    transcript: resolveCdnUrl(ep.transcript || `${id}.md`, podcastYear)
                };
            });
        } catch (err) {
            console.error('[DNFL.Podcast] Error loading episodes index:', err);
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

        // Default to latest episode (last item in array)
        if (episodeList.length > 0) {
            const latest = episodeList[episodeList.length - 1];
            selector.value = latest.id;
            await loadEpisode(latest.id);
        }
    }

    /**
     * Load selected episode audio stream and transcript
     */
    async function loadEpisode(episodeId) {
        const episode = episodeList.find(ep => ep.id === episodeId) || episodeList[episodeList.length - 1];
        if (!episode) return;

        // Update Audio Player
        const player = document.getElementById('dnfl_podcast_player');
        if (player) {
            player.src = episode.audio;
            player.load();
        }

        // Update Metadata Labels
        const titleEl = document.getElementById('dnfl_podcast_title');
        if (titleEl) titleEl.textContent = episode.title;

        const descEl = document.getElementById('dnfl_podcast_desc');
        if (descEl) descEl.textContent = episode.description;

        const dateEl = document.getElementById('dnfl_podcast_date');
        if (dateEl) dateEl.textContent = episode.date ? `Released: ${episode.date}` : '';

        // Fetch and Render Transcript
        await loadTranscript(episode.transcript);
    }

    /**
     * Fetch and render markdown transcript using Marked.js
     */
    async function loadTranscript(transcriptUrl) {
        const transcriptEl = document.getElementById('dnfl_podcast_transcript');
        if (!transcriptEl) return;

        if (!transcriptUrl) {
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">No transcript available for this episode.</p>';
            return;
        }

        try {
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">Loading transcript...</p>';
            const rawMarkdown = await DNFL.Client.fetchRawText(transcriptUrl);
            transcriptEl.innerHTML = window.marked ? marked.parse(rawMarkdown) : `<div style="white-space: pre-wrap;">${rawMarkdown}</div>`;
        } catch (err) {
            console.error('[DNFL.Podcast] Error loading transcript:', err);
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">Error loading transcript.</p>';
        }
    }

    /**
     * Toggle transcript container visibility (Expand / Collapse)
     */
    function toggleTranscript() {
        const wrapper = document.getElementById('dnfl_podcast_transcript');
        const btn = document.getElementById('dnfl_transcriptToggleBtn');
        if (!wrapper) return;

        const isHidden = wrapper.style.display === 'none' || getComputedStyle(wrapper).display === 'none';
        wrapper.style.display = isHidden ? 'block' : 'none';
        if (btn) btn.textContent = isHidden ? 'Hide Transcript' : 'Show Transcript';
    }

    // Export Module API
    DNFL.Podcast = { init, loadEpisode, toggleTranscript };

    // Auto-Initialize on Framework Readiness or DOM Load
    function autoInit() {
        if (document.getElementById('dnfl_podcast_selector') || document.getElementById('dnfl_podcast_transcript')) {
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
