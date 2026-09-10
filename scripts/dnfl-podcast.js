/* ==========================================================================
   DNFL Devil's Advocate Podcast Audio Player Logic
   ========================================================================== */

let podcastMFLYear = '';

/* 🟢 MASTER CHRONOLOGICAL PLAYLIST LOG
   Instructions for adding new episodes:
   1. Upload your new audio (`.m4a`) and transcript (`.md`) files to the repository inside the correct year folder.
   2. Add a new object to the BOTTOM of this `playlistLog` array.
   3. Ensure the `fileId` string exactly matches your uploaded file names (without the extensions).
   4. Format the entry as: { fileId: "YOUR_FILE_NAME", title: "Your Display Title" }
   5. Note: Always use a comma to separate entries, but do NOT put a comma after the very last entry.
   The engine will automatically select and load the final item in this list as the default. */
const playlistLog = [
    { fileId: "DA_S1E1", title: "S1E1 - Kicking Off the 2026 DNFL Season!" }
];

function initPodcastDashboard(mflYear) {
    podcastMFLYear = mflYear;
    
    const selector = document.getElementById('dnfl_episodeSelector');
    selector.innerHTML = ''; 

    playlistLog.forEach(ep => {
        const opt = document.createElement('option');
        opt.value = ep.fileId;
        opt.textContent = ep.title;
        selector.appendChild(opt);
    });

    const latestEpisode = playlistLog[playlistLog.length - 1];
    selector.value = latestEpisode.fileId;
    loadEpisodeData(latestEpisode.fileId, latestEpisode.title);
}

function loadEpisodeData(fileId, displayTitle) {
    const player = document.getElementById('dnfl_podcastAudioPlayer');
    const source = document.getElementById('dnfl_audioSource');
    const label = document.getElementById('dnfl_nowPlayingLabel');
    const transcriptBox = document.getElementById('dnfl_transcriptContainer');

    label.textContent = `Now Playing: ${displayTitle}`;
    
    source.src = `https://dnfl.live/devils_advocate/${podcastMFLYear}/${fileId}.m4a`;
    player.load(); 

    transcriptBox.innerHTML = `<p style="color: #aaa; font-style: italic;">Loading transcript file stream for ${fileId}...</p>`;

    const transcriptUrl = `https://dnfl.live/devils_advocate/${podcastMFLYear}/${fileId}.md`;
    fetch(transcriptUrl)
        .then(response => {
            if (!response.ok) throw new Error("CORS file stream verify exception.");
            return response.text();
        })
        .then(markdownText => {
            transcriptBox.innerHTML = marked.parse(markdownText);
        })
        .catch(error => {
            console.error("Transcript load exception:", error);
            transcriptBox.innerHTML = `<p style="color: #ff5252;">⚠️ Failed to load transcript file.</p>`;
        });
}

function changeEpisode() {
    const selector = document.getElementById('dnfl_episodeSelector');
    const selectedFileId = selector.value;
    const selectedTitle = selector.options[selector.selectedIndex].text;
    loadEpisodeData(selectedFileId, selectedTitle);
}

function toggleTranscript() {
    const wrapper = document.getElementById('dnfl_transcriptContainer');
    const button = document.getElementById('dnfl_transcriptToggleBtn');
    
    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        button.textContent = '[ Hide Transcript ]';
    } else {
        wrapper.style.display = 'none';
        button.textContent = '[ Show Transcript ]';
    }
}