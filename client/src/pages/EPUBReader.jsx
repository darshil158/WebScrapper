import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * EPUB Reader — Built-in reader/previewer for EPUB content.
 * Supports chapter navigation, themes, font controls, and reading progress.
 */
export default function EPUBReader() {
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [readerTheme, setReaderTheme] = useState('dark');
  const [fontSize, setFontSize] = useState(17);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [progress, setProgress] = useState(0);
  const contentRef = useRef(null);

  // Sample content for preview when no chapters loaded
  useEffect(() => {
    const stored = sessionStorage.getItem('epub-reader-chapters');
    if (stored) {
      try {
        setChapters(JSON.parse(stored));
      } catch {}
    }
    if (!stored) {
      setChapters([
        { title: 'How to Use', content: '<p>To preview an EPUB, generate one from the EPUB Builder page. The reader will display the chapters here.</p><p>Use the controls below to adjust font size, line spacing, and theme.</p><p>Navigate between chapters using the sidebar or the arrow buttons.</p>' },
        { title: 'Features', content: '<h2>Reader Features</h2><p><strong>Themes:</strong> Light, Dark, and Sepia reading modes.</p><p><strong>Typography:</strong> Adjustable font size (12px–28px) and line spacing (1.2–2.0).</p><p><strong>Navigation:</strong> Sidebar table of contents and keyboard shortcuts (← →).</p><p><strong>Progress:</strong> Real-time reading progress indicator.</p>' },
      ]);
    }
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft' && currentChapter > 0) {
      setCurrentChapter(prev => prev - 1);
    } else if (e.key === 'ArrowRight' && currentChapter < chapters.length - 1) {
      setCurrentChapter(prev => prev + 1);
    }
  }, [currentChapter, chapters.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll progress tracking
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [currentChapter]);

  // Reset scroll on chapter change
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setProgress(0);
  }, [currentChapter]);

  const chapter = chapters[currentChapter];
  const overallProgress = chapters.length > 0 ? ((currentChapter + 1) / chapters.length * 100) : 0;

  return (
    <div className={`reader-container reader-theme-${readerTheme}`} style={{ '--reader-font-size': `${fontSize}px`, '--reader-line-height': lineHeight }}>
      {/* Progress Bar */}
      <div className="reader-progress-bar">
        <div className="reader-progress-fill" style={{ width: `${overallProgress}%` }} />
      </div>

      {/* Sidebar TOC */}
      {sidebarOpen && (
        <div className="reader-sidebar">
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-color)' }}>
            <div className="font-semibold text-sm mb-1">Table of Contents</div>
            <div className="text-xs text-tertiary">{chapters.length} chapters</div>
          </div>
          <div style={{ padding: 'var(--space-2)' }}>
            {chapters.map((ch, i) => (
              <div
                key={i}
                className={`nav-item ${i === currentChapter ? 'active' : ''}`}
                onClick={() => setCurrentChapter(i)}
                style={{ fontSize: 'var(--text-xs)' }}
              >
                <span className="nav-icon" style={{ fontSize: '0.7rem', opacity: 0.6 }}>📄</span>
                <span className="nav-label truncate">{ch.title || `Chapter ${i + 1}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="reader-content" ref={contentRef}>
        {chapter ? (
          <div className="reader-page animate-fadeIn">
            <h1>{chapter.title || `Chapter ${currentChapter + 1}`}</h1>
            <div dangerouslySetInnerHTML={{ __html: chapter.content || '<p>No content</p>' }} />
          </div>
        ) : (
          <div className="reader-page" style={{ textAlign: 'center', paddingTop: 'var(--space-16)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📖</div>
            <h2>No Content to Display</h2>
            <p className="text-secondary mt-2">Generate an EPUB from the builder to preview it here.</p>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="reader-controls">
        <button className="btn btn-ghost btn-sm" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle TOC">
          ☰
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

        {/* Navigation */}
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrentChapter(Math.max(0, currentChapter - 1))} disabled={currentChapter === 0}>
          ←
        </button>
        <span className="text-xs font-medium" style={{ minWidth: '60px', textAlign: 'center' }}>
          {currentChapter + 1} / {chapters.length || 1}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrentChapter(Math.min(chapters.length - 1, currentChapter + 1))} disabled={currentChapter >= chapters.length - 1}>
          →
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

        {/* Font Size */}
        <button className="btn btn-ghost btn-sm" onClick={() => setFontSize(Math.max(12, fontSize - 1))} title="Decrease font">A-</button>
        <span className="text-xs">{fontSize}px</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setFontSize(Math.min(28, fontSize + 1))} title="Increase font">A+</button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

        {/* Line Spacing */}
        <button className="btn btn-ghost btn-sm" onClick={() => setLineHeight(Math.max(1.2, +(lineHeight - 0.1).toFixed(1)))} title="Tighter spacing">≡</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setLineHeight(Math.min(2.0, +(lineHeight + 0.1).toFixed(1)))} title="Looser spacing">⋮</button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

        {/* Theme */}
        <button className={`btn btn-ghost btn-sm ${readerTheme === 'light' ? 'active' : ''}`} onClick={() => setReaderTheme('light')} title="Light theme" style={{ background: readerTheme === 'light' ? 'var(--bg-active)' : '' }}>☀</button>
        <button className={`btn btn-ghost btn-sm ${readerTheme === 'dark' ? 'active' : ''}`} onClick={() => setReaderTheme('dark')} title="Dark theme" style={{ background: readerTheme === 'dark' ? 'var(--bg-active)' : '' }}>🌙</button>
        <button className={`btn btn-ghost btn-sm ${readerTheme === 'sepia' ? 'active' : ''}`} onClick={() => setReaderTheme('sepia')} title="Sepia theme" style={{ background: readerTheme === 'sepia' ? 'var(--bg-active)' : '' }}>📜</button>
      </div>
    </div>
  );
}
