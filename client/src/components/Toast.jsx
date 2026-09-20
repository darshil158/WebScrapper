import { useAppStore } from '../stores/appStore';

export default function Toast() {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type || 'info'}`}>
          <div className="toast-icon">{icons[toast.type] || icons.info}</div>
          <div className="toast-content">
            {toast.title && <div className="toast-title">{toast.title}</div>}
            {toast.message && <div className="toast-message">{toast.message}</div>}
          </div>
          <button className="toast-close" onClick={() => removeToast(toast.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
