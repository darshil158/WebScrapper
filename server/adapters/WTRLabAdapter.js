const BaseAdapter = require('./BaseAdapter');

class WTRLabAdapter extends BaseAdapter {
  static siteMatch(url) {
    return /wtr-lab\.(com|net)/i.test(url);
  }

  static get siteName() { return 'WTR-Lab'; }
  static get siteId() { return 'wtrlab'; }
  static get siteDescription() { return 'Web novel translation lab'; }
  static get domains() { return ['wtr-lab.com']; }

  async extractMetadata(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.waitForContent(page, 'h1, [class*="title"], .novel-title');

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
        title: getText(['h1', '.novel-title', '[class*="title"] h1', '.series-title']),
        author: getText(['.author', '[class*="author"]', '.info-item:has-text("Author") span']),
        coverUrl: getAttr(['.cover img', '.novel-cover img', 'img[class*="cover"]', '.thumbnail img'], 'src'),
        description: getText(['.description', '.synopsis', '[class*="synopsis"]', '[class*="desc"]', '.summary']),
        genres: Array.from(document.querySelectorAll('.genre a, .tags a, [class*="tag"] a, .categories a'))
          .map(a => a.textContent.trim()).filter(Boolean),
        status: getText(['.status', '[class*="status"]']),
      };
    });
  }

  async discoverChapters(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // WTR-Lab may use AJAX pagination or expandable lists
    try {
      const expandBtn = await page.$('[class*="expand"], [class*="show-all"], [class*="load-more"]');
      if (expandBtn) {
        await expandBtn.click();
        await page.waitForTimeout(3000);
      }
    } catch {}

    return await page.evaluate((baseUrl) => {
      const links = document.querySelectorAll('.chapter-list a, [class*="chapter"] a, .list a[href*="chapter"], .episodes a');
      const chapters = [];
      const seen = new Set();

      links.forEach((a) => {
        const href = a.getAttribute('href');
        if (!href || seen.has(href)) return;
        seen.add(href);

        const title = a.textContent.trim().replace(/\s+/g, ' ');
        if (!title) return;

        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        chapters.push({ index: chapters.length + 1, title, url: fullUrl });
      });

      return chapters;
    }, url);
  }

  async extractContent(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.waitForContent(page, '.chapter-content, .content, article, [class*="chapter-body"]');

    return await page.evaluate(() => {
      const getText = (selectors) => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el?.textContent?.trim()) return el.textContent.trim();
        }
        return '';
      };

      const contentEl = document.querySelector('.chapter-content, .content, article, [class*="chapter-body"], .reading-content');
      if (!contentEl) return { title: '', html: '<p>Content not found</p>', wordCount: 0, images: [] };

      const removeSelectors = [
        'script', 'style', 'iframe', 'noscript',
        '.ads', '.ad', '[class*="adsbygoogle"]',
        '.nav', '.navigation', '.breadcrumb',
        '.comments', '[class*="comment"]',
        '.social', '.share', '.footer', '.header',
        '.related', '[class*="popup"]', '.watermark',
      ];

      removeSelectors.forEach(sel => {
        contentEl.querySelectorAll(sel).forEach(el => el.remove());
      });

      const images = Array.from(contentEl.querySelectorAll('img'))
        .map(img => img.src).filter(Boolean);
      const text = contentEl.textContent || '';

      return {
        title: getText(['h1', '.chapter-title', '[class*="chapter-title"]']),
        html: contentEl.innerHTML,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        images,
      };
    });
  }
}

module.exports = WTRLabAdapter;
