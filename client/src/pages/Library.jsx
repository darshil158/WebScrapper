import { useState, useEffect } from 'react';
import { novelDB } from '../services/database';
import EPUBGenerator from '../services/epubGenerator';
import { useAppStore } from '../stores/appStore';

export default function Library() {
  const { addToast } = useAppStore();
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    loadNovels();
  }, []);

  const loadNovels = async () => {
    try {
      const data = await novelDB.getAll();
      setNovels(data);
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filtered = novels
    .filter(n => !search || n.title?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  return (
    <div className="page-content animate-fadeIn">
      <div className="page-header">
        <h1 className="page-title">Library</h1>
        <p className="page-subtitle">Your collection of scraped novels.</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="search-input-wrapper" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Search library..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date">Newest First</option>
          <option value="title">Title A-Z</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-auto-fill">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card">
              <div className="skeleton skeleton-image" />
              <div className="skeleton skeleton-text mt-4" />
              <div className="skeleton skeleton-text short mt-2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <div className="empty-state-title">{search ? 'No results' : 'Library is empty'}</div>
            <div className="empty-state-desc">
              {search ? 'Try a different search term.' : 'Complete a scrape to add novels to your library.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-auto-fill">
          {filtered.map(novel => (
            <div key={novel.id} className="card card-interactive">
              <div style={{ height: '200px', margin: 'calc(-1 * var(--space-6))', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', overflow: 'hidden', background: 'var(--bg-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {novel.coverUrl ? (
                  <img src={novel.coverUrl} alt={novel.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                ) : null}
                <div style={{ display: novel.coverUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', opacity: 0.3 }}>📖</div>
              </div>
              <h3 className="font-semibold text-sm truncate" title={novel.title}>{novel.title || 'Untitled'}</h3>
              <p className="text-xs text-secondary mt-1 truncate">{novel.author || 'Unknown'}</p>
              {novel.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {novel.genres.slice(0, 3).map((g, i) => (
                    <span key={i} className="badge badge-neutral" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>{g}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-4">
                <span className="badge badge-primary">{novel.adapter}</span>
                {novel.status && <span className="badge badge-info">{novel.status}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
