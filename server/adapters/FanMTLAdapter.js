const BaseAdapter = require('./BaseAdapter');

class FanMTLAdapter extends BaseAdapter {
  static siteMatch(url) {
    return /fanmtl\.com/i.test(url);
  }

  static get siteName() { return 'FanMTL'; }
  static get siteId() { return 'fanmtl'; }
  static get siteDescription() { return 'Machine-translated web novels'; }
  static get domains() { return ['fanmtl.com']; }

  async extractMetadata(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.waitForContent(page, 'h1, .novel-title, .book-name, [class*="title"]');

    return await page.evaluate(() => {
      const getText = (selectors) => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el?.textContent?.trim()) return el.textContent.trim();
        }
        return '';
      };

      const getAttr = (selectors, attr) => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el?.getAttribute(attr)) return el.getAttribute(attr);
        }
        return '';
      };

      return {
        title: getText(['h1', '.novel-title', '.book-name', '[class*="title"] h1', '.name']),
        author: getText(['.author', '[class*="author"]', '.info a', '.writer']),
        coverUrl: getAttr(['.novel-cover img', '.book-cover img', '.cover img', 'img[class*="cover"]'], 'src'),
        description: getText(['.novel-synopsis', '.description', '.summary', '[class*="synopsis"]', '[class*="desc"]']),
        genres: Array.from(document.querySelectorAll('.genre a, .tags a, [class*="genre"] a, [class*="tag"] a, .categories a'))
          .map(a => a.textContent.trim()).filter(Boolean),
        status: getText(['.status', '[class*="status"]', '.state']),
      };
    });
  }

  async discoverChapters(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Try to expand/show all chapters
    try {
      const expandBtn = await page.$('[class*="show-all"], [class*="view-all"], [class*="expand"], button:has-text("All Chapters")');
      if (expandBtn) await expandBtn.click();
      await page.waitForTimeout(2000);
    } catch {}

    // Scroll to load lazy chapters
    await this.autoScroll(page);

    return await page.evaluate((baseUrl) => {
      const links = document.querySelectorAll('.chapter-list a, [class*="chapter"] a, .list-chapter a, ul.chapters a, .volume a');
      const chapters = [];
      const seen = new Set();

      links.forEach((a, i) => {
        const href = a.getAttribute('href');
        if (!href || seen.has(href)) return;
        seen.add(href);

        const title = a.textContent.trim();
        if (!title) return;

        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        chapters.push({ index: chapters.length + 1, title, url: fullUrl });
      });

      return chapters;
    }, url);
  }

  async extractContent(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.waitForContent(page, '.chapter-content, .content, .text-content, [class*="chapter-body"], article');

    return await page.evaluate(() => {
      const getText = (selectors) => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el?.textContent?.trim()) return el.textContent.trim();
        }
        return '';
      };

      const contentEl = document.querySelector('.chapter-content, .content, .text-content, [class*="chapter-body"], article, .reading-content');
      if (!contentEl) return { title: '', html: '<p>Content not found</p>', wordCount: 0, images: [] };

      // Remove unwanted elements
      const removeSelectors = [
        'script', 'style', 'iframe', 'noscript',
        '.ads', '.ad', '[class*="adsbygoogle"]', '[id*="ad"]',
        '.nav', '.navigation', '.breadcrumb',
        '.comments', '.comment', '[class*="comment"]',
        '.social', '.share', '[class*="social"]',
        '.footer', '.header',
        '.related', '.recommendation',
        '[class*="popup"]', '[class*="modal"]',
        '.watermark', '[class*="watermark"]',
      ];

      removeSelectors.forEach(sel => {
        contentEl.querySelectorAll(sel).forEach(el => el.remove());
      });

      const images = Array.from(contentEl.querySelectorAll('img'))
        .map(img => img.src)
        .filter(Boolean);

      const text = contentEl.textContent || '';
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      return {
        title: getText(['h1', '.chapter-title', '[class*="chapter-title"]']),
        html: contentEl.innerHTML,
        wordCount,
        images,
      };
    });
  }

  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight || totalHeight > 20000) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });
  }
}

module.exports = FanMTLAdapter;
