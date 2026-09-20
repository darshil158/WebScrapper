import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import db from '../services/database';

export default function Settings() {
  const { theme, setTheme, settings, updateSettings, addToast } = useAppStore();
  const [testingProxy, setTestingProxy] = useState(false);

  const handleClearStorage = async () => {
    try {
      await db.delete();
      localStorage.clear();
      addToast({ type: 'success', title: 'Storage Cleared', message: 'All data has been deleted. Refresh the page.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleTestProxy = async () => {
    setTestingProxy(true);
    try {
      const res = await fetch(settings.proxy.url || 'http://localhost:8080', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      addToast({ type: 'success', title: 'Proxy Connected', message: `Status: ${res.status}` });
    } catch {
      addToast({ type: 'warning', title: 'Proxy Unreachable', message: 'Could not connect to the proxy server.' });
    } finally {
      setTestingProxy(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await db.transaction('r', db.novels, db.chapters, db.projects, db.history, async () => {
        return {
          novels: await db.novels.toArray(),
          chapters: await db.chapters.toArray(),
          projects: await db.projects.toArray(),
          history: await db.history.toArray(),
        };
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novelscraper_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: 'success', title: 'Data Exported' });
    } catch (err) {
      addToast({ type: 'error', title: 'Export Failed', message: err.message });
    }
  };

  return (
    <div className="page-content animate-fadeIn">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure scraper, proxy, EPUB, and appearance settings.</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Appearance */}
        <div className="card">
          <h3 className="card-title mb-4">🎨 Appearance</h3>
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label">Theme</label>
            <div className="flex gap-2">
              {['light', 'dark'].map(t => (
                <button
                  key={t}
                  className={`btn btn-sm ${theme === t ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTheme(t)}
                  style={{ flex: 1, textTransform: 'capitalize' }}
                >
                  {t === 'dark' ? '🌙' : '☀️'} {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scraping */}
        <div className="card">
          <h3 className="card-title mb-4">🔍 Scraping</h3>
          <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Default Min Delay (ms)</label>
              <input
                type="number"
                className="form-input"
                value={settings.scraping.defaultDelay}
                onChange={e => updateSettings('scraping.defaultDelay', +e.target.value)}
              />
              <span className="form-hint">Minimum wait between chapter requests</span>
            </div>
            <div className="form-group">
              <label className="form-label">Concurrency</label>
              <input
                type="number"
                className="form-input"
                value={settings.scraping.concurrency}
                onChange={e => updateSettings('scraping.concurrency', +e.target.value)}
                min={1}
                max={5}
              />
              <span className="form-hint">Concurrent scraping workers (1–5)</span>
            </div>
            <div className="form-group">
              <label className="form-label">Max Retries</label>
              <input
                type="number"
                className="form-input"
                value={settings.scraping.maxRetries}
                onChange={e => updateSettings('scraping.maxRetries', +e.target.value)}
                min={0}
                max={10}
              />
              <span className="form-hint">Retry failed chapters up to N times</span>
            </div>
            <div className="form-group">
              <label className="form-label">Block Images During Scrape</label>
              <div
                className={`toggle ${settings.scraping.blockImages ? 'active' : ''}`}
                onClick={() => updateSettings('scraping.blockImages', !settings.scraping.blockImages)}
              />
              <span className="form-hint">Faster scraping by skipping image downloads</span>
            </div>
          </div>
        </div>

        {/* Proxy */}
        <div className="card">
          <h3 className="card-title mb-4">🌐 Proxy</h3>
          <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Proxy URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="http://proxy:port or socks5://proxy:port"
                value={settings.proxy.url}
                onChange={e => updateSettings('proxy.url', e.target.value)}
              />
              <span className="form-hint">HTTP or SOCKS5 proxy for requests</span>
            </div>
            <div className="form-group">
              <label className="form-label">Enable Proxy</label>
              <div className="flex items-center gap-3">
                <div
                  className={`toggle ${settings.proxy.enabled ? 'active' : ''}`}
                  onClick={() => updateSettings('proxy.enabled', !settings.proxy.enabled)}
                />
                {settings.proxy.url && (
                  <button className={`btn btn-sm btn-secondary ${testingProxy ? 'btn-loading' : ''}`} onClick={handleTestProxy}>
                    <span className="btn-text">{testingProxy ? '' : 'Test'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* EPUB */}
        <div className="card">
          <h3 className="card-title mb-4">📖 EPUB Defaults</h3>
          <div className="grid grid-3" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Default Font</label>
              <select className="form-select" value={settings.epub.defaultFont} onChange={e => updateSettings('epub.defaultFont', e.target.value)}>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Palatino">Palatino</option>
                <option value="Bookerly">Bookerly</option>
                <option value="Literata">Literata</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Font Size (px)</label>
              <input type="number" className="form-input" value={settings.epub.fontSize} onChange={e => updateSettings('epub.fontSize', +e.target.value)} min={12} max={28} />
            </div>
            <div className="form-group">
              <label className="form-label">Line Height</label>
              <input type="number" className="form-input" value={settings.epub.lineHeight} onChange={e => updateSettings('epub.lineHeight', +e.target.value)} min={1.2} max={2.5} step={0.1} />
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="card">
          <h3 className="card-title mb-4">💾 Storage</h3>
          <div className="flex items-center gap-3">
            <button className="btn btn-secondary" onClick={handleExportData}>📥 Export Data</button>
            <button className="btn btn-danger" onClick={handleClearStorage}>🗑 Clear All Data</button>
          </div>
          <p className="text-xs text-tertiary mt-3">
            Data is stored locally using IndexedDB and localStorage. Clearing data will remove all projects, chapters, and history.
          </p>
        </div>

        {/* About */}
        <div className="card">
          <h3 className="card-title mb-4">ℹ️ About</h3>
          <div className="grid grid-2" style={{ gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
            <div>
              <div className="text-tertiary text-xs">Version</div>
              <div className="font-semibold">1.0.0</div>
            </div>
            <div>
              <div className="text-tertiary text-xs">Architecture</div>
              <div className="font-semibold">React + Express + Playwright</div>
            </div>
            <div>
              <div className="text-tertiary text-xs">Adapters</div>
              <div className="font-semibold">FanMTL, WuxiaBox, WTR-Lab, Generic</div>
            </div>
            <div>
              <div className="text-tertiary text-xs">EPUB Standard</div>
              <div className="font-semibold">EPUB 3.0</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
