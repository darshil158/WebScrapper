const BaseAdapter = require('./BaseAdapter');

/**
 * GenericAdapter — Fallback adapter using heuristics to scrape novel content
 * from any site that doesn't have a specific adapter. Uses Readability-like
 * algorithms to identify main content blocks.
 */
class GenericAdapter extends BaseAdapter {
  static siteMatch(url) {
    // Generic always matches as a fallback — lowest priority
    return true;
  }

  static get siteName() { return 'Generic'; }
  static get siteId() { return 'generic'; }
  static get siteDescription() { return 'Generic adapter for unsupported novel sites (heuristic-based)'; }
  static get domains() { return ['*']; }

  async extractMetadata(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

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

      // Try multiple common patterns for title
      const title = getText([
        'h1', 
        'meta[property="og:title"]',
        '.novel-title', '.book-name', '.story-title',
        '[class*="title"] h1',
      ]) || document.title.split('|')[0].split('-')[0].trim();

      // Try to find author
      const author = getText([
        '.author', '[class*="author"]',
        'meta[name="author"]',
        'a[href*="author"]',
        '.writer', '.creator',
      ]) || getAttr(['meta[name="author"]'], 'content');

      // Cover image - look for large images near the title
      const coverUrl = getAttr([
        'meta[property="og:image"]',
        '.cover img', '.thumbnail img',
        'img[class*="cover"]', 'img[class*="thumb"]',
      ], 'src') || getAttr(['meta[property="og:image"]'], 'content');

      // Description
      const description = getText([
        '.description', '.synopsis', '.summary',
        '[class*="desc"]', '[class*="synopsis"]',
      ]) || getAttr(['meta[property="og:description"]', 'meta[name="description"]'], 'content');

      // Genres/Tags
      const genres = Array.from(document.querySelectorAll(
        '.genre a, .tags a, [class*="genre"] a, [class*="tag"] a, .categories a'
      )).map(a => a.textContent.trim()).filter(Boolean);

      return { title, author, coverUrl, description, genres, status: 'Unknown' };
    });
  }

  async discoverChapters(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    return await page.evaluate((baseUrl) => {
      // Heuristic: Find all links that look like chapter links
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const chapterPatterns = [
        /chapter[_-]?\d+/i,
        /ch[_-]?\d+/i,
        /c\d+/i,
        /episode[_-]?\d+/i,
        /part[_-]?\d+/i,
        /\d+\.html?$/i,
      ];

      const titlePatterns = [
        /chapter\s*\d+/i,
        /ch\s*\.?\s*\d+/i,
        /episode\s*\d+/i,
        /part\s*\d+/i,
      ];

      const chapters = [];
      const seen = new Set();

      // First pass: look for links in common chapter list containers
      const containers = document.querySelectorAll(
        '.chapter-list, [class*="chapter"], .list-chapter, ul.chapters, .table-of-contents, .toc'
      );

      let candidateLinks = [];
      if (containers.length > 0) {
        containers.forEach(c => {
          candidateLinks.push(...Array.from(c.querySelectorAll('a[href]')));
        });
      }

      // Fallback: use all links and filter by pattern
      if (candidateLinks.length < 3) {
        candidateLinks = allLinks.filter(a => {
          const href = a.getAttribute('href') || '';
          const text = a.textContent.trim();
          return chapterPatterns.some(p => p.test(href)) || titlePatterns.some(p => p.test(text));
        });
      }

      candidateLinks.forEach((a) => {
        const href = a.getAttribute('href');
        if (!href || seen.has(href) || href === '#' || href.startsWith('javascript:')) return;
        seen.add(href);

        const title = a.textContent.trim().replace(/\s+/g, ' ');
        if (!title || title.length > 200) return;

        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        chapters.push({ index: chapters.length + 1, title, url: fullUrl });
      });

      return chapters;
    }, url);
  }

  async extractContent(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    return await page.evaluate(() => {
      const getText = (selectors) => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el?.textContent?.trim()) return el.textContent.trim();
        }
        return '';
      };

      // Readability-like: find the element with the most paragraph text
      const candidates = document.querySelectorAll('article, main, .content, .chapter-content, [class*="content"], .text-left, .post-content, .entry-content');
      let bestEl = null;
      let bestScore = 0;

      const scoreElement = (el) => {
        const paragraphs = el.querySelectorAll('p');
        let score = 0;
        paragraphs.forEach(p => {
          const text = p.textContent.trim();
          if (text.length > 20) score += text.length;
        });
        return score;
      };

      candidates.forEach(el => {
        const score = scoreElement(el);
        if (score > bestScore) {
          bestScore = score;
          bestEl = el;
        }
      });

      // Fallback: use body
      if (!bestEl || bestScore < 200) {
        const divs = document.querySelectorAll('div');
        divs.forEach(div => {
          const score = scoreElement(div);
          if (score > bestScore) {
            bestScore = score;
            bestEl = div;
          }
        });
      }

      if (!bestEl) return { title: '', html: '<p>Could not extract content</p>', wordCount: 0, images: [] };

      // Clone and clean
      const clone = bestEl.cloneNode(true);
      const removeSelectors = [
        'script', 'style', 'iframe', 'noscript', 'nav',
        '.ads', '.ad', '[class*="adsbygoogle"]', '[id*="ad-"]',
        '.navigation', '.breadcrumb', '.comments', '[class*="comment"]',
        '.social', '.share', '.footer', '.header', '.sidebar',
        '.related', '[class*="popup"]', '.watermark', 'form',
      ];

      removeSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      });

      const images = Array.from(clone.querySelectorAll('img'))
        .map(img => img.src).filter(Boolean);
      const text = clone.textContent || '';

      return {
        title: getText(['h1', 'h2', '.chapter-title']) || document.title,
        html: clone.innerHTML,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        images,
      };
    });
  }
}

module.exports = GenericAdapter;
