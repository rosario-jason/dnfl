# DNFL Devil's Advocate Podcast Module (`dnfl_podcast/`)

The **DNFL Podcast Module** provides an HTML5 audio player and automated transcript viewer for the *Devil's Advocate* podcast. It features dynamic episode manifest resolution, async markdown transcript rendering via `Marked.js`, and VS Code-compliant JavaScript middleware integration.

---

## 📁 Repository Directory Location

In accordance with the `rosario-jason/dnfl` GitHub repository structure:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
├── ./scripts/
│   └── dnfl-podcast-v2.js              # Audio player & markdown transcript engine
└── ./dnfl_podcast/
    ├── README.md                       # Podcast Module Developer Guide (This File)
    ├── devils_advocate_logo.png        # Podcast branding artwork
    ├── hpm-podcast-embed-v2.html       # HTML embed stub for MFL Home Page Modules
    └── ./2026/                         # Season Media Directory (Data-Decoupled)
        ├── episodes.json               # Published episode directory log
        ├── DA_S1E1.m4a                 # Episode audio file stream
        └── DA_S1E1.md                  # Episode transcript markdown file
```

---

## ⚙️ Logic Engine Architecture (`dnfl-podcast-v2.js`)

The Podcast Module operates within the global `window.DNFL.Podcast` namespace.

### Core Pipeline & Initialization Flow
1. **Year Context Resolution (`init`)**: Resolves active season year from `mflYear` argument, `window.current_year`, URL path regex (`/20\d{2}/`), or current calendar year.
2. **Episode Manifest Fetch**: Asynchronously retrieves `https://dnfl.live/dnfl_podcast/{YEAR}/episodes.json` via `DNFLClient.fetchRawText()`.
3. **Selector Population**: Populates `#dnfl_episodeSelector` dropdown and automatically selects the latest episode.
4. **Audio Stream Initialization (`loadEpisodeData`)**: Sets `<source id="dnfl_audioSource">` URL to `https://dnfl.live/dnfl_podcast/{YEAR}/{fileId}.m4a` and triggers `player.load()`.
5. **Transcript Fetch & Parse**: Asynchronously retrieves `https://dnfl.live/dnfl_podcast/{YEAR}/{fileId}.md` via `DNFLClient.fetchRawText()` and parses raw Markdown into HTML using `window.marked.parse()`.
6. **Visibility Controls (`toggleTranscript`)**: Toggles visibility of `#dnfl_transcriptContainer` between collapsed and expanded states.

### Key Technical Innovations & VS Code Standards
* **`/* global DNFLClient */` Header**: Eliminates VS Code language server warnings (`DNFLClient is not defined`).
* **Defensive Scoping**: Uses `const apiClient = window.DNFLClient || (typeof DNFLClient !== 'undefined' ? DNFLClient : null)` to guarantee compatibility across window loading states.
* **Global CSS Status Classes**: Replaced inline `style="..."` attributes with `.dnfl-status-loading` and `.dnfl-status-error` for status feedback.
* **Unicode Clean Strings**: Replaced multi-byte emoji character codes in JavaScript string literals with clean text to prevent UTF-8 encoding warnings across code editors.

---

## 🎙️ Data Decoupling & Schemas

### 1. Episode Directory (`episodes.json`)
Located at `https://dnfl.live/dnfl_podcast/{YEAR}/episodes.json`:

```json
[
  {
    "fileId": "DA_S1E1",
    "title": "S1E1 - No Bling... No Ring"
  },
  {
    "fileId": "DA_S1E2",
    "title": "S1E2 - Waiver Wire Heist"
  }
]
```

### 2. Media Asset Naming Conventions
For an episode entry with `"fileId": "DA_S1E1"`:
* **Audio Media Stream**: `https://dnfl.live/dnfl_podcast/{YEAR}/DA_S1E1.m4a` (Format: M4A/AAC Audio)
* **Markdown Transcript**: `https://dnfl.live/dnfl_podcast/{YEAR}/DA_S1E1.md` (Format: Plaintext Markdown, parsed via `Marked.js`)

---

## 🎨 HTML Embed Shell (`hpm-podcast-embed-v2.html`)

The HTML embed template utilizes global utility classes from `dnfl-global-v2.css`:

```html
<!-- DNFL PODCAST MODULE EMBED -->
<div class="dnfl-module-container">
    <div class="dnfl-controls">
        <div class="dnfl-filter-group">
            <label for="dnfl_episodeSelector">Select Episode:</label>
            <select id="dnfl_episodeSelector" class="dnfl-select" onchange="DNFL.Podcast.changeEpisode()"></select>
        </div>
    </div>

    <div class="dnfl-media-player-block">
        <label id="dnfl_nowPlayingLabel" class="dnfl-now-playing-label">
            Loading episode details...
        </label>
        
        <button id="dnfl_transcriptToggleBtn" class="dnfl-visibility-toggle-btn" onclick="DNFL.Podcast.toggleTranscript()">[ Show Transcript ]</button>
        
        <audio id="dnfl_podcastAudioPlayer" class="dnfl-audio" controls>
            <source id="dnfl_audioSource" src="" type="audio/mp4">
            Your browser does not support the audio element.
        </audio>

        <div id="dnfl_transcriptContainer" class="dnfl-transcript-wrapper" style="display: none;">
            <p class="dnfl-status-loading">Loading automated transcript file stream...</p>
        </div>
    </div>

    <p class="dnfl-disclaimer-text">
        The Devil's Advocate podcast is generated entirely using artificial intelligence for entertainment and informational purposes only. The analysis, player projections, and dialogue are synthesized by AI and should not be taken as factual guarantees or professional advice. Check your waivers, verify your stats, and play at your own risk.
    </p>
</div>
```

---

## 🔄 Lifecycle Diagram

```text
[Init Podcast Module]   ──► Fetch {YEAR}/episodes.json via DNFLClient
       │
       ▼
[Populate Dropdown]     ──► Select latest episode (e.g. DA_S1E1)
       │
       ▼
[Load Audio Stream]     ──► Set <source> src to DA_S1E1.m4a & trigger load()
       │
       ▼
[Fetch Transcript MD]   ──► Fetch DA_S1E1.md via DNFLClient.fetchRawText()
       │
       ▼
[Parse & Render]        ──► Render transcript HTML via Marked.js into #dnfl_transcriptContainer
```

---

## 🚀 Annual Rollover & Maintenance

1. **New Season Media Directory**: Create `./dnfl_podcast/{YEAR}/` on the media server (`dnfl.live`).
2. **Episode Log Manifest**: Place `episodes.json` inside `{YEAR}/` listing season episodes.
3. **Episode Uploads**: Upload `.m4a` audio files and `.md` transcript files matching the `fileId` schema.