# Duke Networking Fantasy League (DNFL) - Podcast Player Module Guide

## 1. Executive Summary & System Philosophy

The **DNFL Podcast Player Module** (`scripts/dnfl-podcast.js`) powers *"The Devil's Advocate"* audio player and interactive Markdown transcript engine. It enables league members to stream audio broadcasts, explore season episode archives, and read synced transcripts directly within MyFantasyLeague (MFL) home page embeds.

The module strictly enforces the framework's **Separation of Concerns**:
* **Zero Inline Styles**: Layout, audio player dark blocks, typography, custom WebKit scrollbars, and card elevations are governed exclusively by `css/dnfl-global.css` (`_podcast.scss`).
* **Pure Class-Based State Management**: Transcript visibility, episode loading states, and error messaging are managed exclusively by toggling CSS utility classes (`.dnfl-is-hidden`, `.dnfl-status-loading`, `.dnfl-status-error`).
* **Decoupled Data Feeds**: Episode manifests (`episodes.json`) and Markdown transcripts (`.md`) are decoupled from code and fetched asynchronously via `DNFL.Client.fetchRawText()`.
* **Resilient Parsing & Fallback Engine**: Transcripts are parsed into rich HTML using Marked.js. If Marked is unavailable or script execution fails, the module seamlessly falls back to pre-formatted raw monospace text (`.dnfl-transcript-raw`), guaranteeing that content is never lost.

---

## 2. Repository Directory Placement

The Podcast Player module files are located in `dnfl_podcast/` within the repository layout:

```text
dnfl.live (rosario-jason GitHub repository: dnfl)
│
├── css/
│   └── dnfl-global.css                 # Master design system stylesheet
│
├── dnfl_podcast/
│   ├── README-dnfl-podcast.md          # Podcast module developer guide (This file)
│   ├── devils_advocate_logo.png        # Podcast branding header banner
│   ├── hpm-podcast-embed.html          # HTML embed shell stub for MFL HPM
│   └── 2026/                           # Season media & transcript asset directory
│       ├── episodes.json               # Season episode index manifest
│       ├── DA_S1E1.m4a                 # M4A Audio stream asset
│       ├── DA_S1E1.md                  # Markdown transcript asset
│       ├── DA_S1E2.m4a
│       └── DA_S1E2.md
│
└── scripts/
    ├── dnfl-header.js                  # Framework script loader
    ├── dnfl-api-client.js              # Central API middleware
    └── dnfl-podcast.js                 # Podcast player & transcript logic engine
```

---

## 3. System Architecture & Media Flow

```text
[Page Mount: hpm-podcast-embed.html]
       │
       ▼
[DNFL Header Loader: dnfl-header.js] ──► Dispatches 'dnfl:ready' Event
       │
       ▼
[Podcast Logic Engine: dnfl-podcast.js]
       │
       ├──► 1. Container Discovery Retry Loop (id="dnfl-podcast-container", maxRetries = 50)
       │
       ├──► 2. Fetch Season Manifest via DNFL.Client.fetchRawText()
       │      URL: 'https://dnfl.live/dnfl_podcast/2026/episodes.json' (TTL: DAILY 24h)
       │
       ├──► 3. Populate Episode Selector (#dnfl_podcastEpisodeSelect)
       │
       ├──► 4. Load Active Episode Media & Metadata
       │      ├── Bind Audio Source (<audio src="DA_S1E1.m4a">)
       │      └── Update Episode Title, Air Date, Duration & Summary
       │
       ├──► 5. Fetch Transcript Asset via DNFL.Client.fetchRawText()
       │      URL: 'https://dnfl.live/dnfl_podcast/2026/DA_S1E1.md' (TTL: DAILY 24h)
       │
       └──► 6. Render Transcript Panel (#dnfl_podcastTranscript)
              ├── Primary: Parse Markdown via Marked.js (marked.parse(mdText))
              └── Fallback: Render <pre class="dnfl-transcript-raw"> on parsing error
```

