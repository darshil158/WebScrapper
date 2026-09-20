import { useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';

const routeNames = {
  '/': 'Dashboard',
  '/scrape': 'New Scrape',
  '/queue': 'Scrape Queue',
  '/projects': 'Projects',
  '/library': 'Library',
  '/epub-builder': 'EPUB Builder',
  '/epub-reader': 'EPUB Reader',
  '/history': 'History',
  '/settings': 'Settings',
};

export default function Navbar() {
  const location = useLocation();
  const { theme, setTheme, setSidebarMobileOpen } = useAppStore();

  const currentPage = routeNames[location.pathname] || 'Page';

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarMobileOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="navbar-breadcrumb">
          📜 NovelScraper <span style={{ margin: '0 4px', opacity: 0.4 }}>/</span> <span>{currentPage}</span>
        </div>
      </div>

      <div className="navbar-right">
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
          aria-label="Toggle dark/light theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
