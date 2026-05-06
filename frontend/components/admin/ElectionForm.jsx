'use client';

import { useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';

/**
 * ElectionForm — reusable form for creating or editing elections.
 *
 * Props:
 *  initialData   - optional existing election data (for edit mode)
 *  onSubmit      - async (formData) => void
 *  onCancel      - () => void
 *  submitLabel   - button label (default "Create Election")
 *  loading       - external loading state override
 */
export default function ElectionForm({
  initialData = null,
  onSubmit,
  onCancel,
  submitLabel = 'Create Election',
  loading: externalLoading = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    startTime: initialData?.startTime ? initialData.startTime.slice(0, 16) : '',
    endTime: initialData?.endTime ? initialData.endTime.slice(0, 16) : '',
    candidates: initialData?.candidates?.length
      ? initialData.candidates.map((c) => ({
          name: c.name || '',
          bio: c.bio || '',
          position: c.position || '',
        }))
      : [
          { name: '', bio: '', position: '' },
          { name: '', bio: '', position: '' },
        ],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCandidateChange = (index, field, value) => {
    setFormData((prev) => {
      const candidates = [...prev.candidates];
      candidates[index] = { ...candidates[index], [field]: value };
      return { ...prev, candidates };
    });
  };

  const addCandidate = () => {
    setFormData((prev) => ({
      ...prev,
      candidates: [...prev.candidates, { name: '', bio: '', position: '' }],
    }));
  };

  const removeCandidate = (index) => {
    if (formData.candidates.length <= 2) return;
    setFormData((prev) => ({
      ...prev,
      candidates: prev.candidates.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validCandidates = formData.candidates.filter((c) => c.name.trim());
    if (validCandidates.length < 2) {
      setError('At least 2 candidates with names are required.');
      return;
    }

    if (formData.startTime && formData.endTime) {
      if (new Date(formData.endTime) <= new Date(formData.startTime)) {
        setError('End time must be after start time.');
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        candidates: validCandidates.map((c, i) => ({
          name: c.name.trim(),
          bio: c.bio.trim() || undefined,
          position: c.position.trim() || undefined,
          displayOrder: i,
        })),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || externalLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Election Details */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          Election Details
        </h2>
        <div className="space-y-4">
          <Input
            label="Title *"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Student Council President 2024"
            required
            minLength={3}
          />

          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              maxLength={2000}
              className="input"
              placeholder="Describe what this election is for..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Start Time (optional)"
              name="startTime"
              value={formData.startTime}
              onChange={handleChange}
            />
            <Input
              type="datetime-local"
              label="End Time (optional)"
              name="endTime"
              value={formData.endTime}
              onChange={handleChange}
            />
          </div>
        </div>
      </section>

      {/* Candidates */}
      <section>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Candidates
            <span className="ml-2 text-sm font-normal text-gray-500">
              (minimum 2)
            </span>
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={addCandidate}>
            + Add Candidate
          </Button>
        </div>

        <div className="space-y-4">
          {formData.candidates.map((candidate, index) => (
            <div
              key={index}
              className="relative p-4 border border-gray-200 rounded-lg bg-gray-50"
            >
              {formData.candidates.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeCandidate(index)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove candidate"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              <p className="text-sm font-medium text-gray-700 mb-3">
                Candidate {index + 1}
              </p>

              <div className="space-y-3">
                <Input
                  label="Full Name *"
                  value={candidate.name}
                  onChange={(e) => handleCandidateChange(index, 'name', e.target.value)}
                  placeholder="e.g., Jane Doe"
                  required
                />
                <Input
                  label="Position / Title"
                  value={candidate.position}
                  onChange={(e) => handleCandidateChange(index, 'position', e.target.value)}
                  placeholder="e.g., Presidential Candidate"
                />
                <div>
                  <label className="label">Bio</label>
                  <textarea
                    value={candidate.bio}
                    onChange={(e) => handleCandidateChange(index, 'bio', e.target.value)}
                    rows={2}
                    maxLength={1000}
                    className="input"
                    placeholder="Brief background or platform summary..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={isLoading}
          className="flex-1"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
