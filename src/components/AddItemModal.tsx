import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'userPool' });

type Item = Schema['Item']['type'];

// mode="catalog"  — used from ItemsPage (no wishlistId, just creates/edits Item)
// mode="wishlist" — used from WishlistPage (also creates WishlistItem junction)
interface Props {
  mode: 'catalog' | 'wishlist';
  wishlistId?: string;
  editItem?: Item;          // provided when editing an existing item
  onClose: () => void;
  onAdded: () => void;
}

type Tab = 'new' | 'catalog';

function detectRetailer(url: string): string {
  if (!url.trim()) return '';
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (host.includes('amazon.') || host === 'a.co') return 'Amazon';
    if (host.includes('target.com')) return 'Target';
    if (host.includes('walmart.com')) return 'Walmart';
    if (host.includes('lego.com')) return 'LEGO';
    if (host.includes('bestbuy.com')) return 'Best Buy';
    if (host.includes('ebay.com')) return 'eBay';
    if (host.includes('etsy.com')) return 'Etsy';
    if (host.includes('costco.com')) return 'Costco';
    // Capitalize the domain name as a generic fallback
    const name = host.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return '';
  }
}

function ItemForm({
  initial,
  onSave,
  saving,
  error,
  submitLabel,
}: {
  initial?: Partial<Item>;
  onSave: (fields: {
    title: string; url: string; imageUrl: string;
    price: string; notes: string; priority: 'LOW' | 'MEDIUM' | 'HIGH'; retailer: string;
  }) => void;
  saving: boolean;
  error: string;
  submitLabel: string;
}) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>(initial?.priority ?? 'MEDIUM');
  const [retailer, setRetailer] = useState(initial?.retailer ?? '');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  function handleUrlChange(val: string) {
    setUrl(val);
    if (!retailer || retailer === detectRetailer(url)) {
      setRetailer(detectRetailer(val));
    }
  }

  async function fetchDetails() {
    if (!url.trim()) return;
    setScraping(true);
    setScrapeError('');
    try {
      const { data } = await client.queries.scrapeUrl({ url: url.trim() });
      if (data) {
        if (data.title) setTitle(data.title);
        if (data.imageUrl) setImageUrl(data.imageUrl);
        if (data.price) setPrice(data.price);
      } else {
        setScrapeError('Could not fetch details — fill in manually.');
      }
    } catch {
      setScrapeError('Could not fetch details — fill in manually.');
    } finally {
      setScraping(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title, url, imageUrl, price, notes, priority, retailer });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://amazon.com/…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
          />
          <button
            type="button"
            onClick={fetchDetails}
            disabled={scraping || !url.trim()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
          >
            {scraping ? 'Fetching…' : imageUrl ? 'Re-fetch' : 'Fetch details'}
          </button>
        </div>
        {scrapeError && <p className="text-xs text-red-500 mt-1">{scrapeError}</p>}
      </div>

      {imageUrl && (
        <div className="flex items-center gap-3">
          <img src={imageUrl} alt="" className="w-16 h-16 object-contain rounded-lg border border-gray-200"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <p className="text-xs text-gray-400 flex-1 break-all line-clamp-2">{imageUrl}</p>
          <button type="button" onClick={() => setImageUrl('')}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Item name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Blue Wireless Headphones"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="$29.99"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          >
            <option value="HIGH">High ⭐⭐⭐</option>
            <option value="MEDIUM">Medium ⭐⭐</option>
            <option value="LOW">Low ⭐</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Store / Retailer</label>
        <input
          type="text"
          value={retailer}
          onChange={(e) => setRetailer(e.target.value)}
          placeholder="e.g. Amazon, Target, LEGO"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes for gift givers</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Size M, color blue preferred"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving || !title.trim()}
          className="flex-1 bg-amber-500 text-white rounded-lg py-2 hover:bg-amber-600 transition-colors disabled:opacity-50 font-medium">
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function AddItemModal({ mode, wishlistId, editItem, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>(mode === 'wishlist' ? 'catalog' : 'new');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Catalog-pick state
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [existingItemIds, setExistingItemIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Load catalog items when showing the catalog tab in wishlist mode
  useEffect(() => {
    if (tab !== 'catalog' || mode !== 'wishlist') return;
    setCatalogLoading(true);
    Promise.all([
      getCurrentUser().then(({ username, userId }) =>
        client.models.Item.list().then(({ data }) =>
          data.filter((i) => i.owner === username || i.owner === userId)
        )
      ),
      wishlistId
        ? client.models.WishlistItem.list({ filter: { wishlistId: { eq: wishlistId } } })
            .then(({ data }) => new Set(data.map((j) => j.itemId)))
        : Promise.resolve(new Set<string>()),
    ])
      .then(([items, onList]) => {
        setCatalogItems(items.sort((a, b) => a.title.localeCompare(b.title)));
        setExistingItemIds(onList);
      })
      .catch(console.error)
      .finally(() => setCatalogLoading(false));
  }, [tab, mode, wishlistId]);

  async function handleSaveNew(fields: {
    title: string; url: string; imageUrl: string;
    price: string; notes: string; priority: 'LOW' | 'MEDIUM' | 'HIGH'; retailer: string;
  }) {
    setSaving(true);
    setError('');
    try {
      if (editItem) {
        // Update existing item
        await client.models.Item.update({
          id: editItem.id,
          title: fields.title.trim(),
          url: fields.url.trim() || undefined,
          imageUrl: fields.imageUrl.trim() || undefined,
          price: fields.price.trim() || undefined,
          notes: fields.notes.trim() || undefined,
          priority: fields.priority,
          retailer: fields.retailer.trim() || undefined,
        });
      } else {
        // Create new item in catalog
        const { data: newItem } = await client.models.Item.create({
          title: fields.title.trim(),
          url: fields.url.trim() || undefined,
          imageUrl: fields.imageUrl.trim() || undefined,
          price: fields.price.trim() || undefined,
          notes: fields.notes.trim() || undefined,
          priority: fields.priority,
          retailer: fields.retailer.trim() || undefined,
          isPurchased: false,
        });
        // If in wishlist mode, also create the junction record
        if (mode === 'wishlist' && wishlistId && newItem) {
          await client.models.WishlistItem.create({ wishlistId, itemId: newItem.id });
        }
      }
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save item. Please try again.');
      setSaving(false);
    }
  }

  async function handleAddFromCatalog() {
    if (selected.size === 0 || !wishlistId) return;
    setSaving(true);
    setError('');
    try {
      await Promise.all(
        [...selected].map((itemId) =>
          client.models.WishlistItem.create({ wishlistId, itemId })
        )
      );
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to add items. Please try again.');
      setSaving(false);
    }
  }

  const filteredCatalog = catalogItems.filter(
    (i) => i.title.toLowerCase().includes(search.toLowerCase())
  );
  const availableCatalog = filteredCatalog.filter((i) => !existingItemIds.has(i.id));

  const isEditing = !!editItem;
  const title = isEditing ? 'Edit Item' : mode === 'catalog' ? 'New Item' : 'Add to Wishlist';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          {/* Tabs — only show when in wishlist mode and not editing */}
          {mode === 'wishlist' && !isEditing && (
            <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-5">
              <button
                onClick={() => setTab('catalog')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  tab === 'catalog' ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                From my catalog
              </button>
              <button
                onClick={() => setTab('new')}
                className={`flex-1 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${
                  tab === 'new' ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                New item
              </button>
            </div>
          )}

          {/* Catalog picker */}
          {tab === 'catalog' && mode === 'wishlist' && (
            <div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your items…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {catalogLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                </div>
              ) : availableCatalog.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">
                    {catalogItems.length === 0
                      ? 'Your catalog is empty. Switch to "New item" to add one.'
                      : search
                      ? `No items match "${search}"`
                      : 'All your items are already on this list.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {availableCatalog.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                        selected.has(item.id) ? 'bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(item.id) : next.delete(item.id);
                            return next;
                          });
                        }}
                        className="rounded accent-amber-500"
                      />
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-9 h-9 object-contain rounded-lg bg-gray-50 flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-base flex-shrink-0">🎁</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        {item.price && <p className="text-xs text-amber-600">{item.price}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

              <div className="flex gap-3 mt-4">
                <button onClick={onClose}
                  className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 hover:bg-gray-50 text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleAddFromCatalog}
                  disabled={saving || selected.size === 0}
                  className="flex-1 bg-amber-500 text-white rounded-lg py-2 hover:bg-amber-600 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? 'Adding…' : `Add ${selected.size > 0 ? selected.size : ''} item${selected.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}

          {/* New item form */}
          {(tab === 'new' || mode === 'catalog') && (
            <>
              <ItemForm
                initial={editItem ?? undefined}
                onSave={handleSaveNew}
                saving={saving}
                error={error}
                submitLabel={isEditing ? 'Save changes' : mode === 'wishlist' ? 'Create & add to list' : 'Add to catalog'}
              />
              {!isEditing && (
                <button onClick={onClose}
                  className="w-full mt-2 border border-gray-300 text-gray-700 rounded-lg py-2 hover:bg-gray-50 text-sm transition-colors">
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
