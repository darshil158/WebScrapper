/**
 * WebNovel Scraper — Backend Server
 * Express REST API for web novel scraping, content extraction, and job management.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { detectAdapter, listAdapters } = require('./adapters/registry');
const BrowserEngine = require('./services/browserEngine');
const ContentCleaner = require('./services/contentCleaner');
const { JobQueue } = require('./services/jobQueue');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const browserEngine = new BrowserEngine({
  headless: true,
  blockAds: true,
  blockImages: false,
});

const jobQueue = new JobQueue();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// API Routes
// ============================================================

/**
 * GET /api/health — Server health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/adapters — List all registered adapters
 */
app.get('/api/adapters', (req, res) => {
  res.json({ adapters: listAdapters() });
});

/**
 * POST /api/detect — Detect site adapter from URL
 */
app.post('/api/detect', (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const { info } = detectAdapter(url);
    res.json({ adapter: info, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/metadata — Extract novel metadata
 */
app.post('/api/metadata', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  let page, context;
  try {
    const { AdapterClass } = detectAdapter(url);
    const adapter = new AdapterClass();

    ({ page, context } = await browserEngine.createStealthPage());
    const navResult = await browserEngine.navigateWithRetry(page, url);

    if (!navResult.success) {
      return res.status(navResult.blocked ? 403 : 502).json({
        error: navResult.error,
        blocked: navResult.blocked || false,
      });
    }

    const metadata = await adapter.extractMetadata(page, url);
    res.json({ metadata, adapter: AdapterClass.siteName });
  } catch (err) {
    console.error('[metadata]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (context) await context.close().catch(() => {});
  }
});

/**
 * POST /api/chapters — Discover chapters from novel page
 */
app.post('/api/chapters', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  let page, context;
  try {
    const { AdapterClass } = detectAdapter(url);
    const adapter = new AdapterClass();

    ({ page, context } = await browserEngine.createStealthPage());
    const navResult = await browserEngine.navigateWithRetry(page, url);

    if (!navResult.success) {
      return res.status(navResult.blocked ? 403 : 502).json({
        error: navResult.error,
        blocked: navResult.blocked || false,
      });
    }

    const chapters = await adapter.discoverChapters(page, url);
    res.json({ chapters, total: chapters.length });
  } catch (err) {
    console.error('[chapters]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (context) await context.close().catch(() => {});
  }
});

/**
 * POST /api/scrape — Start a scraping job
 */
app.post('/api/scrape', async (req, res) => {
  const { url, novelInfo, chapters, options } = req.body;
  if (!chapters || !chapters.length) {
    return res.status(400).json({ error: 'Chapters are required' });
  }

  try {
    const { AdapterClass } = detectAdapter(url);
    const jobId = jobQueue.createJob(novelInfo || {}, chapters, options);

    // Start scraping in background
    const adapter = new AdapterClass();
    setImmediate(async () => {
      let page, context;
      try {
        ({ page, context } = await browserEngine.createStealthPage());

        await jobQueue.startJob(jobId, async (chapterUrl) => {
          await browserEngine.navigateWithRetry(page, chapterUrl);
          const raw = await adapter.extractContent(page, chapterUrl);
          const cleaned = ContentCleaner.clean(raw.html, chapterUrl);
          return {
            title: raw.title,
            html: cleaned.html,
            wordCount: cleaned.wordCount,
            hash: cleaned.hash,
            images: raw.images || [],
          };
        });
      } catch (err) {
        console.error(`[scrape:${jobId}]`, err.message);
      } finally {
        if (context) await context.close().catch(() => {});
      }
    });

    res.json({ jobId, status: 'started' });
  } catch (err) {
    console.error('[scrape]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/scrape/:jobId/status — Get job status
 */
app.get('/api/scrape/:jobId/status', (req, res) => {
  const job = jobQueue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/**
 * POST /api/scrape/:jobId/pause
 */
app.post('/api/scrape/:jobId/pause', (req, res) => {
  const success = jobQueue.pauseJob(req.params.jobId);
  res.json({ success });
});

/**
 * POST /api/scrape/:jobId/resume
 */
app.post('/api/scrape/:jobId/resume', (req, res) => {
  const success = jobQueue.resumeJob(req.params.jobId);
  res.json({ success });
});

/**
 * POST /api/scrape/:jobId/cancel
 */
app.post('/api/scrape/:jobId/cancel', (req, res) => {
  const success = jobQueue.cancelJob(req.params.jobId);
  res.json({ success });
});

/**
 * POST /api/scrape/:jobId/retry
 */
app.post('/api/scrape/:jobId/retry', (req, res) => {
  const success = jobQueue.retryFailed(req.params.jobId);
  res.json({ success });
});

/**
 * GET /api/scrape/:jobId/chapters — Get scraped chapter content
 */
app.get('/api/scrape/:jobId/chapters', (req, res) => {
  const content = jobQueue.getJobContent(req.params.jobId);
  if (!content) return res.status(404).json({ error: 'Job not found' });
  res.json({ chapters: content });
});

/**
 * GET /api/jobs — List all jobs
 */
app.get('/api/jobs', (req, res) => {
  res.json({ jobs: jobQueue.getAllJobs() });
});

/**
 * DELETE /api/jobs/:jobId — Delete a job
 */
app.delete('/api/jobs/:jobId', (req, res) => {
  const success = jobQueue.deleteJob(req.params.jobId);
  res.json({ success });
});

// ============================================================
// Error handling
// ============================================================
app.use((err, req, res, next) => {
  console.error('[error]', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[server] Shutting down...');
  await browserEngine.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await browserEngine.close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 WebNovel Scraper API running at http://localhost:${PORT}`);
  console.log(`📚 Adapters: ${listAdapters().map(a => a.name).join(', ')}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
