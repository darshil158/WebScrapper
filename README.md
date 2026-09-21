<div align="center">

<img src="./assets/banner.svg" alt="WebNovel Scraper & EPUB Creator" width="100%"/>

<br/>

**A full-stack, adapter-driven web-novel scraper with a stealth browser engine,<br/>a resumable job queue, and an offline EPUB 3 builder.**

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Playwright](https://img.shields.io/badge/Playwright-1.63-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![EPUB](https://img.shields.io/badge/EPUB-3.0-7c6cf0?style=for-the-badge)](https://www.w3.org/TR/epub-33/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](./server/Dockerfile)
[![License](https://img.shields.io/badge/License-ISC-blue?style=for-the-badge)](#-license)

<br/>

[**Overview**](#-overview) ·
[**Features**](#-features) ·
[**Architecture**](#-architecture) ·
[**Quick Start**](#-quick-start) ·
[**API**](#-api-reference) ·
[**Adapters**](#-writing-a-new-adapter) ·
[**Roadmap**](#-roadmap)

</div>

<br/>

---

## 📖 Overview

**WebNovel Scraper** turns a novel's table-of-contents URL into a clean, standards-compliant **EPUB 3** file you can read on any e-reader.

You paste a URL. The app detects which site it is, pulls the metadata and chapter list, lets you choose exactly which chapters you want, then scrapes them in the background using a stealth Playwright browser. Each chapter is cleaned of ads and junk, stored locally in your browser, and finally packaged into an EPUB, all without your content ever touching a third-party service.

<div align="center">

<img src="./assets/demo.svg" alt="Animated demo of the scrape-to-EPUB pipeline" width="92%"/>

<sub>▲ The full pipeline, from detection to a downloaded <code>.epub</code>.</sub>

</div>

### Why it's built this way

| Design decision | What it gives you |
|---|---|
| **Adapter pattern** for each site | Add a new source by writing one class, with no changes to the core engine |
| **Generic heuristic fallback** | Unknown sites still work, using content-block detection |
| **Server scrapes, browser stores** | The heavy lifting (Playwright) is server-side; your library lives in **IndexedDB** on your device |
| **In-memory job queue** with control endpoints | Pause, resume, cancel, and retry individual failed chapters mid-run |
| **EPUB built client-side** with JSZip | No upload of your library anywhere to generate the book |

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🕷️ Scraping Engine
- **Stealth Playwright**: randomised user-agent, viewport, locale and timezone per session
- **Anti-detection patches**: `navigator.webdriver`, plugins, languages and `window.chrome` overrides
- **Cloudflare-aware navigation**: detects challenge pages ("Just a moment…", 403/503) and waits/retries
- **Ad & tracker blocking** at the network layer
- **Human-like pacing**: randomised 2–6 s delay between chapters
- **Optional proxy** support (HTTP/SOCKS)

</td>
<td width="50%" valign="top">

### 🧩 Adapter System
- **3 dedicated adapters**: FanMTL, WuxiaBox, WTR-Lab
- **Generic fallback** using content heuristics for any other site
- **First-match-wins registry**, with the generic adapter always last
- Uniform interface: `extractMetadata` → `discoverChapters` → `extractContent`
- Hybrid strategies: WuxiaBox uses **HTTP + Cheerio** for metadata and **Playwright** for content

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🧹 Content Cleaning
- Strips scripts, ads, nav, comments, social widgets, popups and footers
- Removes inline styles, event handlers and `data-*` attributes
- Resolves relative links/images to absolute URLs
- Converts `<br><br>` runs into real paragraphs
- Final **DOMPurify** allow-list pass
- Returns **word count** and an **MD5 content hash** per chapter (an `isDuplicate()` helper exists, ready to be wired in)

</td>
<td width="50%" valign="top">

### ⏯️ Job Control
- Pause / resume / cancel any running job
- **Per-chapter retry** with a configurable ceiling (default 3)
- Retry only the failed chapters, without restarting the whole novel
- Live progress: total / completed / failed / current
- UI polls the queue every **3 s**

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📚 EPUB 3 Builder
- Valid OCF package: `mimetype` (stored, first), `container.xml`, OPF, `nav.xhtml`, plus a legacy **NCX** for older readers
- **Title page** included; the generator also supports a **cover image** (`coverBlob`), though the Builder UI doesn't wire it up yet (see [Roadmap](#-roadmap))
- **Reorder** and **remove** chapters before export
- **Find & replace** inside a chapter
- Editable metadata (title, author, description, language, publisher)
- Import from a live server job *or* from your local library

</td>
<td width="50%" valign="top">

### 🖥️ Client Experience
- **5-step wizard**: URL → Metadata → Chapters → Configure → Start
- Chapter **search**, select-all, deselect-all and range selection
- Built-in **reader** with Light / Dark / Sepia themes
- Font-size and line-height controls, keyboard nav (← →), reading-progress bar
- **Offline-first** persistence via Dexie (IndexedDB)
- Lazy-loaded routes, skeleton loaders, toasts, collapsible sidebar

</td>
</tr>
</table>

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technologies |
|:---:|:---|
| **Frontend** | ![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) ![React Router](https://img.shields.io/badge/React_Router_7-CA4245?style=flat-square&logo=reactrouter&logoColor=white) ![Zustand](https://img.shields.io/badge/Zustand-433E38?style=flat-square) ![Dexie](https://img.shields.io/badge/Dexie.js-1E3A5F?style=flat-square) ![JSZip](https://img.shields.io/badge/JSZip-F7DF1E?style=flat-square&logo=javascript&logoColor=black) |
| **Backend** | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white) ![Express](https://img.shields.io/badge/Express_5-000000?style=flat-square&logo=express&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white) ![Cheerio](https://img.shields.io/badge/Cheerio-E88C1F?style=flat-square) ![DOMPurify](https://img.shields.io/badge/DOMPurify-2C3E50?style=flat-square) ![Helmet](https://img.shields.io/badge/Helmet-1a1a1a?style=flat-square) |
| **Storage** | ![IndexedDB](https://img.shields.io/badge/IndexedDB-browser-4285F4?style=flat-square) ![localStorage](https://img.shields.io/badge/localStorage-settings-4285F4?style=flat-square) |
| **DevOps** | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) |

</div>

---

## 🏗️ Architecture

### System at a glance

<div align="center">
<img src="./assets/architecture.svg" alt="Animated system architecture diagram" width="100%"/>
</div>

### Request flow: from URL to chapters

```mermaid
flowchart TD
    A([👤 User pastes novel URL]) --> B[POST /api/detect]
    B --> C{Adapter Registry<br/>first match wins}
    C -->|fanmtl.com| D1[FanMTLAdapter]
    C -->|wuxiabox.com / .net| D2[WuxiaBoxAdapter]
    C -->|wtr-lab.com / .net| D3[WTRLabAdapter]
    C -->|anything else| D4[GenericAdapter<br/>heuristic fallback]

    D1 & D2 & D3 & D4 --> E[POST /api/metadata]
    E --> F[createStealthPage<br/>randomised fingerprint]
    F --> G[navigateWithRetry]
    G --> H{Cloudflare or<br/>anti-bot challenge?}
    H -->|Yes, attempts left| I[Wait 8–13 s<br/>re-check title] --> G
    H -->|Yes, exhausted| X[/❌ 403 blocked<br/>surfaced to UI/]
    H -->|No| J[adapter.extractMetadata]
    J --> K[POST /api/chapters<br/>adapter.discoverChapters]
    K --> L([📋 Chapter list returned to wizard])

    style A fill:#7c6cf0,stroke:#7c6cf0,color:#fff
    style L fill:#2dd4bf,stroke:#2dd4bf,color:#0b0b1e
    style X fill:#ef4444,stroke:#ef4444,color:#fff
    style C fill:#1b1750,stroke:#7c6cf0,color:#fff
    style H fill:#1b1750,stroke:#fbbf24,color:#fff
```

### Scrape job lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant UI as React Client
    participant DB as IndexedDB (Dexie)
    participant API as Express API
    participant Q as JobQueue
    participant BE as BrowserEngine
    participant AD as Adapter
    participant CC as ContentCleaner

    U->>UI: Select chapters + configure delays
    UI->>DB: Save novel, chapters, project, history
    UI->>API: POST /api/scrape {url, chapters, options}
    API->>Q: createJob()
    API-->>UI: 200 { jobId, status: "started" }
    Note over API,Q: Work continues in the background via setImmediate()

    loop for each pending chapter
        Q->>BE: navigateWithRetry(chapterUrl)
        BE->>AD: extractContent(page)
        AD-->>Q: raw html + title
        Q->>CC: clean(html, url)
        CC-->>Q: sanitized html, wordCount, hash
        Q->>Q: mark completed · emit progress
        Q->>Q: random delay (2–6 s)
    end

    loop every 3 s
        UI->>API: GET /api/jobs
        API-->>UI: progress {total, completed, failed}
    end

    U->>UI: Open EPUB Builder
    UI->>API: GET /api/scrape/:id/chapters
    API-->>UI: cleaned chapter content
    UI->>UI: JSZip → EPUB 3 blob
    UI-->>U: ⬇️ Novel.epub
```

### Job state machine

Every job and every chapter moves through a small, explicit state machine, which is what makes pause, resume and selective retry reliable.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> pending
    pending --> running: startJob()
    running --> paused: pauseJob()
    paused --> running: resumeJob()
    running --> completed: all chapters processed
    running --> failed: every chapter failed
    running --> cancelled: cancelJob()
    paused --> cancelled: cancelJob()
    completed --> [*]
    failed --> running: retryFailed()
    cancelled --> [*]
```

```mermaid
stateDiagram-v2
    direction LR
    [*] --> pending
    pending --> scraping: picked up
    scraping --> completed: success
    scraping --> pending: error, retries < max
    scraping --> failed: error, retries ≥ max
    failed --> pending: retryFailed()
    completed --> [*]
```

### Client data model (IndexedDB)

```mermaid
erDiagram
    NOVELS ||--o{ CHAPTERS : contains
    NOVELS ||--o{ PROJECTS : "tracked by"
    NOVELS ||--o{ HISTORY : logs
    PROJECTS ||--o{ SCRAPEJOBS : runs
    PROJECTS ||--o{ EPUBEXPORTS : produces

    NOVELS {
        int id PK
        string title
        string author
        string siteUrl
        string adapter
        string createdAt
    }
    CHAPTERS {
        int id PK
        int novelId FK
        int index
        string title
        string url
        string status
        string scrapedAt
    }
    PROJECTS {
        int id PK
        int novelId FK
        string name
        string createdAt
        string updatedAt
    }
    SCRAPEJOBS {
        int id PK
        int projectId FK
        string status
        string startedAt
        string completedAt
    }
    EPUBEXPORTS {
        int id PK
        int projectId FK
        string filename
        string createdAt
    }
    HISTORY {
        int id PK
        int novelId FK
        string action
        string timestamp
    }
```

### Content-cleaning pipeline

```mermaid
flowchart LR
    R[Raw HTML] --> S1["① Remove junk<br/>ads · nav · comments<br/>social · popups · footer"]
    S1 --> S2["② Drop empty<br/>div / span / p"]
    S2 --> S3["③ Strip style,<br/>on* handlers, data-*"]
    S3 --> S4["④ Absolutise<br/>links & images"]
    S4 --> S5["⑤ Normalise<br/>whitespace"]
    S5 --> S6["⑥ br·br → paragraphs"]
    S6 --> S7["⑦ DOMPurify<br/>allow-list"]
    S7 --> S8["⑧ wordCount +<br/>MD5 hash"]
    S8 --> O([✅ Clean chapter])

    style R fill:#ef4444,stroke:#ef4444,color:#fff
    style O fill:#2dd4bf,stroke:#2dd4bf,color:#0b0b1e
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 18 or newer | Both client and server |
| **Playwright browsers** | Chromium | Installed via `npx playwright install chromium` |

### 1 · Clone

```bash
git clone https://github.com/darshil158/WebScrapper.git
cd WebScrapper
```

### 2 · Start the backend

```bash
cd server
npm install
npx playwright install chromium
npm run dev          # → http://localhost:3001
```

You should see:

```text
🚀 WebNovel Scraper API running at http://localhost:3001
📚 Adapters: FanMTL, WuxiaBox, WTR-Lab, Generic
```

### 3 · Start the frontend

```bash
cd client
npm install
npm run dev          # → http://localhost:5173
```

### 4 · Scrape your first novel

1. Open **http://localhost:5173** and go to **New Scrape**.
2. Paste the novel's **main/table-of-contents page** URL, not a single chapter.
3. Review the detected metadata, choose your chapters, tune the delays, and hit **Start**.
4. Watch progress in **Queue**, then open **EPUB Builder** → **Generate EPUB**.

### 🐳 Run the backend with Docker

The included `Dockerfile` is based on the official Playwright image, so browsers come pre-installed.

```bash
cd server
docker build -t webnovel-scraper-api .
docker run -p 3001:3001 webnovel-scraper-api
```

### ⚙️ Configuration

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `3001` | API listen port |
| `NODE_ENV` | server | `development` | Set to `development` to expose error messages in 500 responses |
| `VITE_API_URL` | client | `http://localhost:3001/api` | Point the UI at a remote backend |

**Runtime settings** (Settings page, saved to `localStorage`):

| Setting | Default | Description |
|---|---|---|
| Delay | `3000 ms` | Base pause between requests |
| Concurrency | `2` | Stored with the job; chapters are currently processed one at a time |
| Max retries | `3` | Attempts per chapter before it is marked failed |
| Block images | `false` | Skip image downloads for faster scraping |
| Proxy | off | `http://host:port` or `socks5://host:port` |
| EPUB font / size / line-height | Georgia / 16 / 1.8 | Default reading typography |

**Per-job options** (wizard "Configure" step): `delayMin` (2000 ms), `delayMax` (6000 ms), `concurrency` (2), `maxRetries` (3).

---

## 📡 API Reference

Base URL: `http://localhost:3001/api`

| Method | Endpoint | Description |
|:---:|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/adapters` | List registered adapters and their domains |
| `POST` | `/detect` | Detect which adapter matches a URL |
| `POST` | `/metadata` | Extract title, author, cover, description, genres, status |
| `POST` | `/chapters` | Discover the full chapter list |
| `POST` | `/scrape` | Start a background scraping job → `{ jobId }` |
| `GET` | `/scrape/:jobId/status` | Job status and per-chapter progress |
| `POST` | `/scrape/:jobId/pause` | Pause a running job |
| `POST` | `/scrape/:jobId/resume` | Resume a paused job |
| `POST` | `/scrape/:jobId/cancel` | Cancel a job |
| `POST` | `/scrape/:jobId/retry` | Re-queue only the failed chapters |
| `GET` | `/scrape/:jobId/chapters` | Fetch cleaned content of completed chapters |
| `GET` | `/jobs` | List all jobs |
| `DELETE` | `/jobs/:jobId` | Delete a job |

<details>
<summary><b>📥 Example: start a scrape job</b></summary>

```bash
curl -X POST http://localhost:3001/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/novel/my-novel",
    "novelInfo": { "title": "My Novel", "author": "Someone" },
    "chapters": [
      { "index": 1, "title": "Chapter 1", "url": "https://example.com/novel/my-novel/chapter-1" },
      { "index": 2, "title": "Chapter 2", "url": "https://example.com/novel/my-novel/chapter-2" }
    ],
    "options": { "delayMin": 2000, "delayMax": 6000, "maxRetries": 3 }
  }'
```

```json
{ "jobId": "7f3a9c12-…", "status": "started" }
```

</details>

<details>
<summary><b>📤 Example: job status response</b></summary>

```json
{
  "id": "7f3a9c12-…",
  "status": "running",
  "progress": { "total": 120, "completed": 37, "failed": 1, "current": 39 },
  "chapters": [
    { "index": 1, "title": "Chapter 1", "status": "completed", "wordCount": 1842 }
  ]
}
```

</details>

**Error semantics:** navigation blocked by anti-bot protection returns **`403`** with `"blocked": true`; other upstream failures return **`502`**; missing input returns **`400`**.

---

## 🧩 Writing a New Adapter

Every site lives in its own class under `server/adapters/`. To add one:

**1. Create the class**

```js
// server/adapters/MySiteAdapter.js
const BaseAdapter = require('./BaseAdapter');

class MySiteAdapter extends BaseAdapter {
  static siteMatch(url)        { return /mysite\.com/i.test(url); }
  static get siteName()        { return 'MySite'; }
  static get siteId()          { return 'mysite'; }
  static get siteDescription() { return 'My favourite novel site'; }
  static get domains()         { return ['mysite.com']; }

  async extractMetadata(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return await page.evaluate(() => ({
      title:       document.querySelector('h1')?.textContent.trim() ?? '',
      author:      document.querySelector('.author')?.textContent.trim() ?? '',
      coverUrl:    document.querySelector('.cover img')?.src ?? '',
      description: document.querySelector('.summary')?.textContent.trim() ?? '',
      genres:      [...document.querySelectorAll('.genre a')].map(a => a.textContent.trim()),
      status:      document.querySelector('.status')?.textContent.trim() ?? '',
    }));
  }

  async discoverChapters(page, url) {
    // return [{ index: 1, title: 'Chapter 1', url: 'https://…' }, …]
  }

  async extractContent(page, url) {
    // return { title, html, wordCount, images: [] }
  }
}

module.exports = MySiteAdapter;
```

**2. Register it** in `server/adapters/registry.js`, **before** `GenericAdapter`:

```js
const adapters = [
  FanMTLAdapter,
  WuxiaBoxAdapter,
  WTRLabAdapter,
  MySiteAdapter,      // ← add here
  GenericAdapter,     // always last
];
```

> 💡 `BaseAdapter` ships helpers you can reuse: `waitForContent()`, `safeText()`, `safeAttr()` and `generateId()`.

### Supported sites

| Adapter | Domains | Strategy |
|---|---|---|
| **FanMTL** | `fanmtl.com` | Playwright, with auto-scroll to load lazy chapter lists |
| **WuxiaBox** | `wuxiabox.com` / `.net` | HTTP + Cheerio for metadata and chapters, Playwright for content |
| **WTR-Lab** | `wtr-lab.com` / `.net` | Playwright, multi-selector fallbacks |
| **Generic** | any | Readability-style heuristics (`article`, `main`, `.content`, `.post-content`, …) |

---

## 📂 Project Structure

```text
WebScrapper/
├── server/                          # Node.js + Express API
│   ├── index.js                     # Routes, middleware, graceful shutdown
│   ├── Dockerfile                   # Playwright-based image
│   ├── adapters/
│   │   ├── BaseAdapter.js           # Abstract interface + helpers
│   │   ├── registry.js              # Adapter discovery (first match wins)
│   │   ├── FanMTLAdapter.js
│   │   ├── WuxiaBoxAdapter.js
│   │   ├── WTRLabAdapter.js
│   │   └── GenericAdapter.js        # Heuristic fallback
│   └── services/
│       ├── browserEngine.js         # Stealth Playwright + Cloudflare handling
│       ├── contentCleaner.js        # Cheerio + DOMPurify pipeline
│       └── jobQueue.js              # In-memory queue, pause/resume/retry
│
└── client/                          # React 19 + Vite SPA
    ├── vercel.json                  # SPA rewrite rules
    └── src/
        ├── App.jsx                  # Router + lazy-loaded pages
        ├── stores/appStore.js       # Zustand: theme, sidebar, toasts, settings
        ├── services/
        │   ├── apiClient.js         # Typed fetch wrapper with timeouts
        │   ├── database.js          # Dexie schema + CRUD
        │   └── epubGenerator.js     # EPUB 3 packaging (JSZip)
        ├── components/              # Sidebar · Navbar · Toast
        └── pages/
            ├── Dashboard.jsx        ├── NewScrape.jsx   (5-step wizard)
            ├── Queue.jsx            ├── Projects.jsx
            ├── Library.jsx          ├── EPUBBuilder.jsx
            ├── EPUBReader.jsx       ├── History.jsx
            └── Settings.jsx
```

---

## 🔐 Security & Responsible Use

- **Sanitised output**: all scraped HTML passes through a strict **DOMPurify** allow-list (tags *and* attributes), and inline event handlers are stripped.
- **`helmet`** is enabled on the API. `cors` is currently open (`origin: true`), which suits local development. **Restrict it before exposing the server publicly.**
- **Local-first data**: your library is stored in your browser's IndexedDB, not on the server. The server keeps job state **in memory only**, so it is cleared on restart.

> [!IMPORTANT]
> This tool is intended for **personal use, archiving, and offline reading**. Always respect each site's **Terms of Service** and `robots.txt`, and support authors and translators where you can. The built-in delays and stealth features exist to avoid overloading servers, not to bypass paywalls or redistribute content.

---

## 🗺️ Roadmap

Ideas that fit naturally with the current architecture:

- [ ] **Persistent job storage** (SQLite/Redis), so jobs survive a server restart
- [ ] **True parallel scraping**: the `concurrency` option is accepted today, but chapters are processed sequentially
- [ ] **Wire up cover embedding**: fetch `coverUrl` into a Blob and pass it as `coverBlob` (the generator already supports it)
- [ ] **Duplicate-chapter detection**: connect the existing MD5 hash and `isDuplicate()` helper
- [ ] **Image embedding** into EPUB packages (currently stored as references)
- [ ] **Test suite** (adapter contract tests against saved HTML fixtures)
- [ ] **Locked-down CORS + optional API key** for public deployments
- [ ] **More adapters**: contributions welcome!

---

## 🤝 Contributing

1. **Fork** the repository and create a branch: `git checkout -b feat/my-adapter`
2. Make your change. For new sites, follow the [adapter guide](#-writing-a-new-adapter).
3. Test manually against a real novel page (metadata → chapters → 2–3 chapter scrape → EPUB).
4. Open a **Pull Request** describing the site and any selector quirks.

---

## 📄 License

The server declares the **ISC** license in `server/package.json`. A top-level `LICENSE` file has not been added yet; add one before publishing to make the terms explicit.

---

<div align="center">

**Built with ☕ by [Darshil](https://github.com/darshil158)**

*If this project saved you some time, consider giving it a ⭐*

</div>
