import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';
import { ItemCard } from '../components/ItemCard';
import { AddItemModal } from '../components/AddItemModal';

const authClient = generateClient<Schema>({ authMode: 'userPool' });
const guestClient = generateClient<Schema>({ authMode: 'iam' });

type Item = Schema['Item']['type'];

interface ListedItem {
  junctionId: string;
  item: Item;
}

type ViewMode = 'grid' | 'list';
type SortColumn = 'title' | 'price' | 'priority' | 'status';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALIAS_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parsePrice(p: string | null | undefined): number {
  if (!p) return Infinity;
  const n = parseFloat(p.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? Infinity : n;
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor"
      className={`w-4 h-4 ${active ? 'text-amber-500' : 'text-gray-400'}`}>
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor"
      className={`w-4 h-4 ${active ? 'text-amber-500' : 'text-gray-400'}`}>
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-300">
        <path d="M5 10l5-5 5 5H5zm0 0l5 5 5-5H5z" />
      </svg>
    );
  }
  return dir === 'asc' ? (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-amber-500">
      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-amber-500">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

interface ColHeaderProps {
  label: string;
  col: SortColumn;
  active: SortColumn;
  dir: SortDir;
  className?: string;
  onClick: (col: SortColumn) => void;
}
function ColHeader({ label, col, active, dir, className = '', onClick }: ColHeaderProps) {
  return (
    <button
      onClick={() => onClick(col)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800 select-none ${className}`}
    >
      {label}
      <SortIcon dir={active === col ? dir : null} />
    </button>
  );
}

export function WishlistPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);

  const [wishlistId, setWishlistId] = useState('');
  const [wishlistName, setWishlistName] = useState('');
  const [wishlistDescription, setWishlistDescription] = useState('');
  const [wishlistOwnerName, setWishlistOwnerName] = useState('');
  const [wishlistAlias, setWishlistAlias] = useState<string | null>(null);
  const [items, setItems] = useState<ListedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealPurchased, setRevealPurchased] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortCol, setSortCol] = useState<SortColumn>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Alias editing state
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasError, setAliasError] = useState('');

  const loadWishlist = useCallback(async () => {
    if (!idParam) return;
    setLoading(true);
    const readClient = authStatus === 'authenticated' ? authClient : guestClient;
    try {
      let wl: Schema['Wishlist']['type'] | null | undefined = null;

      if (UUID_RE.test(idParam)) {
        // Direct ID lookup
        const { data } = await readClient.models.Wishlist.get({ id: idParam });
        wl = data;
      } else {
        // Alias lookup via secondary index
        const { data } = await readClient.models.Wishlist.listWishlistByAlias({ alias: idParam });
        wl = Array.isArray(data) ? (data[0] ?? null) : null;
      }

      if (!wl) { setNotFound(true); return; }

      setWishlistId(wl.id);
      setWishlistName(wl.name);
      setWishlistDescription(wl.description ?? '');
      setWishlistOwnerName(wl.ownerName ?? '');
      setWishlistAlias(wl.alias ?? null);

      if (authStatus === 'authenticated') {
        try {
          const current = await getCurrentUser();
          setIsOwner(wl.owner === current.username || wl.owner === current.userId);
        } catch { setIsOwner(false); }
      }

      // Load junction records, then fetch each Item
      const { data: junctions } = await readClient.models.WishlistItem.list({
        filter: { wishlistId: { eq: wl.id } },
      });
      const itemResults = await Promise.all(
        junctions.map((j) => readClient.models.Item.get({ id: j.itemId }))
      );
      const listed = junctions
        .map((j, i) => ({ junctionId: j.id, item: itemResults[i].data }))
        .filter((p) => p.item != null) as ListedItem[];
      setItems(listed);
    } catch (err) {
      console.error('Failed to load wishlist:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [idParam, authStatus]);

  useEffect(() => { loadWishlist(); }, [loadWishlist]);

  function toggleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'title') {
        cmp = a.item.title.localeCompare(b.item.title);
      } else if (sortCol === 'price') {
        cmp = parsePrice(a.item.price) - parsePrice(b.item.price);
      } else if (sortCol === 'priority') {
        cmp = (PRIORITY_ORDER[a.item.priority ?? 'MEDIUM'] ?? 1) - (PRIORITY_ORDER[b.item.priority ?? 'MEDIUM'] ?? 1);
      } else if (sortCol === 'status') {
        cmp = (a.item.isPurchased ? 1 : 0) - (b.item.isPurchased ? 1 : 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [items, sortCol, sortDir]);

  const gridItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.item.priority ?? 'MEDIUM'] ?? 1;
      const pb = PRIORITY_ORDER[b.item.priority ?? 'MEDIUM'] ?? 1;
      if (pa !== pb) return pa - pb;
      return new Date(a.item.createdAt ?? 0).getTime() - new Date(b.item.createdAt ?? 0).getTime();
    });
  }, [items]);

  function shareUrl() {
    return wishlistAlias
      ? `${window.location.origin}/wishlist/${wishlistAlias}`
      : `${window.location.origin}/wishlist/${wishlistId}`;
  }

  function copyShareLink() {
    navigator.clipboard.writeText(shareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function startEditAlias() {
    setAliasInput(wishlistAlias ?? '');
    setAliasError('');
    setEditingAlias(true);
  }

  function cancelEditAlias() {
    setEditingAlias(false);
    setAliasError('');
  }

  async function saveAlias() {
    const trimmed = aliasInput.trim().toLowerCase();

    if (trimmed && !ALIAS_RE.test(trimmed)) {
      setAliasError('Only lowercase letters, numbers, and hyphens allowed.');
      return;
    }
    if (trimmed.length > 60) {
      setAliasError('Alias must be 60 characters or fewer.');
      return;
    }

    setAliasSaving(true);
    setAliasError('');
    try {
      // Check for conflicts (skip check if clearing or keeping the same)
      if (trimmed && trimmed !== wishlistAlias) {
        const { data: existing } = await authClient.models.Wishlist.listWishlistByAlias({ alias: trimmed });
        if (existing.length > 0) {
          setAliasError('That alias is already taken. Try another.');
          setAliasSaving(false);
          return;
        }
      }

      await authClient.models.Wishlist.update({
        id: wishlistId,
        alias: trimmed || null,
      });
      setWishlistAlias(trimmed || null);
      setEditingAlias(false);
    } catch (err) {
      console.error(err);
      setAliasError('Failed to save alias. Please try again.');
    } finally {
      setAliasSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="text-5xl">🎁</div>
        <h1 className="text-xl font-bold text-gray-800">Wishlist not found</h1>
        <p className="text-gray-500">This list may have been deleted or the link is incorrect.</p>
        <Link to="/" className="text-amber-600 hover:underline">Go to your wishlists</Link>
      </div>
    );
  }

  const purchasedCount = items.filter((i) => i.item.isPurchased).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link to="/" className="text-sm text-amber-600 hover:underline mb-1 inline-block">
                ← My lists
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{wishlistName}</h1>
              {wishlistOwnerName && (
                <p className="text-gray-500 text-sm mt-0.5">by {wishlistOwnerName}</p>
              )}
              {wishlistDescription && (
                <p className="text-gray-600 text-sm mt-1">{wishlistDescription}</p>
              )}

              {/* Alias row — visible to owner */}
              {isOwner && (
                <div className="mt-2">
                  {editingAlias ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">/wishlist/</span>
                      <input
                        type="text"
                        value={aliasInput}
                        onChange={(e) => setAliasInput(e.target.value.toLowerCase())}
                        placeholder="e.g. jeff-christmas-2026"
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1 w-52 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveAlias();
                          if (e.key === 'Escape') cancelEditAlias();
                        }}
                      />
                      <button
                        onClick={saveAlias}
                        disabled={aliasSaving}
                        className="text-xs px-2 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                      >
                        {aliasSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEditAlias}
                        className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      {aliasError && <span className="text-xs text-red-500">{aliasError}</span>}
                    </div>
                  ) : (
                    <button
                      onClick={startEditAlias}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-600 transition-colors group"
                    >
                      {wishlistAlias ? (
                        <>
                          <span className="font-mono text-gray-500">/wishlist/{wishlistAlias}</span>
                          <span className="text-gray-300 group-hover:text-amber-500">✏</span>
                        </>
                      ) : (
                        <span className="border border-dashed border-gray-300 rounded px-2 py-0.5 hover:border-amber-400">
                          + Set custom URL alias
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )}
              {/* Show alias to non-owners if set */}
              {!isOwner && wishlistAlias && (
                <p className="text-xs text-gray-400 mt-1 font-mono">/wishlist/{wishlistAlias}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {items.length > 0 && (
                <div className="flex border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                    className={`px-3 py-2 flex items-center transition-colors ${
                      viewMode === 'grid' ? 'bg-amber-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <GridIcon active={viewMode === 'grid'} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="List view"
                    className={`px-3 py-2 flex items-center border-l border-gray-200 transition-colors ${
                      viewMode === 'list' ? 'bg-amber-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <ListIcon active={viewMode === 'list'} />
                  </button>
                </div>
              )}
              {isOwner && (
                <button
                  onClick={() => setRevealPurchased((v) => !v)}
                  title={revealPurchased ? 'Hide who claimed what' : 'Show who claimed what'}
                  className={`px-3 py-2 border rounded-xl text-sm transition-colors ${
                    revealPurchased
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {revealPurchased ? '🙈 Hide claimed' : '👁 Show claimed'}
                </button>
              )}
              <button
                onClick={copyShareLink}
                title={shareUrl()}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {copied ? '✓ Copied!' : '🔗 Share'}
              </button>
              {isOwner && (
                <button
                  onClick={() => setShowAddItem(true)}
                  className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  + Add item
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {items.length > 0 && (!isOwner || revealPurchased) && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{purchasedCount} of {items.length} items claimed</span>
              <span>{Math.round((purchasedCount / items.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(purchasedCount / items.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎀</div>
            <p className="text-gray-500 text-lg">This list is empty.</p>
            {isOwner && (
              <button
                onClick={() => setShowAddItem(true)}
                className="mt-4 bg-amber-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-amber-600"
              >
                Add your first item
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gridItems.map((li) => (
              <ItemCard key={li.junctionId} item={li.item} junctionId={li.junctionId} isOwner={isOwner} revealPurchased={revealPurchased} viewMode="grid" onChanged={loadWishlist} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[3fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <ColHeader label="Item" col="title" active={sortCol} dir={sortDir} onClick={toggleSort} />
              <ColHeader label="Price" col="price" active={sortCol} dir={sortDir} onClick={toggleSort} />
              <ColHeader label="Priority" col="priority" active={sortCol} dir={sortDir} onClick={toggleSort} />
              <ColHeader label="Status" col="status" active={sortCol} dir={sortDir} onClick={toggleSort} />
              <span />
            </div>
            <div className="divide-y divide-gray-50">
              {sortedItems.map((li) => (
                <ItemCard key={li.junctionId} item={li.item} junctionId={li.junctionId} isOwner={isOwner} revealPurchased={revealPurchased} viewMode="list" onChanged={loadWishlist} />
              ))}
            </div>
          </div>
        )}
      </main>

      {showAddItem && wishlistId && (
        <AddItemModal
          mode="wishlist"
          wishlistId={wishlistId}
          onClose={() => setShowAddItem(false)}
          onAdded={loadWishlist}
        />
      )}
    </div>
  );
}
