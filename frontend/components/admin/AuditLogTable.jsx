'use client';

import { useState, useEffect, useCallback } from 'react';
import { admin } from '../../lib/api';
import { PageSpinner } from '../ui/Spinner';
import Button from '../ui/Button';

const ACTION_COLORS = {
  login:             'bg-green-100 text-green-800',
  logout:            'bg-gray-100 text-gray-800',
  otp_requested:     'bg-blue-100 text-blue-800',
  vote_submitted:    'bg-purple-100 text-purple-800',
  vote_recorded:     'bg-purple-100 text-purple-800',
  vote_failed:       'bg-red-100 text-red-800',
  election_created:  'bg-yellow-100 text-yellow-800',
  election_updated:  'bg-yellow-100 text-yellow-800',
  election_opened:   'bg-green-100 text-green-800',
  election_closed:   'bg-red-100 text-red-800',
  election_deleted:  'bg-red-100 text-red-800',
  suspicious_activity: 'bg-red-200 text-red-900',
};

const ACTION_OPTIONS = [
  { value: '',                   label: 'All Actions' },
  { value: 'login',              label: 'Login' },
  { value: 'logout',             label: 'Logout' },
  { value: 'otp_requested',      label: 'OTP Requested' },
  { value: 'vote_submitted',     label: 'Vote Submitted' },
  { value: 'vote_recorded',      label: 'Vote Recorded' },
  { value: 'election_created',   label: 'Election Created' },
  { value: 'election_opened',    label: 'Election Opened' },
  { value: 'election_closed',    label: 'Election Closed' },
  { value: 'suspicious_activity','label': 'Suspicious Activity' },
];

/**
 * AuditLogTable — paginated, filterable audit log viewer.
 *
 * Props:
 *  defaultAction  - pre-select an action filter  (optional)
 *  defaultUserId  - pre-filter by user ID        (optional)
 *  pageSize       - rows per page (default 50)
 */
export default function AuditLogTable({
  defaultAction = '',
  defaultUserId = '',
  pageSize = 50,
}) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    action: defaultAction,
    userId: defaultUserId,
    startDate: '',
    endDate: '',
  });

  const totalPages = Math.ceil(total / pageSize);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: pageSize };
      if (filters.action)    params.action    = filters.action;
      if (filters.userId)    params.userId    = filters.userId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate)   params.endDate   = filters.endDate;

      const data = await admin.auditLog(params);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  const handleFilterChange = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const formatDate = (dateStr) =>
    dateStr
      ? new Date(dateStr).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '—';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end p-4 bg-gray-50 rounded-lg border border-gray-200">
        {/* Action filter */}
        <div>
          <label className="label">Action</label>
          <select
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="input w-48"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div>
          <label className="label">From</label>
          <input
            type="datetime-local"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="input"
          />
        </div>

        {/* End date */}
        <div>
          <label className="label">To</label>
          <input
            type="datetime-local"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="input"
          />
        </div>

        {/* Clear */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setFilters({ action: '', userId: '', startDate: '', endDate: '' });
            setPage(1);
          }}
        >
          Clear Filters
        </Button>

        <span className="text-sm text-gray-500 ml-auto self-center">
          {total.toLocaleString()} total entries
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
          <button onClick={fetchLogs} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12">
                  <PageSpinner message="Loading audit log..." />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No audit log entries match your filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {log.user_email ? (
                      <div>
                        <p className="font-medium text-gray-900">{log.user_name}</p>
                        <p className="text-xs text-gray-500">{log.user_email}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Anonymous</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.entity_type ? (
                      <span className="capitalize">{log.entity_type}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-500 whitespace-nowrap">
                    {log.ip_address || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            ← Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
