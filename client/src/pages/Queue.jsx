import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';
import { useAppStore } from '../stores/appStore';

export default function Queue() {
  const { addToast } = useAppStore();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState(null);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await apiClient.getJobs();
      setJobs(data.jobs || []);
    } catch {
      // Server might be offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handlePause = async (jobId) => {
    try {
      await apiClient.pauseJob(jobId);
      addToast({ type: 'info', title: 'Job Paused' });
      fetchJobs();
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleResume = async (jobId) => {
    try {
      await apiClient.resumeJob(jobId);
      addToast({ type: 'success', title: 'Job Resumed' });
      fetchJobs();
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleCancel = async (jobId) => {
    try {
      await apiClient.cancelJob(jobId);
      addToast({ type: 'warning', title: 'Job Cancelled' });
      fetchJobs();
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleRetry = async (jobId) => {
    try {
      await apiClient.retryFailed(jobId);
      addToast({ type: 'info', title: 'Retrying Failed Chapters' });
      fetchJobs();
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleDelete = async (jobId) => {
    try {
      await apiClient.deleteJob(jobId);
      addToast({ type: 'success', title: 'Job Deleted' });
      fetchJobs();
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      running: 'badge-info',
      paused: 'badge-warning',
      completed: 'badge-success',
      cancelled: 'badge-neutral',
      failed: 'badge-danger',
      pending: 'badge-neutral',
    };
    return map[status] || 'badge-neutral';
  };

  return (
    <div className="page-content animate-fadeIn">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Scrape Queue</h1>
          <p className="page-subtitle">Monitor and manage active scraping jobs.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchJobs}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card">
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
              <div className="skeleton skeleton-text short mt-2" />
              <div className="skeleton skeleton-text xs mt-4" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">No active jobs</div>
            <div className="empty-state-desc">Start a new scrape to see jobs here.</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map(job => {
            const progress = job.progress?.total ? Math.round((job.progress.completed / job.progress.total) * 100) : 0;
            const isExpanded = expandedJob === job.id;

            return (
              <div key={job.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{job.novelInfo?.title || 'Untitled Novel'}</h3>
                      <span className={`badge ${getStatusBadge(job.status)} badge-dot`}>{job.status}</span>
                    </div>
                    <div className="text-xs text-tertiary">
                      Job: {job.id?.slice(0, 8)} &nbsp;•&nbsp; 
                      Started: {job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      {job.progress?.completed || 0} / {job.progress?.total || 0} chapters
                    </span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--primary-500)' }}>
                      {progress}%
                    </span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                  {job.progress?.failed > 0 && (
                    <div className="text-xs mt-2" style={{ color: 'var(--danger)' }}>
                      ⚠ {job.progress.failed} chapter(s) failed
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {job.status === 'running' && (
                    <button className="btn btn-sm btn-secondary" onClick={() => handlePause(job.id)}>⏸ Pause</button>
                  )}
                  {job.status === 'paused' && (
                    <button className="btn btn-sm btn-primary" onClick={() => handleResume(job.id)}>▶ Resume</button>
                  )}
                  {(job.status === 'running' || job.status === 'paused') && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleCancel(job.id)}>✕ Cancel</button>
                  )}
                  {job.progress?.failed > 0 && (
                    <button className="btn btn-sm btn-secondary" onClick={() => handleRetry(job.id)}>🔄 Retry Failed</button>
                  )}
                  {(job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') && (
                    <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(job.id)}>🗑 Delete</button>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={() => setExpandedJob(isExpanded ? null : job.id)}>
                    {isExpanded ? '▲ Less' : '▼ Details'}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
                    <div className="grid grid-3 mb-4" style={{ fontSize: 'var(--text-xs)' }}>
                      <div>
                        <div className="text-tertiary mb-1">Total Chapters</div>
                        <div className="font-semibold">{job.progress?.total || 0}</div>
                      </div>
                      <div>
                        <div className="text-tertiary mb-1">Completed</div>
                        <div className="font-semibold" style={{ color: 'var(--success)' }}>{job.progress?.completed || 0}</div>
                      </div>
                      <div>
                        <div className="text-tertiary mb-1">Failed</div>
                        <div className="font-semibold" style={{ color: 'var(--danger)' }}>{job.progress?.failed || 0}</div>
                      </div>
                    </div>
                    {job.error && (
                      <div className="text-xs" style={{ color: 'var(--danger)', marginTop: 'var(--space-2)' }}>
                        Error: {job.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
