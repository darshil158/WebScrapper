import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDBStats } from '../services/database';
import apiClient from '../services/apiClient';

export default function Dashboard() {
  const [stats, setStats] = useState({ novels: 0, chapters: 0, projects: 0, exports: 0 });
  const [jobs, setJobs] = useState([]);
  const [serverOnline, setServerOnline] = useState(false);

  useEffect(() => {
    getDBStats().then(setStats).catch(() => {});
    apiClient.health()
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false));
    apiClient.getJobs()
      .then(data => setJobs(data.jobs || []))
      .catch(() => {});
  }, []);

  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'paused');
  const completedJobs = jobs.filter(j => j.status === 'completed');

  const chartData = [
    { label: 'Mon', value: 35 },
    { label: 'Tue', value: 58 },
    { label: 'Wed', value: 42 },
    { label: 'Thu', value: 71 },
    { label: 'Fri', value: 89 },
    { label: 'Sat', value: 63 },
    { label: 'Sun', value: 45 },
  ];
  const maxChart = Math.max(...chartData.map(d => d.value));

  return (
    <div className="page-content animate-fadeIn">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back. Here's your scraping overview.</p>
      </div>

      {/* Server Status */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4) var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="flex items-center gap-3">
          <div className={`badge ${serverOnline ? 'badge-success' : 'badge-danger'} badge-dot`}>
            {serverOnline ? 'Server Online' : 'Server Offline'}
          </div>
          {!serverOnline && (
            <span className="text-xs text-tertiary">Start the backend: cd server && node index.js</span>
          )}
        </div>
        <Link to="/scrape" className="btn btn-primary btn-sm">
          + New Scrape
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-icon purple">📚</div>
          <div>
            <div className="stat-value">{stats.novels}</div>
            <div className="stat-label">Total Novels</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon teal">📄</div>
          <div>
            <div className="stat-value">{stats.chapters}</div>
            <div className="stat-label">Chapters Scraped</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">📖</div>
          <div>
            <div className="stat-value">{stats.exports}</div>
            <div className="stat-label">EPUBs Generated</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon rose">⚡</div>
          <div>
            <div className="stat-value">{activeJobs.length}</div>
            <div className="stat-label">Active Jobs</div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Activity Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Scraping Activity</h3>
            <span className="badge badge-neutral">This Week</span>
          </div>
          <div className="bar-chart" style={{ height: '120px' }}>
            {chartData.map((d, i) => (
              <div key={i} className="bar-chart-bar" style={{ height: `${(d.value / maxChart) * 100}%` }}>
                <span className="bar-chart-label">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="flex flex-col gap-3">
            <Link to="/scrape" className="btn btn-primary" style={{ width: '100%', justifyContent: 'flex-start' }}>
              🔍 Start New Scrape
            </Link>
            <Link to="/projects" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
              📁 View Projects
            </Link>
            <Link to="/library" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
              📚 Browse Library
            </Link>
            <Link to="/epub-builder" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
              📖 Build EPUB
            </Link>
          </div>
        </div>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <div className="card-header">
            <h3 className="card-title">Active Jobs</h3>
            <Link to="/queue" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          <div className="flex flex-col gap-3">
            {activeJobs.slice(0, 3).map(job => (
              <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ flex: 1 }}>
                  <div className="font-semibold text-sm">{job.novelInfo?.title || 'Untitled'}</div>
                  <div className="text-xs text-tertiary">{job.progress?.completed || 0} / {job.progress?.total || 0} chapters</div>
                </div>
                <div className="badge badge-info badge-dot">{job.status}</div>
                <div style={{ width: '120px' }}>
                  <div className="progress progress-sm">
                    <div className="progress-bar" style={{ width: `${job.progress?.total ? (job.progress.completed / job.progress.total * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Completed */}
      {completedJobs.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <div className="card-header">
            <h3 className="card-title">Recently Completed</h3>
          </div>
          <div className="flex flex-col gap-2">
            {completedJobs.slice(0, 5).map(job => (
              <div key={job.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                <div className="flex items-center gap-3">
                  <span>📗</span>
                  <span className="text-sm font-medium">{job.novelInfo?.title || 'Untitled'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-tertiary">{job.progress?.completed || 0} ch.</span>
                  <span className="badge badge-success">Done</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
