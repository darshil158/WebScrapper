import { create } from 'zustand';

/**
 * App Store — Global state for theme, sidebar, notifications, and settings.
 */
export const useAppStore = create((set, get) => ({
  // Theme
  theme: localStorage.getItem('wns-theme') || 'dark',
  setTheme: (theme) => {
    localStorage.setItem('wns-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  // Sidebar
  sidebarCollapsed: localStorage.getItem('wns-sidebar') === 'collapsed',
  sidebarMobileOpen: false,
  toggleSidebar: () => {
    const collapsed = !get().sidebarCollapsed;
    localStorage.setItem('wns-sidebar', collapsed ? 'collapsed' : 'expanded');
    set({ sidebarCollapsed: collapsed });
  },
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),

  // Notifications / Toasts
  toasts: [],
  addToast: (toast) => {
    const id = Date.now() + Math.random();
    const newToast = { id, ...toast, createdAt: Date.now() };
    set({ toasts: [...get().toasts, newToast] });
    // Auto-dismiss after duration
    setTimeout(() => {
      set({ toasts: get().toasts.filter(t => t.id !== id) });
    }, toast.duration || 5000);
    return id;
  },
  removeToast: (id) => {
    set({ toasts: get().toasts.filter(t => t.id !== id) });
  },

  // Settings
  settings: JSON.parse(localStorage.getItem('wns-settings') || JSON.stringify({
    scraping: {
      defaultDelay: 3000,
      concurrency: 2,
      maxRetries: 3,
      blockImages: false,
    },
    proxy: {
      url: '',
      enabled: false,
    },
    epub: {
      defaultFont: 'Georgia',
      fontSize: 16,
      lineHeight: 1.8,
    },
  })),
  updateSettings: (path, value) => {
    const settings = { ...get().settings };
    const keys = path.split('.');
    let obj = settings;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    localStorage.setItem('wns-settings', JSON.stringify(settings));
    set({ settings });
  },

  // Active jobs tracking
  activeJobs: [],
  setActiveJobs: (jobs) => set({ activeJobs: jobs }),
}));

// Initialize theme on load
const savedTheme = localStorage.getItem('wns-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
