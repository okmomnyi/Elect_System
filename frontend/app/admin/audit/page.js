'use client';

import { useState, useEffect } from 'react';
import { useRequireAdmin } from '@/hooks/useAuth';
import { admin } from '@/lib/api';

const ACTION_CONFIG = {
  login:            { label: 'Login',            cls: 'bg-emerald-100 text-emerald-700', icon: 'login' },
  logout:           { label: 'Logout',           cls: 'bg-slate-100  text-slate-600',   icon: 'logout' },
  otp_requested:    { label: 'OTP Requested',    cls: 'bg-blue-100   text-blue-700',    icon: 'pin' },
  vote_submitted:   { label: 'Vote Submitted',   cls: 'bg-violet-100 text-violet-700',  icon: 'how_to_vote' },
  vote_recorded:    { label: 'Vote Recorded',    cls: 'bg-violet-100 text-violet-700',  icon: 'ballot' },
  election_created: { label: 'Election Created', cls: 'bg-amber-100  text-amber-700',   icon: 'add_circle' },
  election_opened:  { label: 'Election Opened',  cls: 'bg-emerald-100 text-emerald-700',icon: 'play_circle' },
  election_closed:  { label: 'Election Closed',  cls: 'bg-red-100    text-red-700',     icon: 'stop_circle' },
};

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'login',            label: 'Login' },
  { value: 'logout',           label: 'Logout' },
  { value: 'otp_requested',    label: 'OTP Requested' },
  { value: 'vote_submitted',   label: 'Vote Submitted' },
  { value: 'vote_recorded',    label: 'Vote Recorded' },
  { value: 'election_created', label: 'Election Created' },
  { value: 'election_opened',  label: 'Election Opened' },
  { value: 'election_closed',  label: 'Election Closed' },
];

function ActionBadge({ action }) {
  const cfg = ACTION_CONFIG[action] || { label: action, cls: 'bg-slate-100 text-slate-600', icon: 'help' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${cfg.cls}`}>
      <span className="material-symbols-outlined text-xs" style={{ fontSize: '11px' }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

export default function AuditLogPage() {
  const { user, loading: authLoading } = useRequireAdmin();
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [page, setPage]     = useState(1);
  const [total, setTotal]   = useState(0);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchLogs();
  }, [user, page, actionFilter]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (actionFilter) params.action = actionFilter;
      const data = await admin.auditLog(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  const hasMore = logs.length === 50;

  return (
    <div className="min-h-screen bg-surface">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16">
          <span className="font-headline font-extrabold text-xl text-primary tracking-tight">Audit Logs</span>
          <span className="text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full font-bold">
            {total.toLocaleString()} entries
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">

        {/* Page header */}
        <div>
          <h1 className="font-headline font-extrabold text-4xl text-primary tracking-tighter mb-2">System Audit Trail</h1>
          <p className="text-on-surface-variant">Complete chronological record of all system events and user actions.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant" style={{ fontSize: '18px' }}>filter_list</span>
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="pl-9 pr-10 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
            >
              {ACTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {actionFilter && (
            <button onClick={() => { setActionFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
              Clear filter
            </button>
          )}
        </div>

        {/* Table */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
          {error ? (
            <p className="p-8 text-sm text-error">{error}</p>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant block mb-4">receipt_long</span>
              <p className="font-headline font-bold text-lg text-primary mb-2">No log entries</p>
              <p className="text-sm text-on-surface-variant">No events match the selected filter.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      {['Timestamp', 'User', 'Action', 'Entity', 'IP Address'].map(h => (
                        <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-t border-surface-container-low hover:bg-surface-container/30 transition-colors">
                        <td className="px-6 py-4 text-xs text-on-surface-variant whitespace-nowrap font-mono">
                          {new Date(log.created_at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'medium' })}
                        </td>
                        <td className="px-6 py-4">
                          {log.user_email ? (
                            <span className="text-sm text-on-surface font-medium">{log.user_email}</span>
                          ) : (
                            <span className="text-xs text-on-surface-variant italic">Anonymous</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {log.entity_type || <span className="text-outline">—</span>}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                          {log.ip_address || <span className="text-outline">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-surface-container">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-primary disabled:text-outline disabled:cursor-not-allowed hover:bg-surface-container rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                  Previous
                </button>
                <span className="text-xs text-on-surface-variant font-medium">Page {page}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-primary disabled:text-outline disabled:cursor-not-allowed hover:bg-surface-container rounded-xl transition-colors"
                >
                  Next
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </>
          )}
        </section>

      </div>
    </div>
  );
}
