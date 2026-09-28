Here is a architectural breakdown and complete, modern `README.md` for migrating the **`briancullinan2/mediaserver`** project from its original PHP/Ampache server-centric architecture to a modern, browser-native JavaScript/TypeScript client-side media server.

---

### Architectural Transformation Summary

| Feature | Legacy PHP Architecture | New Browser-Native JavaScript Architecture |
| --- | --- | --- |
| **Runtime & Server** | PHP 7+ Front Controller (`index.php`), Apache/Nginx, SQLite/MySQL | Pure Client-Side SPA (TypeScript/HTML5), Service Workers, Web Workers |
| **Database & Indexing** | Server-side relational DB via `includes/db.inc` | **OPFS SQLite WASM** via `@sqlite.org/sqlite-wasm` or **IndexedDB** |
| **Transcoding & Media** | Server FFmpeg / VLC execution via `encode.module` | **FFmpeg.wasm** inside dedicated **Web Workers** for client-side encoding |
| **File Access & Storage** | Server-side directory crawling (`files.module`, `cron.php`) | **File System Access API** (`window.showDirectoryPicker()`) with OPFS persistence |
| **Torrents & Downloader** | Server-side downloading (`download.module`) | **WebTorrent** in browser using WebSockets/SOCKS5 proxy signaling |
| **P2P & Local Sharing** | WebDAV / Ampache API endpoints | **WebRTC DataChannels** for direct P2P mesh browser-to-browser streaming |

---

# Modern MediaServer JS

> A 100% client-side, zero-backend media server, stream engine, and P2P distribution network running entirely inside the web browser.

`mediaserver-js` re-imagines the classic monolithic PHP `Atlas/mediaserver` platform as a high-performance, browser-native web application. Utilizing modern Web APIs (WebAssembly, Web Workers, File System Access API, OPFS, WebRTC, and WebSockets), this project indexes local file systems, transcodes media client-side, streams via BitTorrent/WebRTC, and shares files across browsers—without sending media content through a centralized server.

---

## Key Features

- 📁 **Local Directory Mounts & Indexing**: Mount local directories directly via the File System Access API. File metadata and media trees are persisted using SQLite compiled to WebAssembly inside Origin Private File System (OPFS).
- ⚙️ **Client-Side Transcoding (Web Workers)**: Transcode video and audio formats (MKV, AVI, FLAC, AC3) directly in background Web Workers using `@ffmpeg/ffmpeg` (FFmpeg.wasm).
- 🌐 **BitTorrent over WebSockets**: Connect to the BitTorrent network using client-side WebTorrent routed through WebSocket trackers or custom SOCKS5 proxy adapters.
- 🔄 **Browser-to-Browser P2P Mesh**: Stream local media directly to other client browser tabs using WebRTC DataChannels for zero-latency local network or remote sharing.
- ⚡ **Offline-First PWA**: Service Workers cache UI assets, database interfaces, and stream parsers for full offline usage.

---

## Architecture Overview


```

```
                  +-------------------------------------------------------+
                  |                   Browser Tab (UI)                    |
                  |  - React/Lit UI Component Tree                        |
                  |  - HTML5 Video / WebAudio Render Pipeline             |
                  +-----------+----------------------+--------------------+
                              |                      |
        +---------------------+                      +----------------------+
        |                                                                   |
        v                                                                   v

```

+-----------------------+                                              +-----------------+
|   Main Web Worker     |                                              |   Web Worker    |
| (Database & Engine)   |                                              |  (Transcoder)   |
|                       |                                              |                 |
|  - SQLite WASM (OPFS) |                                              |  - FFmpeg.wasm  |
|  - Metadata Indexer   |                                              |  - Demuxer      |
|  - Router & API       |                                              |  - Chunk Pipeline
+-----------+-----------+                                              +-----------------+
|
+-----------------------+-----------------------+
|                       |                       |
v                       v                       v
+----------------------+  +-------------------+  +--------------------+
| File System Access   |  |   WebTorrent /    |  |   WebRTC Peer      |
|     API / OPFS       |  | WebSocket Proxy   |  |   DataChannels     |
| (Local Disks & Repos)|  | (BitTorrent Swarm)|  | (Local/Remote P2P) |
+----------------------+  +-------------------+  +--------------------+

```

---

## Core Technologies & Dependencies

* **Language/Bundler**: TypeScript, Vite
* **Database**: `@sqlite.org/sqlite-wasm` (persisted to OPFS)
* **Transcoding Engine**: `@ffmpeg/ffmpeg`, `@ffmpeg/util` (FFmpeg compiled to WASM)
* **Local File System**: File System Access API (`showDirectoryPicker`)
* **Torrent Engine**: `webtorrent` (configured with WebSocket-to-TCP tracker gateways)
* **P2P Networking**: WebRTC (`simple-peer` or native `RTCPeerConnection`)

---

## Getting Started

### Prerequisites

* Node.js v18.0.0 or higher
* Modern Chromium-based browser or Firefox (supporting SharedArrayBuffer, Web Assembly, and OPFS)

### Installation

```bash
# Clone the repository
git clone [https://github.com/briancullinan2/mediaserver.git](https://github.com/briancullinan2/mediaserver.git)
cd mediaserver

# Install dependencies
npm install

# Start local development server with required COOP/COEP headers
npm run dev

```

> **Note on SharedArrayBuffer**: Multithreaded FFmpeg.wasm requires Cross-Origin Isolation. The Vite dev server is preconfigured with the following headers:
> ```http
> Cross-Origin-Opener-Policy: same-origin
> Cross-Origin-Embedder-Policy: require-corp
>
> ```
>
>

---

## Module Breakdown

### 1. File Indexer & Storage Layer (`src/core/fs/`)

