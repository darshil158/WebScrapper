import { useState, useEffect } from 'react';
import { historyDB } from '../services/database';
import { useAppStore } from '../stores/appStore';

export default function History() {
  const { addToast } = useAppStore();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await historyDB.getAll(200);
      setEntries(data);
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await historyDB.clear();
      setEntries([]);
      addToast({ type: 'success', title: 'History Cleared' });
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const getActionIcon = (action) => {
    const icons = {
      scrape_started: '🔍',
      scrape_completed: '✅',
      scrape_failed: '❌',
      epub_generated: '📖',
      novel_added: '📚',
      novel_deleted: '🗑',
    };
    return icons[action] || '📝';
  };

  const getActionBadge = (action) => {
    if (action?.includes('failed')) return 'badge-danger';
    if (action?.includes('completed') || action?.includes('generated')) return 'badge-success';
    if (action?.includes('started')) return 'badge-info';
    return 'badge-neutral';
  };

  const filtered = entries.filter(e => filter === 'all' || e.action?.includes(filter));

  return (
    <div className="page-content animate-fadeIn">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">Scraping activity and event log.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleClear} disabled={entries.length === 0}>
          🗑 Clear History
        </button>
      </div>

      {/* Filters */}
      <div className="tabs">
        {['all', 'scrape', 'epub', 'novel'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 mb-4">
              <div className="skeleton skeleton-avatar" style={{ width: '32px', height: '32px' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                <div className="skeleton skeleton-text xs mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🕐</div>
            <div className="empty-state-title">No history yet</div>
            <div className="empty-state-desc">Activity will appear here as you use the scraper.</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {filtered.map((entry, i) => (
            <div
              key={entry.id || i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-4) var(--space-6)',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{getActionIcon(entry.action)}</span>
              <div style={{ flex: 1 }}>
                <div className="text-sm font-medium">{entry.details || entry.action}</div>
                <div className="text-xs text-tertiary">{entry.action?.replaceAll('_', ' ')}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${getActionBadge(entry.action)}`}>{entry.action?.split('_').pop()}</span>
                <span className="text-xs text-tertiary">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
