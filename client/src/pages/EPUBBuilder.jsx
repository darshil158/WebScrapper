import { useState, useEffect } from 'react';
import { novelDB, chapterDB } from '../services/database';
import EPUBGenerator from '../services/epubGenerator';
import apiClient from '../services/apiClient';
import { useAppStore } from '../stores/appStore';

export default function EPUBBuilder() {
  const { addToast } = useAppStore();
  const [novels, setNovels] = useState([]);
  const [selectedNovel, setSelectedNovel] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('metadata');

  // EPUB Metadata
  const [epubMeta, setEpubMeta] = useState({
    title: '', author: '', description: '', language: 'en', publisher: 'WebNovel Scraper',
  });

  // Chapter editing
  const [editingChapter, setEditingChapter] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // Jobs for importing scraped content
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await novelDB.getAll();
      setNovels(data);
      // Also fetch completed jobs
      try {
        const jobsData = await apiClient.getJobs();
        setJobs(jobsData.jobs?.filter(j => j.status === 'completed') || []);
      } catch {}
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const selectNovel = async (novel) => {
    setSelectedNovel(novel);
    setEpubMeta({
      title: novel.title || '',
      author: novel.author || '',
      description: novel.description || '',
      language: 'en',
      publisher: 'WebNovel Scraper',
    });

    // Load chapters from IndexedDB
    const chs = await chapterDB.getByNovel(novel.id);
    setChapters(chs.filter(c => c.content || c.status === 'completed'));
  };

  const importFromJob = async (job) => {
    try {
      const data = await apiClient.getScrapedChapters(job.id);
      if (data.chapters?.length) {
        setChapters(data.chapters.map((ch, i) => ({
          index: ch.index || i + 1,
          title: ch.title || `Chapter ${i + 1}`,
          content: ch.content,
          wordCount: ch.wordCount,
        })));
        setEpubMeta({
          title: job.novelInfo?.title || '',
          author: job.novelInfo?.author || '',
          description: job.novelInfo?.description || '',
          language: 'en',
          publisher: 'WebNovel Scraper',
        });
        setSelectedNovel({ ...job.novelInfo, id: job.id });
        addToast({ type: 'success', title: 'Imported', message: `${data.chapters.length} chapters loaded` });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Import Failed', message: err.message });
    }
  };

  const handleFindReplace = () => {
    if (!findText || editingChapter === null) return;
    const chapter = chapters[editingChapter];
    if (!chapter) return;
    const updated = chapter.content.replaceAll(findText, replaceText);
    const newChapters = [...chapters];
    newChapters[editingChapter] = { ...chapter, content: updated };
    setChapters(newChapters);
    setEditContent(updated);
    addToast({ type: 'success', title: 'Replaced', message: `Find & replace complete` });
  };

  const handleGenerate = async () => {
    if (chapters.length === 0) {
      addToast({ type: 'warning', title: 'No Chapters', message: 'Add chapters before generating' });
      return;
    }

    setGenerating(true);
    try {
      const result = await EPUBGenerator.download({
        ...epubMeta,
        chapters: chapters.map(ch => ({
          title: ch.title,
          content: ch.content,
        })),
      });

      addToast({
        type: 'success',
        title: 'EPUB Generated!',
        message: `${result.filename} (${(result.size / 1024).toFixed(0)} KB)`,
        duration: 8000,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Generation Failed', message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const removeChapter = (index) => {
    setChapters(prev => prev.filter((_, i) => i !== index));
  };

  const moveChapter = (index, direction) => {
    const newChapters = [...chapters];
    const target = index + direction;
    if (target < 0 || target >= newChapters.length) return;
    [newChapters[index], newChapters[target]] = [newChapters[target], newChapters[index]];
    setChapters(newChapters);
  };

  return (
    <div className="page-content animate-fadeIn">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">EPUB Builder</h1>
          <p className="page-subtitle">Assemble and generate EPUB files from scraped content.</p>
        </div>
        <button
          className={`btn btn-primary ${generating ? 'btn-loading' : ''}`}
          onClick={handleGenerate}
          disabled={generating || chapters.length === 0}
        >
          <span className="btn-text">{generating ? '' : '📖 Generate EPUB'}</span>
        </button>
      </div>

      {/* Source Selection */}
      {!selectedNovel && (
        <div className="card mb-6 animate-slideUp">
          <h3 className="card-title mb-4">Select Source</h3>
          <p className="text-sm text-secondary mb-4">Choose a novel project or import from a completed scrape job.</p>

          {/* Completed Jobs */}
          {jobs.length > 0 && (
            <>
              <div className="text-xs font-semibold text-tertiary mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Scrape Jobs</div>
              <div className="flex flex-col gap-2 mb-6">
                {jobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between" style={{ padding: 'var(--space-3)', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div className="text-sm font-medium">{job.novelInfo?.title || 'Untitled'}</div>
                      <div className="text-xs text-tertiary">{job.progress?.completed || 0} chapters</div>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={() => importFromJob(job)}>Import</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Saved Novels */}
          <div className="text-xs font-semibold text-tertiary mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Library</div>
          {loading ? (
            <div className="skeleton skeleton-card" />
          ) : novels.length === 0 ? (
            <div className="text-sm text-tertiary">No novels in library. Complete a scrape first.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {novels.map(novel => (
                <div key={novel.id} className="flex items-center justify-between" style={{ padding: 'var(--space-3)', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div className="text-sm font-medium">{novel.title || 'Untitled'}</div>
                    <div className="text-xs text-tertiary">{novel.author || 'Unknown'}</div>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={() => selectNovel(novel)}>Select</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Builder Interface */}
      {selectedNovel && (
        <>
          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${activeTab === 'metadata' ? 'active' : ''}`} onClick={() => setActiveTab('metadata')}>Metadata</button>
            <button className={`tab ${activeTab === 'chapters' ? 'active' : ''}`} onClick={() => setActiveTab('chapters')}>Chapters ({chapters.length})</button>
            <button className={`tab ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => setActiveTab('editor')}>Editor</button>
          </div>

          {/* Metadata Tab */}
          {activeTab === 'metadata' && (
            <div className="card animate-slideUp">
              <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-input" value={epubMeta.title} onChange={e => setEpubMeta({ ...epubMeta, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Author</label>
                  <input className="form-input" value={epubMeta.author} onChange={e => setEpubMeta({ ...epubMeta, author: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Language</label>
                  <select className="form-select" value={epubMeta.language} onChange={e => setEpubMeta({ ...epubMeta, language: e.target.value })}>
                    <option value="en">English</option>
                    <option value="zh">Chinese</option>
                    <option value="ko">Korean</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Publisher</label>
                  <input className="form-input" value={epubMeta.publisher} onChange={e => setEpubMeta({ ...epubMeta, publisher: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={epubMeta.description} onChange={e => setEpubMeta({ ...epubMeta, description: e.target.value })} rows={4} />
              </div>
            </div>
          )}

          {/* Chapters Tab */}
          {activeTab === 'chapters' && (
            <div className="card animate-slideUp">
              <div className="card-header">
                <h3 className="card-title">Chapter Order</h3>
                <span className="badge badge-info">{chapters.length} chapters</span>
              </div>
              {chapters.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                  <div className="empty-state-icon">📄</div>
                  <div className="empty-state-title">No chapters</div>
                  <div className="empty-state-desc">Import chapters from a completed scrape job.</div>
                </div>
              ) : (
                <div className="chapter-list">
                  {chapters.map((ch, i) => (
                    <div key={i} className="chapter-item" style={{ cursor: 'default' }}>
                      <span className="chapter-number">#{i + 1}</span>
                      <span className="chapter-title">{ch.title || `Chapter ${i + 1}`}</span>
                      <span className="text-xs text-tertiary">{ch.wordCount || '—'} words</span>
                      <div className="flex items-center gap-1">
                        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => moveChapter(i, -1)} disabled={i === 0} title="Move up">↑</button>
                        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => moveChapter(i, 1)} disabled={i === chapters.length - 1} title="Move down">↓</button>
                        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => { setEditingChapter(i); setEditContent(ch.content || ''); setActiveTab('editor'); }} title="Edit">✏️</button>
                        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => removeChapter(i)} title="Remove">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editor Tab */}
          {activeTab === 'editor' && (
            <div className="card animate-slideUp">
              <div className="card-header">
                <h3 className="card-title">
                  {editingChapter !== null ? `Editing: ${chapters[editingChapter]?.title || 'Chapter'}` : 'Select a chapter to edit'}
                </h3>
              </div>
              {editingChapter !== null ? (
                <>
                  {/* Find & Replace */}
                  <div className="flex items-center gap-2 mb-4" style={{ padding: 'var(--space-3)', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)' }}>
                    <input className="form-input" placeholder="Find..." value={findText} onChange={e => setFindText(e.target.value)} style={{ flex: 1 }} />
                    <input className="form-input" placeholder="Replace..." value={replaceText} onChange={e => setReplaceText(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-sm btn-secondary" onClick={handleFindReplace}>Replace All</button>
                  </div>

                  <textarea
                    className="form-textarea"
                    value={editContent}
                    onChange={e => {
                      setEditContent(e.target.value);
                      const newChapters = [...chapters];
                      newChapters[editingChapter] = { ...newChapters[editingChapter], content: e.target.value };
                      setChapters(newChapters);
                    }}
                    rows={20}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}
                  />
                </>
              ) : (
                <div className="text-sm text-tertiary">Select a chapter from the Chapters tab to edit its content.</div>
              )}
            </div>
          )}

          {/* Change source */}
          <div className="mt-6">
            <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedNovel(null); setChapters([]); }}>
              ← Change Source
            </button>
          </div>
        </>
      )}
    </div>
  );
}
