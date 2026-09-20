/**
 * Job Queue Manager — In-memory scraping job queue with progress tracking.
 * Supports pause/resume/cancel, failed chapter retry, and concurrent scraping.
 */

const crypto = require('crypto');
const EventEmitter = require('events');

const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};

const CHAPTER_STATUS = {
  PENDING: 'pending',
  SCRAPING: 'scraping',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
    this.maxConcurrency = 2;
  }

  /**
   * Create a new scraping job
   */
  createJob(novelInfo, chapters, options = {}) {
    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      novelInfo,
      status: JOB_STATUS.PENDING,
      chapters: chapters.map(ch => ({
        ...ch,
        status: CHAPTER_STATUS.PENDING,
        content: null,
        error: null,
        retries: 0,
        scrapedAt: null,
      })),
      options: {
        concurrency: options.concurrency || this.maxConcurrency,
        delayMin: options.delayMin || 2000,
        delayMax: options.delayMax || 6000,
        maxRetries: options.maxRetries || 3,
        ...options,
      },
      progress: {
        total: chapters.length,
        completed: 0,
        failed: 0,
        current: 0,
      },
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      _abortController: null,
    };

    this.jobs.set(jobId, job);
    this.emit('job:created', { jobId, novelInfo });
    return jobId;
  }

  /**
   * Start processing a job
   */
  async startJob(jobId, scrapeFunction) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status === JOB_STATUS.RUNNING) throw new Error('Job already running');

    job.status = JOB_STATUS.RUNNING;
    job.startedAt = new Date().toISOString();
    job._abortController = { aborted: false };

    this.emit('job:started', { jobId });

    try {
      const pendingChapters = job.chapters.filter(
        ch => ch.status === CHAPTER_STATUS.PENDING || ch.status === CHAPTER_STATUS.FAILED
      );

      for (let i = 0; i < pendingChapters.length; i++) {
        // Check for pause/cancel
        if (job._abortController.aborted) break;
        if (job.status === JOB_STATUS.PAUSED) {
          // Wait until resumed or cancelled
          await new Promise(resolve => {
            const check = () => {
              if (job.status !== JOB_STATUS.PAUSED) return resolve();
              setTimeout(check, 500);
            };
            check();
          });
          if (job._abortController.aborted) break;
        }

        const chapter = pendingChapters[i];
        chapter.status = CHAPTER_STATUS.SCRAPING;
        job.progress.current = i + 1;
        this.emit('job:progress', { jobId, chapter: chapter.index, total: job.progress.total });

        try {
          const result = await scrapeFunction(chapter.url, chapter);
          chapter.content = result.html;
          chapter.title = result.title || chapter.title;
          chapter.wordCount = result.wordCount;
          chapter.images = result.images || [];
          chapter.status = CHAPTER_STATUS.COMPLETED;
          chapter.scrapedAt = new Date().toISOString();
          job.progress.completed++;
          this.emit('chapter:completed', { jobId, chapterIndex: chapter.index });
        } catch (err) {
          chapter.retries++;
          if (chapter.retries >= job.options.maxRetries) {
            chapter.status = CHAPTER_STATUS.FAILED;
            chapter.error = err.message;
            job.progress.failed++;
            this.emit('chapter:failed', { jobId, chapterIndex: chapter.index, error: err.message });
          } else {
            chapter.status = CHAPTER_STATUS.PENDING; // will retry
            i--; // retry same chapter
          }
        }

        // Random delay between chapters
        if (i < pendingChapters.length - 1 && !job._abortController.aborted) {
          const delay = Math.floor(
            Math.random() * (job.options.delayMax - job.options.delayMin) + job.options.delayMin
          );
          await new Promise(r => setTimeout(r, delay));
        }
      }

      if (job._abortController.aborted) {
        job.status = JOB_STATUS.CANCELLED;
      } else if (job.progress.failed > 0 && job.progress.completed === 0) {
        job.status = JOB_STATUS.FAILED;
        job.error = 'All chapters failed to scrape';
      } else {
        job.status = JOB_STATUS.COMPLETED;
      }
    } catch (err) {
      job.status = JOB_STATUS.FAILED;
      job.error = err.message;
    }

    job.completedAt = new Date().toISOString();
    this.emit('job:completed', { jobId, status: job.status });
    return job;
  }

  pauseJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== JOB_STATUS.RUNNING) return false;
    job.status = JOB_STATUS.PAUSED;
    this.emit('job:paused', { jobId });
    return true;
  }

  resumeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== JOB_STATUS.PAUSED) return false;
    job.status = JOB_STATUS.RUNNING;
    this.emit('job:resumed', { jobId });
    return true;
  }

  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job._abortController) job._abortController.aborted = true;
    job.status = JOB_STATUS.CANCELLED;
    this.emit('job:cancelled', { jobId });
    return true;
  }

  retryFailed(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.chapters.forEach(ch => {
      if (ch.status === CHAPTER_STATUS.FAILED) {
        ch.status = CHAPTER_STATUS.PENDING;
        ch.error = null;
        ch.retries = 0;
        job.progress.failed--;
      }
    });
    return true;
  }

  getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    // Return safe copy without internal state
    return {
      id: job.id,
      novelInfo: job.novelInfo,
      status: job.status,
      chapters: job.chapters.map(ch => ({
        index: ch.index,
        title: ch.title,
        url: ch.url,
        status: ch.status,
        wordCount: ch.wordCount,
        error: ch.error,
        scrapedAt: ch.scrapedAt,
      })),
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
    };
  }

  getJobContent(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return job.chapters
      .filter(ch => ch.status === CHAPTER_STATUS.COMPLETED)
      .map(ch => ({
        index: ch.index,
        title: ch.title,
        content: ch.content,
        wordCount: ch.wordCount,
        images: ch.images || [],
      }));
  }

  getAllJobs() {
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      novelInfo: job.novelInfo,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    }));
  }

  deleteJob(jobId) {
    return this.jobs.delete(jobId);
  }
}

module.exports = { JobQueue, JOB_STATUS, CHAPTER_STATUS };
