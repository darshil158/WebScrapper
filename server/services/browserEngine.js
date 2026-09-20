/**
 * Browser Engine — Manages Playwright browser instances with stealth configuration.
 * Implements fingerprint randomization, request interception, and anti-detection measures.
 */

let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = null;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
];

const LOCALES = ['en-US', 'en-GB', 'en-CA', 'en-AU'];
const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];

// Resources to block for speed
const BLOCKED_RESOURCE_TYPES = ['image', 'font', 'media'];
const BLOCKED_DOMAINS = [
  'googleads.', 'doubleclick.', 'adservice.', 'googlesyndication.',
  'facebook.com/tr', 'analytics.', 'tracking.', 'ads.',
  'tiktok.com', 'pinterest.com',
];

class BrowserEngine {
  constructor(options = {}) {
    this.browser = null;
    this.options = {
      headless: options.headless !== false,
      proxy: options.proxy || null,
      blockImages: options.blockImages ?? false,
      blockAds: options.blockAds ?? true,
      timeout: options.timeout || 30000,
      ...options,
    };
  }

  /**
   * Launch or get existing browser instance
   */
  async getBrowser() {
    if (this.browser?.isConnected()) return this.browser;

    if (!playwright) {
      throw new Error(
        'Playwright is not installed. Run: npm install playwright && npx playwright install chromium'
      );
    }

    const launchOptions = {
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--allow-running-insecure-content',
      ],
    };

    if (this.options.proxy) {
      launchOptions.proxy = { server: this.options.proxy };
    }

    this.browser = await playwright.chromium.launch(launchOptions);
    return this.browser;
  }

  /**
   * Create a new stealth page with randomized fingerprint
   */
  async createStealthPage() {
    const browser = await this.getBrowser();

    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
    const locale = LOCALES[Math.floor(Math.random() * LOCALES.length)];
    const timezone = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];

    const context = await browser.newContext({
      userAgent,
      viewport,
      locale,
      timezoneId: timezone,
      permissions: [],
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    });

    const page = await context.newPage();

    // Stealth: Override navigator properties
    await page.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      // Fake plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
      });

      // Fake languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Hide automation
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

      // Override chrome object
      window.chrome = {
        runtime: {},
        loadTimes: () => {},
        csi: () => {},
        app: {},
      };

      // Override permissions
      const originalQuery = window.navigator.permissions?.query;
      if (originalQuery) {
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      }
    });

    // Block unwanted resources
    if (this.options.blockAds || this.options.blockImages) {
      await page.route('**/*', (route) => {
        const url = route.request().url();
        const resourceType = route.request().resourceType();

        if (this.options.blockAds && BLOCKED_DOMAINS.some(d => url.includes(d))) {
          return route.abort();
        }
        if (this.options.blockImages && BLOCKED_RESOURCE_TYPES.includes(resourceType)) {
          return route.abort();
        }
        return route.continue();
      });
    }

    return { page, context };
  }

  /**
   * Navigate with Cloudflare detection and retry
   */
  async navigateWithRetry(page, url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: this.options.timeout,
        });

        // Check for Cloudflare challenge
        const status = response?.status();
        const title = await page.title();

        if (status === 403 || status === 503 || 
            title.includes('Cloudflare') || 
            title.includes('Just a moment') ||
            title.includes('Access denied')) {
          
          if (attempt < retries) {
            console.log(`[BrowserEngine] Cloudflare challenge detected on attempt ${attempt}, waiting...`);
            // Wait for challenge to resolve
            await page.waitForTimeout(8000 + Math.random() * 5000);
            
            // Check if challenge resolved
            const newTitle = await page.title();
            if (!newTitle.includes('Cloudflare') && !newTitle.includes('Just a moment')) {
              return { success: true, status: 200 };
            }
            continue;
          }
          return { 
            success: false, 
            status, 
            error: 'Access blocked by Cloudflare or anti-bot protection. The site may require manual access.',
            blocked: true,
          };
        }

        if (status === 404) {
          return { success: false, status: 404, error: 'Page not found (404)' };
        }

        if (status >= 400) {
          return { success: false, status, error: `HTTP error ${status}` };
        }

        return { success: true, status };
      } catch (err) {
        if (attempt === retries) {
          return { 
            success: false, 
            error: err.message,
            timeout: err.message.includes('Timeout'),
          };
        }
        await page.waitForTimeout(3000 * attempt);
      }
    }
  }

  /**
   * Random delay between requests
   */
  async randomDelay(min = 2000, max = 6000) {
    const delay = Math.floor(Math.random() * (max - min) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Close browser and cleanup
   */
  async close() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

module.exports = BrowserEngine;
