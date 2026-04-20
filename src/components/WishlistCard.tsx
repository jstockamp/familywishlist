import { useState } from 'react';
import { Link } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'userPool' });

interface Wishlist {
  id: string;
  name: string;
  description?: string | null;
  alias?: string | null;
  createdAt?: string;
}

interface Props {
  wishlist: Wishlist;
  onDeleted: () => void;
}

export function WishlistCard({ wishlist, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${wishlist.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      // Remove all junction records first so items stay in the catalog
      const { data: junctions } = await client.models.WishlistItem.list({
        filter: { wishlistId: { eq: wishlist.id } },
      });
      await Promise.all(junctions.map((j) => client.models.WishlistItem.delete({ id: j.id })));
      await client.models.Wishlist.delete({ id: wishlist.id });
      onDeleted();
    } catch (err) {
      console.error(err);
      alert('Failed to delete wishlist.');
    } finally {
      setDeleting(false);
    }
  }

  function copyShareLink() {
    const slug = wishlist.alias ?? wishlist.id;
    const url = `${window.location.origin}/wishlist/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div>
        <h3 className="font-semibold text-gray-900 text-lg leading-tight">{wishlist.name}</h3>
        {wishlist.description && (
          <p className="text-gray-500 text-sm mt-1 line-clamp-2">{wishlist.description}</p>
        )}
      </div>
      <div className="flex gap-2 mt-auto">
        <Link
          to={`/wishlist/${wishlist.alias ?? wishlist.id}`}
          className="flex-1 text-center bg-amber-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          View list
        </Link>
        <button
          onClick={copyShareLink}
          title="Copy share link"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {copied ? '✓' : '🔗'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Delete list"
          className="px-3 py-2 border border-red-100 rounded-lg text-sm text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