* Mounts local folders using `window.showDirectoryPicker()`.
* Recursively walks file paths and stores inode metadata in SQLite WASM.
* Generates persistent file handles in OPFS for zero-copy stream reading using `FileSystemFileHandle.getFile()`.

### 2. Worker Transcoder (`src/workers/transcoder.worker.ts`)

* Executes inside a dedicated `Worker` context.
* Consumes binary chunks via `ReadableStream` or `Blob.slice()`.
* Converts incompatible video containers (e.g., MKV/HEVC to MP4/H.264) on the fly and returns fragmented MP4 streams for MSE (`MediaSource`) consumption.

### 3. BitTorrent WebSocket Gateway (`src/network/torrent/`)

* Uses `webtorrent` in pure client-side mode.
* Communicates with public BitTorrent swarms via WebSocket-to-TCP bridge proxies or native WebRTC torrent seeds.

### 4. P2P Sharing Subsystem (`src/network/p2p/`)

* Establishes direct WebRTC data pipes between running browser tabs.
* Allows Tab A (holding local file handles) to serve video segments directly to Tab B without uploading files to a cloud server.

---

## Project Structure

```
mediaserver/
├── public/
│   ├── ffmpeg/             # Static WASM binaries for FFmpeg
│   └── favicon.ico
├── src/
│   ├── components/         # UI Elements, Video Player, File Explorer
│   ├── core/
│   │   ├── db/             # SQLite WASM initialization & schema migrations
│   │   ├── fs/             # File System Access API wrappers & OPFS drivers
│   │   └── media/          # Demuxers, MediaSource Extensions (MSE) pipeline
│   ├── network/
│   │   ├── bittorrent/     # WebTorrent integration & proxy client
│   │   └── p2p/            # WebRTC peer connection manager
│   ├── workers/
│   │   ├── indexer.worker.ts
│   │   └── transcoder.worker.ts
│   ├── main.ts             # Application entrypoint
│   └── service-worker.ts   # PWA offline asset caching
├── package.json
├── tsconfig.json
└── vite.config.ts

```

---

## Production Build & Deployment

Because `mediaserver-js` is completely client-side, the build output consists of static assets that can be hosted on any static site hosting service (GitHub Pages, Cloudflare Pages, Vercel, or Nginx).

```bash
# Build the production package
npm run build

# Preview production build locally
npm run preview

```

### Static Hosting Header Configuration

Ensure your web host provides cross-origin isolation headers for multithreaded WASM support:

```nginx
# Nginx configuration snippet
location / {
    add_header Cross-Origin-Opener-Policy "same-origin";
    add_header Cross-Origin-Embedder-Policy "require-corp";
}

```

# Project History

## 09/28/2026

Coming up with too many TODOs:

* Soft file handlers that look for patterns like Quake3e.exe ~ baseq3, baseq3 becomes a launchable folder with that source as the fs_basepath, and everything loads off the right remote mod folder
* anything with C# packages? or node_modules automatically gets a D3 project code graph generated by the reverse search index in the worker
* any ROM that matches a binary expectation gets loaded in the proper emulator like opening files on desktop
* download components from other githubs and use the rosetta to decode their dependencies to automatically build "Add-on" panel definitions. allow downloading components between clients also, not only github. index client capabilities with master server json sequence after rcon is working
* turn the Github Key into a local key store and also supply a google drive key, or allow transferring keys between clients
* rebuild foomail pgp browser client with socksv5, rebuild study sauce with lumino and atrium code, rebuild edit-anywhere with lumino, sheets exporter, discord bots and nodejs quake3/game server, rebuild github/docs/jupyter/linkedin/wikipedia/imdb (search artist connector features with parquet)/google whisk/chatgpt clones into combined lumino layout tools, rebuild grafana/apparently in lumino
* option to automatically show the soft file handler instead of text based or stub in file tree.
* options to dynamically enable downloaded middlewares.
* options to monitor and enable "worker server" settings by sharing the computer the project is hosted from in the browser, also enabled "watch directory" feature from browser under hosting service. alternatively downloads updated settings from github middleware, url or express state based triggers listed explicitly, dynamically rendered
* options for cors middleware restrictions, not only dev values, i.e. allowed embed servers. proxy server specifically enabled ignoring cors -> browser, so options for that too
* wgxpath, virtual DOM in web worker for rendering components and web pages, then sending rendered html and css to front end and interactions back to backend, like an in browser selenium client controlled with AI
* diff and bookmark merger tools can start here
* lumino widget + managed idb filesystem + service worker + browser worker first serverless OmniTools clone for playing with PDFs with browser AI assistance
* settings-coalesced needs to also coalesce which components have settings panels to launch and show associated with them, or put this in menu.ts hasSettings
* build menu.ts dynamically from github and multiple sources to make side bar dynamic setting, and also add more as plugins from downloads
* TODO: move all controls out of folderview display up into top toolbar and menus, only address bar and categories at the top. make the category name the  N E T F L I X logo, make the 98% match match search results, make media source the HTTP: clipart source. make the trending scroller for network trending, thats empty so start with recent interests for the list off saved history, add scrollers the categorized folders to scroll just through their named parts and later fed with other data. add many scrollers with static height where the display disappears and shrinks as you scroll until the next row hits the top of the frame and everything takes up exactly 1/3 of the height so two rows can both show inside the middle display box without scrolling the view in favor of autoplay. make sure http indexes getting cached, begin downloading every folder index in order to grab the first image as the thumbnail. use image magick worker to make thumbnails if available, or just shrink 1 full image
* TODO: add UPnP and airplay and chromecast streaming with UDP subnet broadcasting middleware
* make point and click widget settings have parity with localStorage settings
