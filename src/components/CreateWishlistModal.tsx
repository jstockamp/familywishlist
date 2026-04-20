import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

const ALIAS_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface Props {
  onClose: () => void;
  onCreated: () => void;
  ownerName: string;
}

export function CreateWishlistModal({ onClose, onCreated, ownerName }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const trimmedAlias = alias.trim().toLowerCase();
    if (trimmedAlias) {
      if (!ALIAS_RE.test(trimmedAlias)) {
        setError('Alias must be lowercase letters, numbers, and hyphens only.');
        return;
      }
      if (trimmedAlias.length > 60) {
        setError('Alias must be 60 characters or fewer.');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      // Check alias uniqueness before creating
      if (trimmedAlias) {
        const { data: existing } = await client.models.Wishlist.listWishlistByAlias({ alias: trimmedAlias });
        if (existing.length > 0) {
          setError('That alias is already taken. Try another.');
          setLoading(false);
          return;
        }
      }

      await client.models.Wishlist.create({
        name: name.trim(),
        description: description.trim() || undefined,
        ownerName,
        alias: trimmedAlias || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to create wishlist. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">New Wishlist</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                List name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Christmas 2025, Birthday"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes for gift givers..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom URL alias <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-400 whitespace-nowrap">/wishlist/</span>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.toLowerCase())}
                  placeholder="e.g. jeff-christmas-2026"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, and hyphens only.</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 bg-amber-500 text-white rounded-lg py-2 hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create list'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
