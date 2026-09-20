/**
 * API Client — Fetch-based HTTP client for communicating with the scraper backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class APIClient {
  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
    this.timeout = 60000;
  }

  async request(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const error = new Error(data.error || `HTTP ${res.status}`);
        error.status = res.status;
        error.data = data;
        error.blocked = data.blocked || false;
        throw error;
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. The server may be busy or unreachable.');
      }
      throw err;
    }
  }

  // Health check
  health() {
    return this.request('/health');
  }

  // Adapters
  getAdapters() {
    return this.request('/adapters');
  }

  // Site detection
  detectSite(url) {
    return this.request('/detect', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  // Metadata extraction
  getMetadata(url) {
    return this.request('/metadata', {
      method: 'POST',
      body: JSON.stringify({ url }),
      timeout: 120000,
    });
  }

  // Chapter discovery
  getChapters(url) {
    return this.request('/chapters', {
      method: 'POST',
      body: JSON.stringify({ url }),
      timeout: 120000,
    });
  }

  // Start scraping
  startScrape(url, novelInfo, chapters, options = {}) {
    return this.request('/scrape', {
      method: 'POST',
      body: JSON.stringify({ url, novelInfo, chapters, options }),
    });
  }

  // Job status
  getJobStatus(jobId) {
    return this.request(`/scrape/${jobId}/status`);
  }

  // Pause job
  pauseJob(jobId) {
    return this.request(`/scrape/${jobId}/pause`, { method: 'POST' });
  }

  // Resume job
  resumeJob(jobId) {
    return this.request(`/scrape/${jobId}/resume`, { method: 'POST' });
  }

  // Cancel job
  cancelJob(jobId) {
    return this.request(`/scrape/${jobId}/cancel`, { method: 'POST' });
  }

  // Retry failed
  retryFailed(jobId) {
    return this.request(`/scrape/${jobId}/retry`, { method: 'POST' });
  }

  // Get scraped chapters
  getScrapedChapters(jobId) {
    return this.request(`/scrape/${jobId}/chapters`, { timeout: 120000 });
  }

  // List all jobs
  getJobs() {
    return this.request('/jobs');
  }

  // Delete job
  deleteJob(jobId) {
    return this.request(`/jobs/${jobId}`, { method: 'DELETE' });
  }
}

const apiClient = new APIClient();
export default apiClient;
