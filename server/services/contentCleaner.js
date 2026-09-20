/**
 * Content Cleaner — Sanitizes scraped HTML content.
 * Removes ads, navigation, scripts, and promotional elements.
 * Preserves semantic formatting: paragraphs, headings, quotes, images, emphasis.
 */

const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const crypto = require('crypto');

// Create DOMPurify instance
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Tags to keep in cleaned content
const ALLOWED_TAGS = [
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
  'blockquote', 'q', 'cite',
  'ul', 'ol', 'li',
  'a', 'img',
  'div', 'span',
  'hr', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'figure', 'figcaption',
  'sup', 'sub', 'small',
];

const ALLOWED_ATTRS = [
  'href', 'src', 'alt', 'title', 'class',
  'width', 'height', 'id',
];

// Elements that are always removed
const REMOVE_SELECTORS = [
  'script', 'style', 'iframe', 'noscript', 'object', 'embed', 'applet',
  'link[rel="stylesheet"]', 'meta',
  // Ads
  '.ads', '.ad', '.adsbygoogle', '[class*="ad-container"]', '[class*="ad-wrapper"]',
  '[id*="google_ads"]', '[id*="ad-"]', '[class*="sponsored"]',
  'ins.adsbygoogle', '[data-ad]',
  // Navigation
  'nav', '.navigation', '.breadcrumb', '.breadcrumbs', '.pager',
  '.prev-next', '.chapter-nav', '.chapter-navigation',
  '[class*="nav-"]', '[class*="pagination"]',
  // Comments
  '.comments', '.comment', '#comments', '[class*="comment-"]',
  '.disqus', '#disqus_thread',
  // Social
  '.social', '.share', '.social-share', '[class*="social"]',
  '.fb-like', '.twitter-share', '[class*="share-"]',
  // Promotional
  '.related', '.recommendation', '.suggested',
  '[class*="related-"]', '[class*="recommend"]',
  '.popup', '.modal', '[class*="popup"]', '[class*="modal"]',
  '.banner', '[class*="banner"]',
  '.newsletter', '[class*="newsletter"]', '[class*="subscribe"]',
  // Site-specific junk
  '.watermark', '[class*="watermark"]',
  '.disclaimer', '[class*="disclaimer"]',
  '.notice', '.notification',
  'footer', 'header:not(h1):not(h2):not(h3)',
  '.sidebar', 'aside',
];

class ContentCleaner {
  /**
   * Clean HTML content — remove junk, sanitize, normalize
   * @param {string} html - Raw HTML content
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {{ html: string, wordCount: number, hash: string }}
   */
  static clean(html, baseUrl = '') {
    if (!html || typeof html !== 'string') {
      return { html: '<p>No content available</p>', wordCount: 0, hash: '' };
    }

    const $ = cheerio.load(html, { decodeEntities: true });

    // Step 1: Remove unwanted elements
    REMOVE_SELECTORS.forEach(selector => {
      try { $(selector).remove(); } catch {}
    });

    // Step 2: Remove empty elements
    $('div, span, p').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const hasChildren = $el.children().length > 0;
      const hasImages = $el.find('img').length > 0;
      if (!text && !hasChildren && !hasImages) {
        $el.remove();
      }
    });

    // Step 3: Remove inline styles and event handlers
    $('*').each((_, el) => {
      const $el = $(el);
      $el.removeAttr('style');
      $el.removeAttr('onclick');
      $el.removeAttr('onload');
      $el.removeAttr('onerror');
      // Remove data attributes
      const attrs = el.attribs || {};
      Object.keys(attrs).forEach(attr => {
        if (attr.startsWith('data-') && attr !== 'data-src') {
          $el.removeAttr(attr);
        }
      });
    });

    // Step 4: Fix relative URLs
    if (baseUrl) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
          try {
            $(el).attr('href', new URL(href, baseUrl).href);
          } catch {}
        }
      });

      $('img[src], img[data-src]').each((_, el) => {
        const $img = $(el);
        const src = $img.attr('data-src') || $img.attr('src');
        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
          try {
            $img.attr('src', new URL(src, baseUrl).href);
          } catch {}
        }
        if ($img.attr('data-src')) {
          $img.attr('src', $img.attr('data-src'));
          $img.removeAttr('data-src');
        }
      });
    }

    // Step 5: Normalize whitespace in text nodes
    $('p, div, span, h1, h2, h3, h4, h5, h6').each((_, el) => {
      const $el = $(el);
      if ($el.children().length === 0) {
        const text = $el.text().replace(/\s+/g, ' ').trim();
        $el.text(text);
      }
    });

    // Step 6: Convert <br><br> patterns to paragraphs
    let content = $.html();
    content = content.replace(/(<br\s*\/?>\s*){2,}/gi, '</p><p>');

    // Step 7: DOMPurify sanitization
    const sanitized = DOMPurify.sanitize(content, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ALLOWED_ATTRS,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
    });

    // Step 8: Calculate word count and hash
    const $clean = cheerio.load(sanitized);
    const plainText = $clean.text().trim();
    const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
    const hash = crypto.createHash('md5').update(plainText).digest('hex');

    return {
      html: sanitized || '<p>No content available</p>',
      wordCount,
      hash,
    };
  }

  /**
   * Check if two content pieces are duplicates
   * @param {string} hash1
   * @param {string} hash2
   * @returns {boolean}
   */
  static isDuplicate(hash1, hash2) {
    return hash1 && hash2 && hash1 === hash2;
  }

  /**
   * Extract plain text from HTML
   * @param {string} html
   * @returns {string}
   */
  static toPlainText(html) {
    const $ = cheerio.load(html);
    return $.text().trim();
  }
}

module.exports = ContentCleaner;
