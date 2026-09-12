/* ==========================================================================
   DNFL Devil's Advocate Podcast Audio Player Logic
   ========================================================================== */
(function() {
    'use strict';

    // Establish Global DNFL Namespace
    window.DNFL = window.DNFL || {};

    let podcastMFLYear = '';

    const playlistLog = [
        { fileId: "DA_S1E1", title: "S1E1 - No Bling... No Ring" }
    ];

    /**
     * Initializes the podcast dashboard for a specific season year
     * @param {string|number} mflYear 
     */
    function init(mflYear) {
        podcastMFLYear = mflYear;
        const selector = document.getElementById('dnfl_episodeSelector');
        if (!selector) return;

        selector.innerHTML = ''; 

        playlistLog.forEach(ep => {
            const opt = document.createElement('option');
            opt.value = ep.fileId;
            opt.textContent = ep.title;
            selector.appendChild(opt);
        });

        const latestEpisode = playlistLog[playlistLog.length - 1];
        if (latestEpisode) {
            selector.value = latestEpisode.fileId;
            loadEpisodeData(latestEpisode.fileId, latestEpisode.title);
        }
    }

    /**
     * Loads audio stream and transcript markdown for a given episode
     * @param {string} fileId 
     * @param {string} displayTitle 
     */
    function loadEpisodeData(fileId, displayTitle) {
        const player = document.getElementById('dnfl_podcastAudioPlayer');
        const source = document.getElementById('dnfl_audioSource');
        const label = document.getElementById('dnfl_nowPlayingLabel');
        const transcriptBox = document.getElementById('dnfl_transcriptContainer');

        if (label) {
            label.textContent = `Now Playing: ${displayTitle}`;
        }

        if (source && player) {
            source.src = `https://dnfl.live/dnfl_podcast/${podcastMFLYear}/${fileId}.m4a`;
            player.load(); 
        }

        if (transcriptBox) {
            transcriptBox.innerHTML = `<p style="color: var(--dnfl-text-muted); font-style: italic;">Loading transcript file stream for ${fileId}...</p>`;

            const transcriptUrl = `https://dnfl.live/dnfl_podcast/${podcastMFLYear}/${fileId}.md`;
            
            // Route fetch through DNFLClient
            DNFLClient.fetchRawText(transcriptUrl)
                .then(markdownText => {
                    if (window.marked && typeof window.marked.parse === 'function') {
                        transcriptBox.innerHTML = window.marked.parse(markdownText);
                    } else {
                        transcriptBox.innerHTML = `<pre style="white-space: pre-wrap;">${markdownText}</pre>`;
                    }
                })
                .catch(error => {
                    console.error("[DNFL Podcast] Transcript load exception:", error);
                    transcriptBox.innerHTML = `<p style="color: var(--dnfl-alert-red); font-style: italic;">⚠️ Failed to load transcript file.</p>`;
                });
        }
    }

    /**
     * Triggered when a user selects a different episode from the dropdown
     */
    function changeEpisode() {
        const selector = document.getElementById('dnfl_episodeSelector');
        if (!selector) return;

        const selectedFileId = selector.value;
        const selectedTitle = selector.options[selector.selectedIndex] ? selector.options[selector.selectedIndex].text : '';
        loadEpisodeData(selectedFileId, selectedTitle);
    }

    /**
     * Toggles the visibility state of the transcript container
     */
    function toggleTranscript() {
        const wrapper = document.getElementById('dnfl_transcriptContainer');
        const button = document.getElementById('dnfl_transcriptToggleBtn');

        if (!wrapper || !button) return;

        if (wrapper.style.display === 'none' || wrapper.style.display === '') {
            wrapper.style.display = 'block';
            button.textContent = '[ Hide Transcript ]';
        } else {
            wrapper.style.display = 'none';
            button.textContent = '[ Show Transcript ]';
        }
    }

    // Export module onto the window.DNFL namespace
    window.DNFL.Podcast = {
        init: init,
        loadEpisodeData: loadEpisodeData,
        changeEpisode: changeEpisode,
        toggleTranscript: toggleTranscript
    };
})();