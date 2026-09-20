import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';

const navItems = [
  { section: 'Main' },
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/scrape', label: 'New Scrape', icon: '🔍' },
  { path: '/queue', label: 'Queue', icon: '⏳' },
  { section: 'Library' },
  { path: '/projects', label: 'Projects', icon: '📁' },
  { path: '/library', label: 'Library', icon: '📚' },
  { path: '/epub-builder', label: 'EPUB Builder', icon: '📖' },
  { section: 'System' },
  { path: '/history', label: 'History', icon: '🕐' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, setSidebarMobileOpen } = useAppStore();
  const location = useLocation();

  return (
    <>
      <aside className={`sidebar ${sidebarCollapsed ? '' : ''} ${sidebarMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">📜</div>
          <span className="sidebar-brand-text">NovelScraper</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className="sidebar-section-label">{item.section}</div>
              );
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarMobileOpen(false)}
                end={item.path === '/'}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            <span>{sidebarCollapsed ? '→' : '←'}</span>
            {!sidebarCollapsed && <span className="nav-label">Collapse</span>}
          </button>
        </div>
      </aside>

      {sidebarMobileOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarMobileOpen(false)} />
      )}
    </>
  );
}
