const cheerio = require('cheerio');
const BaseAdapter = require('./BaseAdapter');

/**
 * WuxiaBox Adapter — HTTP + Cheerio for metadata/chapters, Playwright for content.
 * Supports wuxiabox.com and wuxiabox.net.
 *
 * Novel page structure:
 *   - Title:       h1.novel-title
 *   - Author:      span[itemprop="author"]
 *   - Cover:       .cover img (data-src attribute)
 *   - Description: .summary .content
 *   - Genres:      .categories a.property-item
 *   - Status:      .header-stats strong (text: Ongoing / Completed)
 *   - Chapters:    ul.chapter-list li a  (paginated via AJAX endpoint)
 *
 * Chapter content structure:
 *   - Content:     div.chapter-content
 *   - Title:       .chapter-header .titles h2
 */

const BASE_URL = 'https://www.wuxiabox.com';

class WuxiaBoxAdapter extends BaseAdapter {
  static siteMatch(url) {
    return /wuxiabox\.(com|net)/i.test(url);
  }

  static get siteName() { return 'WuxiaBox'; }
  static get siteId() { return 'wuxiabox'; }
  static get siteDescription() { return 'Wuxia and Xianxia web novels'; }
  static get domains() { return ['wuxiabox.com', 'wuxiabox.net']; }

  /**
   * Extract the novel slug (e.g. "jp12431") from a WuxiaBox URL.
   * Handles both /novel/jp12431.html and /novel/jp12431_1.html patterns.
   */
  _extractNovelId(url) {
    const match = url.match(/\/novel\/([a-zA-Z0-9]+?)(?:_\d+)?\.html/);
    return match ? match[1] : null;
  }

  /**
   * Fetch a URL and return a cheerio-parsed DOM.
   */
  async _fetchPage(url) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const html = await res.text();
    return cheerio.load(html);
  }

  /**
   * Extract novel metadata using HTTP + Cheerio (no browser needed).
   */
  async extractMetadata(_page, url) {
    const $ = await this._fetchPage(url);

    const title = $('h1.novel-title').text().trim() || $('h1').first().text().trim();
    const author = $('span[itemprop="author"]').text().trim() || $('.author span').last().text().trim();

    // Cover image — WuxiaBox uses lazy loading with data-src
    let coverUrl = $('.cover img').attr('data-src') || $('.cover img').attr('src') || '';
    if (coverUrl && !coverUrl.startsWith('http')) {
      coverUrl = BASE_URL + coverUrl;
    }
    // Skip placeholder images
    if (coverUrl.includes('placeholder')) coverUrl = '';

    const description = $('.summary .content').text().trim() || $('.description').text().trim();

    const genres = [];
    $('.categories a.property-item').each((_, el) => {
      const g = $(el).text().trim();
      if (g) genres.push(g);
    });

    // Status — found in .header-stats
    let status = '';
    $('.header-stats span').each((_, el) => {
      const small = $(el).find('small').text().trim().toLowerCase();
      if (small === 'status') {
        status = $(el).find('strong').text().trim();
      }
    });

    // Chapter count
    let chapterCount = 0;
    $('.header-stats span').each((_, el) => {
      const small = $(el).find('small').text().trim().toLowerCase();
      if (small === 'chapters') {
        const num = $(el).find('strong').text().replace(/\D/g, '');
        chapterCount = parseInt(num, 10) || 0;
      }
    });

    return { title, author, coverUrl, description, genres, status, chapters: chapterCount };
  }

  /**
   * Discover all chapters using HTTP + Cheerio with pagination support.
   * WuxiaBox paginates chapters via /e/extend/fy.php?page=N&wjm=NOVEL_ID
   */
  async discoverChapters(_page, url) {
    const novelId = this._extractNovelId(url);
    if (!novelId) throw new Error('Could not extract novel ID from URL: ' + url);

    const chapters = [];
    const seen = new Set();

    /**
     * Parse chapter links from a cheerio DOM.
     */
    const parseChapters = ($) => {
      $('ul.chapter-list li a').each((_, el) => {
        const href = $(el).attr('href');
        if (!href || seen.has(href)) return;
        seen.add(href);

        const chapterNo = $(el).find('.chapter-no').text().trim();
        const chapterTitle = $(el).find('.chapter-title').text().trim();
        const title = chapterTitle || `Chapter ${chapterNo}`;
        const fullUrl = href.startsWith('http') ? href : BASE_URL + href;

        chapters.push({
          index: parseInt(chapterNo, 10) || chapters.length + 1,
          title,
          url: fullUrl,
        });
      });
    };

    // Page 0 = first page of chapters (loaded with the novel page itself)
    console.log(`[WuxiaBox] Fetching chapter page 0 for ${novelId}...`);
    const $first = await this._fetchPage(url);
    parseChapters($first);

    // Check if there are more pages by looking at the pagination
    const totalPages = this._countPages($first);
    console.log(`[WuxiaBox] Found ${totalPages} pagination pages for ${novelId}`);

    // Fetch remaining pages
    for (let page = 1; page < totalPages; page++) {
      console.log(`[WuxiaBox] Fetching chapter page ${page + 1} for ${novelId}...`);
      try {
        const pageUrl = `${BASE_URL}/e/extend/fy.php?page=${page}&wjm=${novelId}`;
        const $page = await this._fetchPage(pageUrl);
        parseChapters($page);
        // Small delay to be polite
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.warn(`[WuxiaBox] Failed to fetch page ${page + 1}:`, err.message);
        break;
      }
    }

    // Sort chapters by index for consistent ordering
    chapters.sort((a, b) => a.index - b.index);

    // Re-index sequentially
    chapters.forEach((ch, i) => { ch.index = i + 1; });

    console.log(`[WuxiaBox] Discovered ${chapters.length} chapters total`);
    return chapters;
  }

  /**
   * Count total pagination pages from the first page DOM.
   */
  _countPages($) {
    const paginationLinks = $('ul.pagination li');
    if (paginationLinks.length === 0) return 1;

    let maxPage = 1;
    paginationLinks.each((_, li) => {
      // Active page or linked page
      const text = $(li).text().trim();
      const num = parseInt(text, 10);
      if (!isNaN(num) && num > maxPage) {
        maxPage = num;
      }
    });

    return maxPage;
  }

  /**
   * Extract chapter content using Playwright (needed for JS-rendered content).
   */
  async extractContent(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.waitForContent(page, '.chapter-content');

    return await page.evaluate(() => {
      // Get chapter title
      const titleEl = document.querySelector('.chapter-header .titles h2')
        || document.querySelector('.chapter-header h2')
        || document.querySelector('h2');
      const title = titleEl?.textContent?.trim() || '';

      // Get content element
      const contentEl = document.querySelector('.chapter-content');
      if (!contentEl) return { title, html: '<p>Content not found</p>', wordCount: 0, images: [] };

      // Remove unwanted elements
      const removeSelectors = [
        'script', 'style', 'iframe', 'noscript',
        '.ads', '.ad', '[class*="adsbygoogle"]',
        'div[align="center"]',  // ad wrapper divs
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
        title,
        html: contentEl.innerHTML,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        images,
      };
    });
  }
}

module.exports = WuxiaBoxAdapter;
