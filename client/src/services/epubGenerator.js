import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * EPUB 3 Generator — Creates valid EPUB files from scraped novel content.
 * Follows OCF specification with proper mimetype, container.xml, OPF, and nav.
 */
class EPUBGenerator {
  /**
   * Generate and download an EPUB file
   * @param {Object} config
   * @param {string} config.title - Book title
   * @param {string} config.author - Author name
   * @param {string} config.description - Book description
   * @param {string} config.language - Language code (e.g., 'en')
   * @param {string} config.publisher - Publisher name
   * @param {string} config.coverUrl - Cover image data URL or URL
   * @param {Array<{title: string, content: string}>} config.chapters - Chapter list
   * @param {string} config.css - Custom CSS for reading
   * @param {Blob} config.coverBlob - Cover image as Blob
   */
  static async generate(config) {
    const {
      title = 'Untitled Novel',
      author = 'Unknown Author',
      description = '',
      language = 'en',
      publisher = 'WebNovel Scraper',
      chapters = [],
      css = '',
      coverBlob = null,
    } = config;

    const zip = new JSZip();
    const bookId = `urn:uuid:${crypto.randomUUID()}`;
    const now = new Date().toISOString().split('.')[0] + 'Z';

    // 1. mimetype (MUST be first, uncompressed)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // 2. META-INF/container.xml
    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    // 3. Stylesheet
    const stylesheet = css || this.defaultCSS();
    zip.file('OEBPS/stylesheet.css', stylesheet);

    // 4. Cover image
    let coverFilename = null;
    if (coverBlob) {
      const ext = coverBlob.type?.includes('png') ? 'png' : 'jpg';
      coverFilename = `cover.${ext}`;
      zip.file(`OEBPS/images/${coverFilename}`, coverBlob);
    }

    // 5. Cover XHTML
    if (coverFilename) {
      zip.file('OEBPS/cover.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>Cover</title>
  <style>
    body { margin: 0; padding: 0; text-align: center; }
    img { max-width: 100%; max-height: 100vh; object-fit: contain; }
  </style>
</head>
<body>
  <img src="images/${coverFilename}" alt="Cover"/>
</body>
</html>`);
    }

    // 6. Title page
    zip.file('OEBPS/title.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>${this.escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <div class="title-page">
    <h1>${this.escapeXml(title)}</h1>
    <p class="author">by ${this.escapeXml(author)}</p>
    ${description ? `<p class="description">${this.escapeXml(description.substring(0, 500))}</p>` : ''}
  </div>
</body>
</html>`);

    // 7. Chapter files
    chapters.forEach((ch, i) => {
      const chapterNum = i + 1;
      const chTitle = ch.title || `Chapter ${chapterNum}`;
      const content = this.sanitizeForXHTML(ch.content || '<p>No content</p>');

      zip.file(`OEBPS/chapter-${chapterNum}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>${this.escapeXml(chTitle)}</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <h1 class="chapter-title">${this.escapeXml(chTitle)}</h1>
  <div class="chapter-content">
    ${content}
  </div>
</body>
</html>`);
    });

    // 8. Navigation document (EPUB 3)
    const navItems = chapters.map((ch, i) => {
      const num = i + 1;
      return `      <li><a href="chapter-${num}.xhtml">${this.escapeXml(ch.title || `Chapter ${num}`)}</a></li>`;
    }).join('\n');

    zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`);

    // 9. NCX (legacy compatibility)
    const ncxPoints = chapters.map((ch, i) => {
      const num = i + 1;
      return `    <navPoint id="navpoint-${num}" playOrder="${num}">
      <navLabel><text>${this.escapeXml(ch.title || `Chapter ${num}`)}</text></navLabel>
      <content src="chapter-${num}.xhtml"/>
    </navPoint>`;
    }).join('\n');

    zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${this.escapeXml(title)}</text></docTitle>
  <navMap>
${ncxPoints}
  </navMap>
</ncx>`);

    // 10. OPF (Package Document)
    let manifestItems = `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="stylesheet.css" media-type="text/css"/>
    <item id="title-page" href="title.xhtml" media-type="application/xhtml+xml"/>`;

    let spineItems = `    <itemref idref="title-page"/>`;

    if (coverFilename) {
      const mediaType = coverFilename.endsWith('.png') ? 'image/png' : 'image/jpeg';
      manifestItems += `\n    <item id="cover-image" href="images/${coverFilename}" media-type="${mediaType}" properties="cover-image"/>`;
      manifestItems += `\n    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
      spineItems = `    <itemref idref="cover"/>\n` + spineItems;
    }

    chapters.forEach((_, i) => {
      const num = i + 1;
      manifestItems += `\n    <item id="chapter-${num}" href="chapter-${num}.xhtml" media-type="application/xhtml+xml"/>`;
      spineItems += `\n    <itemref idref="chapter-${num}"/>`;
    });

    zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${this.escapeXml(title)}</dc:title>
    <dc:creator>${this.escapeXml(author)}</dc:creator>
    <dc:language>${language}</dc:language>
    <dc:publisher>${this.escapeXml(publisher)}</dc:publisher>
    <dc:description>${this.escapeXml(description)}</dc:description>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`);

    // Generate the ZIP/EPUB blob
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return blob;
  }

  /**
   * Generate and trigger download
   */
  static async download(config) {
    const blob = await this.generate(config);
    const filename = `${config.title?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'novel'}.epub`;
    saveAs(blob, filename);
    return { filename, size: blob.size };
  }

  /**
   * Default reading CSS
   */
  static defaultCSS() {
    return `
body {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1em;
  line-height: 1.8;
  color: #2a2a2a;
  margin: 1em;
  max-width: 40em;
}

h1 { font-size: 1.5em; margin: 1em 0 0.5em; }
h2 { font-size: 1.3em; margin: 0.8em 0 0.4em; }
h3 { font-size: 1.1em; margin: 0.6em 0 0.3em; }

p { margin: 0.6em 0; text-indent: 1.5em; }
p:first-child { text-indent: 0; }

blockquote {
  margin: 1em 2em;
  padding-left: 1em;
  border-left: 3px solid #ccc;
  font-style: italic;
  color: #555;
}

.title-page {
  text-align: center;
  padding: 3em 1em;
}

.title-page h1 {
  font-size: 2em;
  margin-bottom: 0.5em;
}

.title-page .author {
  font-size: 1.2em;
  color: #666;
  margin-bottom: 2em;
}

.title-page .description {
  font-size: 0.9em;
  color: #888;
  font-style: italic;
  max-width: 30em;
  margin: 0 auto;
}

.chapter-title {
  text-align: center;
  margin-bottom: 1.5em;
  page-break-before: always;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}

hr {
  border: none;
  border-top: 1px solid #ddd;
  margin: 2em 0;
}
`;
  }

  /**
   * Escape XML special characters
   */
  static escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Sanitize HTML content for valid XHTML in EPUB
   */
  static sanitizeForXHTML(html) {
    if (!html) return '<p></p>';
    
    return html
      // Self-close void elements
      .replace(/<br\s*>/gi, '<br/>')
      .replace(/<hr\s*>/gi, '<hr/>')
      .replace(/<img([^>]*?)(?<!\/)>/gi, '<img$1/>')
      // Remove invalid attributes
      .replace(/\s+on\w+="[^"]*"/gi, '')
      .replace(/\s+on\w+='[^']*'/gi, '')
      // Fix common issues
      .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)/gi, '&amp;')
      // Remove empty paragraphs
      .replace(/<p>\s*<\/p>/gi, '')
      // Ensure content is wrapped
      .trim();
  }
}

export default EPUBGenerator;