---

## 4. Data Pipeline & File Standards

### 4.1 Season Episode Index Manifest (`episodes.json`)
The episode manifest defines available media streams and transcript URLs for a given season.

* **Path Standard**: `dnfl_podcast/{YEAR}/episodes.json`
* **JSON Schema**:
```json
{
  "season": 2026,
  "podcast_title": "The Devil's Advocate",
  "default_episode_id": "S1E1",
  "episodes": [
    {
      "id": "S1E1",
      "episode_number": 1,
      "title": "Season 2026 Kickoff & Draft Analysis",
      "air_date": "2026-09-01",
      "duration": "42:15",
      "audio_url": "https://dnfl.live/dnfl_podcast/2026/DA_S1E1.m4a",
      "transcript_url": "https://dnfl.live/dnfl_podcast/2026/DA_S1E1.md",
      "summary": "Deep dive into the 2026 DNFL draft picks, division favorite projections, and week 1 matchup odds.",
      "tags": ["Draft", "Predictions", "Week 1"]
    }
  ]
}
```

### 4.2 Audio Stream Specifications (`.m4a` / `.mp3`)
* **Formats**: `.m4a` (AAC) or `.mp3` encoded at `128kbps` or `192kbps` stereo.
* **CORS Headers**: CDN host must serve audio assets with `Access-Control-Allow-Origin: *` to enable cross-origin HTML5 media playback.
* **Buffering**: HTML5 `<audio>` element uses `preload="metadata"` for fast initial load speeds.

### 4.3 Markdown Transcript Specifications (`.md`)
Transcripts are formatted in Markdown with speaker headers, timestamp callouts, and emphasis:

```markdown
# The Devil's Advocate - Episode 1: Season 2026 Kickoff

**Air Date:** September 1, 2026  
**Hosts:** Commissioner & Guest Analyst

---

### [00:00] Intro & League Overview
Welcome back to *The Devil's Advocate*! Today we break down the 2026 DNFL draft results...

### [05:15] Cameron Crazies Draft Recap
* **Key Pick:** Marvin Harrison Jr. at 1.04
* **Analysis:** High upside play that cements their receiving corps.
```

### 4.4 Data Caching & HTML Response Protection
All manifest and Markdown requests route through `DNFL.Client.fetchRawText()`:
* **Caching**: Uses `DNFL.Client.TTL.DAILY` (24 Hours) to optimize CDN bandwidth.
* **HTML Error Response Guard**: If a CDN or host server returns an HTML error page (`200 OK` with `<!DOCTYPE html>`), `DNFL.Client` detects the HTML tag and rejects the request, preventing raw HTML code from rendering into the transcript box.

---

## 5. UI Components, Audio Controls & Transcript Viewer

### 5.1 Card Architecture (`.dnfl-card`)
The module mounts inside a standardized 3-level card hierarchy:

```html
<div class="dnfl-card" id="dnfl-podcast-container">
    <div class="dnfl-card-header">
        <h3 class="dnfl-card-title">
            <i class="fa-solid fa-podcast"></i> The Devil's Advocate Podcast
        </h3>
    </div>
    <div class="dnfl-card-body">
        <!-- Controls, Media Block & Transcript -->
    </div>
</div>
```

### 5.2 Dark Media Block (`.dnfl-media-player-block`)
The media block uses Dark Charcoal (`#262626`) styling for an immersive audio experience:
* **Branding Banner**: Features `devils_advocate_logo.png` centered at top.
* **Episode Selector**: Standard `#dnfl_podcastEpisodeSelect` dropdown styled with `.dnfl-select`.
* **HTML5 Native Controls**: Dark styled native `<audio controls>` player spanning 100% width.
* **Metadata Summary**: Displays episode air date, duration pill (`.dnfl-pill-blue`), and summary text.

