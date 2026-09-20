import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { novelDB } from '../services/database';
import { useAppStore } from '../stores/appStore';

export default function Projects() {
  const { addToast } = useAppStore();
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');

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

  const handleDelete = async (id) => {
    try {
      await novelDB.delete(id);
      setNovels(prev => prev.filter(n => n.id !== id));
      addToast({ type: 'success', title: 'Project Deleted' });
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const filtered = novels.filter(n =>
    !search || n.title?.toLowerCase().includes(search.toLowerCase()) || n.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content animate-fadeIn">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage your scraped novel projects.</p>
        </div>
        <Link to="/scrape" className="btn btn-primary">+ New Project</Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="search-input-wrapper" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <button className={`btn btn-icon btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('grid')} title="Grid view">▦</button>
        <button className={`btn btn-icon btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('list')} title="List view">☰</button>
      </div>

      {loading ? (
        <div className="grid grid-auto-fill">
          {[1, 2, 3, 4].map(i => (
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
            <div className="empty-state-icon">📁</div>
            <div className="empty-state-title">{search ? 'No results found' : 'No projects yet'}</div>
            <div className="empty-state-desc">
              {search ? 'Try a different search term.' : 'Start a new scrape to create your first project.'}
            </div>
            {!search && <Link to="/scrape" className="btn btn-primary">Start Scraping</Link>}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-auto-fill">
          {filtered.map(novel => (
            <div key={novel.id} className="card card-interactive">
              {novel.coverUrl && (
                <div style={{ height: '180px', margin: 'calc(-1 * var(--space-6))', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', overflow: 'hidden' }}>
                  <img src={novel.coverUrl} alt={novel.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.parentElement.style.display = 'none'} />
                </div>
              )}
              <h3 className="font-semibold text-sm truncate">{novel.title || 'Untitled'}</h3>
              <p className="text-xs text-secondary mt-1 truncate">{novel.author || 'Unknown author'}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="badge badge-neutral">{novel.adapter || 'generic'}</span>
                {novel.status && <span className="badge badge-info">{novel.status}</span>}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Link to="/epub-builder" className="btn btn-sm btn-primary" style={{ flex: 1 }}>Build EPUB</Link>
                <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(novel.id)} title="Delete">🗑</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Site</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(novel => (
                <tr key={novel.id}>
                  <td className="font-medium">{novel.title || 'Untitled'}</td>
                  <td>{novel.author || '—'}</td>
                  <td><span className="badge badge-neutral">{novel.adapter || 'generic'}</span></td>
                  <td>{novel.status || '—'}</td>
                  <td className="text-xs">{novel.createdAt ? new Date(novel.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link to="/epub-builder" className="btn btn-sm btn-primary">EPUB</Link>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(novel.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
