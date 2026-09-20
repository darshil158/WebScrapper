# WebNovel Scraper & EPUB Creator

A premium SaaS-grade tool to scrape web novels and generate standards-compliant EPUB 3 files.

## Features

- **Multi-Site Support**: Built-in adapters for FanMTL, WuxiaBox, and WTR-Lab.
- **Generic Fallback**: Capable of scraping from almost any unstructured novel site using Readability-like heuristic extraction.
- **Stealth Browsing**: Uses Playwright with anti-detection fingerprinting to navigate through anti-bot systems like Cloudflare.
- **EPUB 3 Generator**: Assembles valid, semantic EPUBs offline directly in the browser (JSZip).
- **Built-in Reader**: Fully-featured reader with light/dark/sepia themes, font adjustments, and progress tracking.
- **Offline First**: All scraped content, metadata, and job history are persisted locally via IndexedDB (Dexie.js).
- **Premium UI**: Modern glassmorphic interface with responsive layouts, fluid animations, and data visualization.

## Architecture

- **Frontend**: React 19 + Vite, Zustand (state), Dexie.js (local DB).
- **Backend**: Node.js + Express, Playwright (scraper), Cheerio + DOMPurify (sanitization).

## Prerequisites

- **Node.js**: v18+
- **Playwright**: Browsers must be installed for scraping capabilities.

## Setup & Running

1. **Install backend dependencies and run the API server**:
   ```bash
   cd server
   npm install
   npx playwright install chromium
   npm run dev
   ```
   The backend will start on `http://localhost:3001`.

2. **Install frontend dependencies and start the UI**:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   The frontend will start on `http://localhost:5173`.

## Adding a New Site Adapter

Adapters are modular plugins in `server/adapters/`. To add a new one:

1. Create a new class extending `BaseAdapter`.
2. Implement the static methods: `siteMatch`, `siteName`, `siteId`.
3. Implement the extraction methods: `extractMetadata`, `discoverChapters`, `extractContent`.
4. Register the class in `server/adapters/registry.js`.

See the existing adapters (e.g., `FanMTLAdapter.js`) for reference.

## Disclaimers

This tool is for personal use, archiving, and offline reading. Always adhere to the Terms of Service of the sites you are interacting with. Scraping operations may be blocked by site defenses; the software will attempt to handle this gracefully.