### 5.3 Collapsible Transcript Viewer (`.dnfl-transcript-wrapper`)
* **Transcript Toggle Button**: `#dnfl_podcastTranscriptToggle` uses `.dnfl-visibility-toggle-btn` to expand/collapse transcript content.
* **Scrollable Container**: Max height `450px` container (`overflow-y: auto`) with custom WebKit scrollbars (`6px` width, slate thumb `#cbd5e1`).
* **Marked.js Typography**: Renders Markdown headings (`h1-h4`), bold text, lists, and Duke Blue emphasis (`em`).
* **Raw Fallback Container**: If Markdown parsing fails, text renders in `.dnfl-transcript-raw` (monospace `#f8fafc` background with `white-space: pre-wrap`).
* **AI Disclaimer Footer**: Displays an automated note clarifying that transcripts are AI-generated for informational purposes.

---

## 6. HTML Embed Shell (`hpm-podcast-embed.html`)

Below is the complete, inline-style-free HTML embed shell stub for MFL:

```html
<!-- DNFL Podcast Player Module Embed Shell -->
<div class="dnfl-card" id="dnfl-podcast-container">
    <div class="dnfl-card-header">
        <h3 class="dnfl-card-title">
            <i class="fa-solid fa-podcast"></i> The Devil's Advocate Podcast
        </h3>
    </div>

    <div class="dnfl-card-body">
        <!-- Media Player Container Block -->
        <div class="dnfl-media-player-block">
            <!-- Branding Banner -->
            <div class="dnfl-podcast-banner">
                <img src="https://dnfl.live/dnfl_podcast/devils_advocate_logo.png" 
                     alt="The Devil's Advocate Logo" 
                     class="dnfl-podcast-logo" />
            </div>

            <!-- Toolbar Controls -->
            <div class="dnfl-toolbar">
                <div class="dnfl-filter-group">
                    <label for="dnfl_podcastEpisodeSelect">Select Episode</label>
                    <select id="dnfl_podcastEpisodeSelect" class="dnfl-select">
                        <option value="">Loading episodes...</option>
                    </select>
                </div>
            </div>

            <!-- Audio Player -->
            <div class="dnfl-audio-wrapper">
                <audio id="dnfl_podcastAudioPlayer" controls preload="metadata">
                    Your browser does not support the audio element.
                </audio>
            </div>

            <!-- Episode Details Card -->
            <div class="dnfl-episode-details">
                <div class="dnfl-episode-header-row">
                    <h4 id="dnfl_podcastEpisodeTitle" class="dnfl-episode-title">Episode Title</h4>
                    <span id="dnfl_podcastEpisodeDuration" class="dnfl-pill-blue dnfl-pill">00:00</span>
                </div>
                <div id="dnfl_podcastEpisodeMeta" class="dnfl-episode-meta">Air Date: --</div>
                <p id="dnfl_podcastEpisodeSummary" class="dnfl-episode-summary">
                    Episode summary will appear here.
                </p>
            </div>
        </div>

        <!-- Transcript Section -->
        <div class="dnfl-transcript-section">
            <div class="dnfl-transcript-header">
                <button id="dnfl_podcastTranscriptToggle" class="dnfl-visibility-toggle-btn">
                    <i class="fa-solid fa-file-lines"></i> Show Transcript
                </button>
            </div>

            <!-- Collapsible Transcript Wrapper -->
            <div id="dnfl_podcastTranscriptWrapper" class="dnfl-transcript-wrapper dnfl-is-hidden">
                <div id="dnfl_podcastTranscriptContent" class="dnfl-transcript-content">
                    <!-- Markdown Transcript Rendered Here -->
                </div>
                <div class="dnfl-disclaimer-note">
                    <i class="fa-solid fa-circle-info"></i> Note: Transcripts are AI-generated and may contain minor phonetic inaccuracies.
                </div>
            </div>
        </div>
    </div>
</div>
