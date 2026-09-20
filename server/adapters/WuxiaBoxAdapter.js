const BaseAdapter = require('./BaseAdapter');

class WuxiaBoxAdapter extends BaseAdapter {
  static siteMatch(url) {
    return /wuxiabox\.(com|net)/i.test(url);
  }

  static get siteName() { return 'WuxiaBox'; }
  static get siteId() { return 'wuxiabox'; }
  static get siteDescription() { return 'Wuxia and Xianxia web novels'; }
  static get domains() { return ['wuxiabox.com', 'wuxiabox.net']; }

  async extractMetadata(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.waitForContent(page, 'h1, .novel-title, .book-name');

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
        title: getText(['h1', '.novel-title', '.book-name', '.truyen-title']),
        author: getText(['.author', '.info a[href*="author"]', '[class*="author"]', '.fic-header a']),
        coverUrl: getAttr(['.book img', '.novel-cover img', '.summary_image img', 'img.cover'], 'src'),
        description: getText(['.description', '.novel-synopsis', '.summary .content', '[class*="desc"]']),
        genres: Array.from(document.querySelectorAll('.genre a, .tags a, [class*="genre"] a, .categories a'))
          .map(a => a.textContent.trim()).filter(Boolean),
        status: getText(['.status', '[class*="status"]', '.post-status']),
      };
    });
  }

  async discoverChapters(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Try to load all chapters
    try {
      const loadAllBtn = await page.$('.show-more, [class*="load-all"], [class*="show-all"], button:has-text("Load All")');
      if (loadAllBtn) {
        await loadAllBtn.click();
        await page.waitForTimeout(3000);
      }
    } catch {}

    // Try pagination
    let hasNextPage = true;
    while (hasNextPage) {
      try {
        const nextBtn = await page.$('.pagination .next:not(.disabled), .chapter-pagination .next');
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForTimeout(2000);
        } else {
          hasNextPage = false;
        }
      } catch {
        hasNextPage = false;
      }
    }

    return await page.evaluate((baseUrl) => {
      const links = document.querySelectorAll('.chapter-list a, .list-chapter a, .wp-manga-chapter a, [class*="chapter-item"] a, .listing-chapters_wrap a');
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
    await this.waitForContent(page, '.chapter-content, .text-left, .reading-content, .content, article');

    return await page.evaluate(() => {
      const getText = (selectors) => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el?.textContent?.trim()) return el.textContent.trim();
        }
        return '';
      };

      const contentEl = document.querySelector('.chapter-content, .text-left, .reading-content, .content-area, article .entry-content');
      if (!contentEl) return { title: '', html: '<p>Content not found</p>', wordCount: 0, images: [] };

      const removeSelectors = [
        'script', 'style', 'iframe', 'noscript',
        '.ads', '.ad', '[class*="adsbygoogle"]',
        '.nav', '.navigation', '.breadcrumb',
        '.comments', '[class*="comment"]',
        '.social', '.share', '.footer', '.header',
        '.related', '.recommendation',
        '[class*="popup"]', '.watermark',
      ];

      removeSelectors.forEach(sel => {
        contentEl.querySelectorAll(sel).forEach(el => el.remove());
      });

      const images = Array.from(contentEl.querySelectorAll('img'))
        .map(img => img.src).filter(Boolean);
      const text = contentEl.textContent || '';

      return {
        title: getText(['h1', '.chapter-title', '[class*="chapter"] h1']),
        html: contentEl.innerHTML,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        images,
      };
    });
  }
}

module.exports = WuxiaBoxAdapter;
