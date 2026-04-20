import { useEffect, useState, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';
import { Layout } from '../components/Layout';
import { AddItemModal } from '../components/AddItemModal';

const client = generateClient<Schema>({ authMode: 'userPool' });

type Item = Schema['Item']['type'];

export function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { username, userId } = await getCurrentUser();
      const { data } = await client.models.Item.list();
      const mine = data.filter((i) => i.owner === username || i.owner === userId);
      setItems(
        [...mine].sort((a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        )
      );
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleDelete(item: Item) {
    if (!confirm(`Remove "${item.title}" from your catalog? It will be removed from all wishlists.`)) return;
    setDeleting(item.id);
    try {
      // Delete all junction records first
      const { data: junctions } = await client.models.WishlistItem.list({
        filter: { itemId: { eq: item.id } },
      });
      await Promise.all(junctions.map((j) => client.models.WishlistItem.delete({ id: j.id })));
      await client.models.Item.delete({ id: item.id });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete item.');
    } finally {
      setDeleting(null);
    }
  }

  const filtered = items.filter((i) =>
    i.title.toLowerCase().includes(search.toLowerCase())
  );

  const priorityBadge: Record<string, string> = {
    HIGH: 'bg-red-50 text-red-600',
    MEDIUM: 'bg-amber-50 text-amber-600',
    LOW: 'bg-gray-100 text-gray-500',
  };
  const priorityText: Record<string, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Items</h1>
          <p className="text-gray-500 text-sm mt-0.5">Your personal catalog — add items to any wishlist</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-amber-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-amber-600 transition-colors"
        >
          + New item
        </button>
      </div>

      {/* Search */}
      {items.length > 4 && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📦</div>
          <p className="text-gray-500 text-lg">No items yet.</p>
          <p className="text-gray-400 text-sm mt-1">Add items here, then put them on any wishlist.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-6 bg-amber-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-amber-600"
          >
            Add your first item
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Store</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Price</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Priority</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-10 h-10 object-contain rounded-lg bg-gray-50 flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">🎁</div>
                      )}
                      <div className="min-w-0">
                        <p className={`font-medium text-gray-900 truncate ${item.isPurchased ? 'line-through text-gray-400' : ''}`}>
                          {item.title}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{item.notes}</p>
                        )}
                        <div className="flex items-center gap-3 mt-0.5">
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-amber-600 hover:underline">
                              View →
                            </a>
                          )}
                          <button
                            onClick={() => setEditingItem(item)}
                            className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            disabled={deleting === item.id}
                            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                          >
                            {deleting === item.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-600 text-sm">
                    {item.retailer ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell font-semibold text-amber-600">
                    {item.price ?? <span className="text-gray-300 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {item.priority ? (
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge[item.priority]}`}>
                        {priorityText[item.priority]}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {item.isPurchased ? (
                      <span className="text-green-600 text-xs font-medium">
                        ✓ Claimed{item.purchasedByName ? ` by ${item.purchasedByName}` : ''}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && search && (
            <p className="text-center text-gray-400 py-8 text-sm">No items match "{search}"</p>
          )}
        </div>
      )}

      {showAdd && (
        <AddItemModal
          mode="catalog"
          onClose={() => setShowAdd(false)}
          onAdded={loadItems}
        />
      )}
      {editingItem && (
        <AddItemModal
          mode="catalog"
          editItem={editingItem}
          onClose={() => setEditingItem(null)}
          onAdded={loadItems}
        />
      )}
    </Layout>
  );
}
