/* ==========================================================================
   DNFL Podcast Module Engine (v3.10-TEST2)
   Duke Networking Fantasy League (DNFL)
   Features event-driven MutationObserver initialization, Marked.js integration,
   and clean integration with DNFL.Client middleware.
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
        const client = (window.DNFL && window.DNFL.Client) || window.DNFLClient;
        if (!client) {
            console.error('[DNFL.Podcast] API Client middleware is unavailable.');
            return;
        }

        const selector = document.getElementById('dnfl_podcast_selector');
        if (!selector) return;

        podcastYear = String(yearOverride || client.getContext().year || new Date().getFullYear());
        const episodesUrl = `https://dnfl.live/dnfl_podcast/${podcastYear}/episodes.json`;

        try {
            const rawJson = await client.fetchRawText(episodesUrl);
            if (!rawJson || typeof rawJson !== 'string') throw new Error('Empty response payload');
            
            const parsed = JSON.parse(rawJson);
            const rawEpisodes = Array.isArray(parsed) ? parsed : (parsed.episodes || []);

            episodeList = rawEpisodes.map((ep, idx) => {
                const id = ep.fileId || ep.id || `ep_${idx + 1}`;
                return {
                    id: id,
                    title: ep.title || `Episode ${id}`,
                    date: ep.date || '',
                    description: ep.description || '',
                    audio: resolveCdnUrl(ep.audio || `${id}.m4a`, podcastYear),
                    transcript: resolveCdnUrl(ep.transcript || `${id}.md`, podcastYear)
                };
            });
        } catch (err) {
            console.warn(`[DNFL.Podcast] Could not load podcast index from ${episodesUrl}:`, err.message || err);
            episodeList = [];
        }

        // Populate Dropdown Options
        selector.innerHTML = '';

        if (episodeList.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = `No podcast episodes available (${podcastYear})`;
            selector.appendChild(opt);

            const descEl = document.getElementById('dnfl_podcast_desc');
            if (descEl) descEl.textContent = 'No podcast episodes published yet for this season.';
            return;
        }

        episodeList.forEach(ep => {
            const opt = document.createElement('option');
            opt.value = ep.id;
            opt.textContent = ep.date ? `${ep.title} (${ep.date})` : ep.title;
            selector.appendChild(opt);
        });

        selector.onchange = function () {
            loadEpisode(this.value);
        };

        // Select latest episode (last item in array)
        const latest = episodeList[episodeList.length - 1];
        selector.value = latest.id;
        await loadEpisode(latest.id);
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

        // Fetch & Render Transcript
        await loadTranscript(episode.transcript);
    }

    /**
     * Fetch and render transcript markdown
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
            console.warn('[DNFL.Podcast] Error loading transcript:', err.message || err);
            transcriptEl.innerHTML = '<p class="dnfl-disclaimer-text">Transcript currently unavailable.</p>';
        }
    }

    /**
     * Toggle transcript visibility
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

    // Pure Event-Driven DOM Readiness Observer
    function startWatcher() {
        if (window.DNFL && window.DNFL.Utils && typeof window.DNFL.Utils.onElementReady === 'function') {
            window.DNFL.Utils.onElementReady('#dnfl_podcast_selector', () => {
                init();
            });
        } else {
            init();
        }
    }

    window.addEventListener('dnfl:ready', startWatcher);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startWatcher);
    } else {
        startWatcher();
    }

})(window, document);
