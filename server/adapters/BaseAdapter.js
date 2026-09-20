const { v4: uuidv4 } = require('uuid');

/**
 * BaseAdapter — Abstract class defining the interface for all site adapters.
 * Each adapter encapsulates site-specific scraping logic for a particular novel platform.
 * 
 * To create a new adapter:
 * 1. Extend BaseAdapter
 * 2. Implement all static and instance methods
 * 3. Register in registry.js
 */
class BaseAdapter {
  /**
   * Test whether the given URL matches this adapter's site
   * @param {string} url - The novel page URL
   * @returns {boolean}
   */
  static siteMatch(url) {
    throw new Error('siteMatch() must be implemented');
  }

  /** @returns {string} Human-readable site name */
  static get siteName() {
    throw new Error('siteName getter must be implemented');
  }

  /** @returns {string} Site identifier slug */
  static get siteId() {
    throw new Error('siteId getter must be implemented');
  }

  /** @returns {string} Description of the site */
  static get siteDescription() {
    return '';
  }

  /** @returns {string[]} Domains supported */
  static get domains() {
    return [];
  }

  /**
   * Extract novel metadata from the page
   * @param {import('playwright').Page} page - Playwright page instance
   * @param {string} url - The novel URL
   * @returns {Promise<{title: string, author: string, coverUrl: string, description: string, genres: string[], status: string, chapters: number}>}
   */
  async extractMetadata(page, url) {
    throw new Error('extractMetadata() must be implemented');
  }

  /**
   * Discover all chapters from the novel page
   * @param {import('playwright').Page} page - Playwright page instance  
   * @param {string} url - The novel URL
   * @returns {Promise<Array<{index: number, title: string, url: string}>>}
   */
  async discoverChapters(page, url) {
    throw new Error('discoverChapters() must be implemented');
  }

  /**
   * Extract content from a single chapter page
   * @param {import('playwright').Page} page - Playwright page instance
   * @param {string} url - The chapter URL
   * @returns {Promise<{title: string, html: string, wordCount: number, images: string[]}>}
   */
  async extractContent(page, url) {
    throw new Error('extractContent() must be implemented');
  }

  /**
   * Helper: Wait for page to load with common patterns
   */
  async waitForContent(page, selector, timeout = 15000) {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Get text content safely
   */
  async safeText(page, selector, fallback = '') {
    try {
      const el = await page.$(selector);
      if (!el) return fallback;
      return (await el.textContent()).trim() || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Helper: Get attribute safely
   */
  async safeAttr(page, selector, attr, fallback = '') {
    try {
      const el = await page.$(selector);
      if (!el) return fallback;
      return (await el.getAttribute(attr)) || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Helper: Generate unique ID
   */
  generateId() {
    return uuidv4();
  }
}

module.exports = BaseAdapter;
