'use client';

import { useState } from 'react';
import { admin } from '../../lib/api';
import Button from '../ui/Button';
import { StatusBadge } from '../ui/Badge';

/**
 * ElectionControls — open / close / delete controls for an election.
 *
 * Props:
 *  election   - election object { id, status, title }
 *  onUpdate   - () => void  — refreshes parent state after mutation
 *  onDeleted  - () => void  — navigates away after deletion
 */
export default function ElectionControls({ election, onUpdate, onDeleted }) {
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  if (!election) return null;

  const { id, status, title } = election;

  // ─── Open ────────────────────────────────────────────────────────────────

  const handleOpen = async () => {
    if (!confirm(`Open "${title}" for voting? Students will be notified.`)) return;

    setActionLoading('open');
    setError(null);
    try {
      await admin.elections.open(id);
      onUpdate?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Close ───────────────────────────────────────────────────────────────

  const handleClose = async () => {
    if (
      !confirm(
        `Close "${title}"? This will end voting immediately and make results visible.`
      )
    )
      return;

    setActionLoading('close');
    setError(null);
    try {
      await admin.elections.close(id);
      onUpdate?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (
      !confirm(
        `Permanently DELETE "${title}"? This action cannot be undone.`
      )
    )
      return;

    setActionLoading('delete');
    setError(null);
    try {
      await admin.elections.delete(id);
      onDeleted?.();
    } catch (err) {
      setError(err.message);
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Current status:</span>
        <StatusBadge status={status} />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {status === 'draft' && (
          <>
            <Button
              variant="success"
              onClick={handleOpen}
              loading={actionLoading === 'open'}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Open Election
            </Button>

            <Button
              variant="danger"
              onClick={handleDelete}
              loading={actionLoading === 'delete'}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Election
            </Button>
          </>
        )}

        {status === 'active' && (
          <Button
            variant="danger"
            onClick={handleClose}
            loading={actionLoading === 'close'}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Close Election
          </Button>
        )}

        {status === 'closed' && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Election closed — results are final
          </div>
        )}
      </div>

      {/* Status explanations */}
      <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-100">
        {status === 'draft' && (
          <p>Opening the election notifies all active students and starts accepting votes.</p>
        )}
        {status === 'active' && (
          <p>Closing the election immediately stops voting and publishes final results to all participants.</p>
        )}
      </div>
    </div>
  );
}
