import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { novelDB, chapterDB, historyDB, projectDB } from '../services/database';
import { useAppStore } from '../stores/appStore';

const STEPS = ['URL Input', 'Metadata', 'Chapters', 'Configure', 'Start'];

export default function NewScrape() {
  const navigate = useNavigate();
  const { addToast } = useAppStore();

  const [step, setStep] = useState(0);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [adapterInfo, setAdapterInfo] = useState(null);
  const [metadata, setMetadata] = useState({ title: '', author: '', coverUrl: '', description: '', genres: [], status: '' });
  const [chapters, setChapters] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState(new Set());
  const [chapterSearch, setChapterSearch] = useState('');

  // Config
  const [config, setConfig] = useState({
    delayMin: 2000,
    delayMax: 6000,
    concurrency: 2,
    maxRetries: 3,
  });

  const filteredChapters = useMemo(() => {
    if (!chapterSearch) return chapters;
    const q = chapterSearch.toLowerCase();
    return chapters.filter(ch => ch.title.toLowerCase().includes(q));
  }, [chapters, chapterSearch]);

  // Step 1: Detect & fetch metadata
  const handleDetect = async () => {
    if (!url.trim()) return setError('Please enter a URL');
    setLoading(true);
    setError('');

    try {
      // Detect adapter
      const detectRes = await apiClient.detectSite(url);
      setAdapterInfo(detectRes.adapter);

      // Fetch metadata
      const metaRes = await apiClient.getMetadata(url);
      setMetadata(metaRes.metadata || {});

      // Fetch chapters
      const chapRes = await apiClient.getChapters(url);
      setChapters(chapRes.chapters || []);
      setSelectedChapters(new Set(chapRes.chapters?.map(c => c.index) || []));

      setStep(1);
      addToast({ type: 'success', title: 'Site Detected', message: `Using ${detectRes.adapter?.name || 'Generic'} adapter` });
    } catch (err) {
      setError(err.message);
      if (err.blocked) {
        setError(`Access blocked: ${err.message}. Try again later or use a different source.`);
      }
      addToast({ type: 'error', title: 'Detection Failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleChapter = (index) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => setSelectedChapters(new Set(chapters.map(c => c.index)));
  const deselectAll = () => setSelectedChapters(new Set());
  const selectRange = (start, end) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      chapters.forEach(ch => {
        if (ch.index >= start && ch.index <= end) next.add(ch.index);
      });
      return next;
    });
  };

  // Start scraping
  const handleStartScrape = async () => {
    setLoading(true);
    setError('');

    const selected = chapters.filter(ch => selectedChapters.has(ch.index));
    if (selected.length === 0) {
      setError('Select at least one chapter');
      setLoading(false);
      return;
    }

    try {
      // Save to local DB
      const novelId = await novelDB.add({
        title: metadata.title,
        author: metadata.author,
        coverUrl: metadata.coverUrl,
        description: metadata.description,
        genres: metadata.genres,
        status: metadata.status,
        siteUrl: url,
        adapter: adapterInfo?.id || 'generic',
      });

      const chapterRecords = selected.map(ch => ({
        novelId,
        index: ch.index,
        title: ch.title,
        url: ch.url,
        status: 'pending',
      }));
      await chapterDB.addBulk(chapterRecords);

      // Create project
      await projectDB.add({
        novelId,
        name: metadata.title || 'Untitled Project',
        metadata,
        chapterCount: selected.length,
        status: 'scraping',
      });

      // Add history
      await historyDB.add({
        novelId,
        action: 'scrape_started',
        details: `Started scraping ${selected.length} chapters`,
      });

      // Start backend scrape
      const scrapeRes = await apiClient.startScrape(url, metadata, selected, config);

      addToast({ type: 'success', title: 'Scraping Started!', message: `Job ${scrapeRes.jobId?.slice(0, 8)} processing ${selected.length} chapters` });
      navigate('/queue');
    } catch (err) {
      setError(err.message);
      addToast({ type: 'error', title: 'Scrape Failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content animate-fadeIn">
      <div className="page-header">
        <h1 className="page-title">New Scrape</h1>
        <p className="page-subtitle">Scrape a web novel from any supported site.</p>
      </div>

      {/* Wizard Steps */}
      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={`wizard-step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
              <div className="wizard-step-number">
                {i < step ? '✓' : i + 1}
              </div>
              <span className="wizard-step-label">{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`wizard-connector ${i < step ? 'completed' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 'var(--space-6)', padding: 'var(--space-4) var(--space-5)' }}>
          <div className="flex items-center gap-3">
            <span>❌</span>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Error</div>
              <div className="text-xs text-secondary">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Step 0: URL Input */}
      {step === 0 && (
        <div className="card animate-slideUp">
          <h3 className="card-title mb-4">Enter Novel URL</h3>
          <p className="text-sm text-secondary mb-6">
            Paste the URL of the novel's main page (table of contents / info page).
          </p>
          <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
            <input
              type="url"
              className="form-input"
              placeholder="https://example.com/novel/my-novel"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDetect()}
              disabled={loading}
            />
            <button className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} onClick={handleDetect} disabled={loading}>
              <span className="btn-text">{loading ? '' : '🔍 Detect'}</span>
            </button>
          </div>
          <div className="text-xs text-tertiary">
            Supported: FanMTL, WuxiaBox, WTR-Lab, or any novel site (generic adapter).
          </div>
        </div>
      )}

      {/* Step 1: Metadata Review */}
      {step === 1 && (
        <div className="card animate-slideUp">
          <div className="card-header">
            <h3 className="card-title">Review Metadata</h3>
            {adapterInfo && <span className="badge badge-primary">{adapterInfo.name}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: metadata.coverUrl ? '160px 1fr' : '1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
            {metadata.coverUrl && (
              <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', height: '220px' }}>
                <img src={metadata.coverUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
              </div>
            )}
            <div className="flex flex-col gap-4">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" value={metadata.title} onChange={e => setMetadata({ ...metadata, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Author</label>
                <input className="form-input" value={metadata.author} onChange={e => setMetadata({ ...metadata, author: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <input className="form-input" value={metadata.status} onChange={e => setMetadata({ ...metadata, status: e.target.value })} />
              </div>
              {metadata.genres?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {metadata.genres.map((g, i) => <span key={i} className="badge badge-neutral">{g}</span>)}
                </div>
              )}
            </div>
          </div>
          <div className="form-group mb-6">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={metadata.description} onChange={e => setMetadata({ ...metadata, description: e.target.value })} rows={3} />
          </div>
          <div className="flex justify-between">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
            <button className="btn btn-primary" onClick={() => setStep(2)}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 2: Chapter Selection */}
      {step === 2 && (
        <div className="card animate-slideUp">
          <div className="card-header">
            <h3 className="card-title">Select Chapters</h3>
            <span className="badge badge-info">{selectedChapters.size} / {chapters.length} selected</span>
          </div>

          <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input className="form-input" placeholder="Search chapters..." value={chapterSearch} onChange={e => setChapterSearch(e.target.value)} />
              {chapterSearch && <button className="search-clear" onClick={() => setChapterSearch('')}>✕</button>}
            </div>
            <button className="btn btn-sm btn-secondary" onClick={selectAll}>Select All</button>
            <button className="btn btn-sm btn-ghost" onClick={deselectAll}>Deselect</button>
          </div>

          {chapters.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No chapters found</div>
              <div className="empty-state-desc">The adapter couldn't find any chapters. Try a different URL.</div>
            </div>
          ) : (
            <div className="chapter-list" style={{ marginBottom: 'var(--space-6)' }}>
              {filteredChapters.map(ch => (
                <div
                  key={ch.index}
                  className={`chapter-item ${selectedChapters.has(ch.index) ? 'selected' : ''}`}
                  onClick={() => toggleChapter(ch.index)}
                >
                  <div className={`checkbox ${selectedChapters.has(ch.index) ? 'checked' : ''}`}>
                    {selectedChapters.has(ch.index) && '✓'}
                  </div>
                  <span className="chapter-number">#{ch.index}</span>
                  <span className="chapter-title">{ch.title}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={selectedChapters.size === 0}>
              Continue ({selectedChapters.size} chapters) →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configuration */}
      {step === 3 && (
        <div className="card animate-slideUp">
          <h3 className="card-title mb-6">Scraping Configuration</h3>
          <div className="grid grid-2" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="form-group">
              <label className="form-label">Min Delay (ms)</label>
              <input type="number" className="form-input" value={config.delayMin} onChange={e => setConfig({ ...config, delayMin: +e.target.value })} />
              <span className="form-hint">Minimum wait between requests</span>
            </div>
            <div className="form-group">
              <label className="form-label">Max Delay (ms)</label>
              <input type="number" className="form-input" value={config.delayMax} onChange={e => setConfig({ ...config, delayMax: +e.target.value })} />
              <span className="form-hint">Maximum wait between requests</span>
            </div>
            <div className="form-group">
              <label className="form-label">Max Retries</label>
              <input type="number" className="form-input" value={config.maxRetries} onChange={e => setConfig({ ...config, maxRetries: +e.target.value })} min={0} max={10} />
              <span className="form-hint">Retry failed chapters up to N times</span>
            </div>
            <div className="form-group">
              <label className="form-label">Concurrency</label>
              <input type="number" className="form-input" value={config.concurrency} onChange={e => setConfig({ ...config, concurrency: +e.target.value })} min={1} max={5} />
              <span className="form-hint">Concurrent chapter downloads</span>
            </div>
          </div>
          <div className="flex justify-between">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn-primary" onClick={() => setStep(4)}>Review & Start →</button>
          </div>
        </div>
      )}

      {/* Step 4: Summary & Start */}
      {step === 4 && (
        <div className="card animate-slideUp">
          <h3 className="card-title mb-6">Ready to Scrape</h3>
          <div className="card" style={{ background: 'var(--bg-surface-2)', marginBottom: 'var(--space-6)' }}>
            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
              <div>
                <div className="text-xs text-tertiary mb-2">Novel</div>
                <div className="font-semibold">{metadata.title || 'Untitled'}</div>
              </div>
              <div>
                <div className="text-xs text-tertiary mb-2">Author</div>
                <div className="font-semibold">{metadata.author || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-xs text-tertiary mb-2">Chapters</div>
                <div className="font-semibold">{selectedChapters.size} selected</div>
              </div>
              <div>
                <div className="text-xs text-tertiary mb-2">Adapter</div>
                <div className="font-semibold">{adapterInfo?.name || 'Generic'}</div>
              </div>
              <div>
                <div className="text-xs text-tertiary mb-2">Delay</div>
                <div className="font-semibold">{config.delayMin}ms – {config.delayMax}ms</div>
              </div>
              <div>
                <div className="text-xs text-tertiary mb-2">Retries</div>
                <div className="font-semibold">{config.maxRetries}</div>
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <button className="btn btn-ghost" onClick={() => setStep(3)}>← Back</button>
            <button className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`} onClick={handleStartScrape} disabled={loading}>
              <span className="btn-text">{loading ? '' : '🚀 Start Scraping'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
