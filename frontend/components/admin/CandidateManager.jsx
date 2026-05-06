'use client';

import { useState } from 'react';
import { admin } from '../../lib/api';
import Button from '../ui/Button';
import Input from '../ui/Input';

/**
 * CandidateManager — inline candidate CRUD for a draft election.
 *
 * Props:
 *  electionId   - UUID of the election
 *  candidates   - current candidates array
 *  onUpdate     - () => void — called after any successful mutation
 */
export default function CandidateManager({ electionId, candidates = [], onUpdate }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  const [newCandidate, setNewCandidate] = useState({ name: '', bio: '', position: '' });
  const [editData, setEditData] = useState({});

  // ─── Add ────────────────────────────────────────────────────────────────

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newCandidate.name.trim()) return;

    setActionLoading('add');
    setError(null);
    try {
      await admin.candidates.add(electionId, {
        name: newCandidate.name.trim(),
        bio: newCandidate.bio.trim() || undefined,
        position: newCandidate.position.trim() || undefined,
        displayOrder: candidates.length,
      });
      setNewCandidate({ name: '', bio: '', position: '' });
      setShowAddForm(false);
      onUpdate?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Edit ────────────────────────────────────────────────────────────────

  const startEdit = (candidate) => {
    setEditingId(candidate.id);
    setEditData({
      name: candidate.name,
      bio: candidate.bio || '',
      position: candidate.position || '',
    });
    setError(null);
  };

  const handleUpdate = async (candidateId) => {
    setActionLoading(`edit-${candidateId}`);
    setError(null);
    try {
      await admin.candidates.update(candidateId, {
        name: editData.name.trim(),
        bio: editData.bio.trim() || undefined,
        position: editData.position.trim() || undefined,
      });
      setEditingId(null);
      onUpdate?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = async (candidateId, candidateName) => {
    if (candidates.length <= 2) {
      setError('An election must have at least 2 candidates.');
      return;
    }
    if (!confirm(`Remove "${candidateName}" from this election?`)) return;

    setActionLoading(`delete-${candidateId}`);
    setError(null);
    try {
      await admin.candidates.delete(candidateId);
      onUpdate?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Existing candidates */}
      <div className="space-y-3">
        {candidates.map((candidate, index) => (
          <div
            key={candidate.id}
            className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50"
          >
            <div className="w-8 h-8 rounded-full bg-university-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {index + 1}
            </div>

            {editingId === candidate.id ? (
              <div className="flex-1 space-y-3">
                <Input
                  label="Name *"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  required
                />
                <Input
                  label="Position"
                  value={editData.position}
                  onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                />
                <div>
                  <label className="label">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    rows={2}
                    className="input"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleUpdate(candidate.id)}
                    loading={actionLoading === `edit-${candidate.id}`}
                  >
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{candidate.name}</p>
                {candidate.position && (
                  <p className="text-sm text-university-primary">{candidate.position}</p>
                )}
                {candidate.bio && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{candidate.bio}</p>
                )}
                {!candidate.is_active && (
                  <span className="mt-1 inline-block text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                    Inactive
                  </span>
                )}
              </div>
            )}

            {editingId !== candidate.id && (
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(candidate)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(candidate.id, candidate.name)}
                  loading={actionLoading === `delete-${candidate.id}`}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new candidate form */}
      {showAddForm ? (
        <form
          onSubmit={handleAdd}
          className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 space-y-3"
        >
          <p className="text-sm font-medium text-gray-700">New Candidate</p>
          <Input
            label="Name *"
            value={newCandidate.name}
            onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
            placeholder="Full name"
            required
            autoFocus
          />
          <Input
            label="Position"
            value={newCandidate.position}
            onChange={(e) => setNewCandidate({ ...newCandidate, position: e.target.value })}
            placeholder="e.g., Presidential Candidate"
          />
          <div>
            <label className="label">Bio</label>
            <textarea
              value={newCandidate.bio}
              onChange={(e) => setNewCandidate({ ...newCandidate, bio: e.target.value })}
              rows={2}
              className="input"
              placeholder="Brief background..."
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={actionLoading === 'add'}
            >
              Add Candidate
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewCandidate({ name: '', bio: '', position: '' });
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          + Add Candidate
        </Button>
      )}
    </div>
  );
}
