import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { AddItemModal } from './AddItemModal';

const publicClient = generateClient<Schema>({ authMode: 'apiKey' });
const ownerClient = generateClient<Schema>({ authMode: 'userPool' });

type Item = Schema['Item']['type'];

interface Props {
  item: Item;
  junctionId: string;   // WishlistItem.id — used to remove from this wishlist
  isOwner: boolean;
  revealPurchased?: boolean;  // owner-only toggle; guests always see purchase status
  viewMode?: 'grid' | 'list';
  onChanged: () => void;
}

const priorityLabel: Record<string, string> = {
  HIGH: '⭐⭐⭐',
  MEDIUM: '⭐⭐',
  LOW: '⭐',
};

export function ItemCard({ item, junctionId, isOwner, revealPurchased = false, viewMode = 'grid', onChanged }: Props) {
  // Owners see purchase status only when they've explicitly toggled it on.
  // Guests always see it so they know what's still available.
  const showPurchasedStatus = !isOwner || revealPurchased;
  const [claiming, setClaiming] = useState(false);
  const [purchaserName, setPurchaserName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState('');

  async function handleClaim() {
    if (!purchaserName.trim()) return;
    setClaiming(true);
    setError('');
    try {
      const result = await publicClient.mutations.markItemPurchased({
        itemId: item.id,
        purchaserName: purchaserName.trim(),
      });
      if (result.data?.success) {
        setShowNamePrompt(false);
        onChanged();
      } else {
        setError(result.data?.message ?? 'Could not claim item.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to claim item. Please try again.');
    } finally {
      setClaiming(false);
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove "${item.title}" from this list?`)) return;
    setDeleting(true);
    try {
      await ownerClient.models.WishlistItem.delete({ id: junctionId });
      onChanged();
    } catch (err) {
      console.error(err);
      alert('Failed to remove item.');
    } finally {
      setDeleting(false);
    }
  }

  const claimSection = item.isPurchased && showPurchasedStatus ? (
    <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
      <span>✓</span>
      <span>
        {isOwner
          ? (item.purchasedByName ? `Claimed by ${item.purchasedByName}` : 'Someone has this covered!')
          : 'Already claimed'}
      </span>
    </div>
  ) : item.isPurchased && !showPurchasedStatus ? null : !showNamePrompt ? (
    <button
      onClick={() => setShowNamePrompt(true)}
      className="bg-green-500 text-white rounded-lg py-1.5 px-3 text-sm hover:bg-green-600 transition-colors whitespace-nowrap"
    >
      I'll get this! 🎁
    </button>
  ) : (
    <div className="flex flex-col gap-1.5 w-full">
      <input
        type="text"
        value={purchaserName}
        onChange={(e) => setPurchaserName(e.target.value)}
        placeholder="Your name"
        autoFocus
        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-full"
        onKeyDown={(e) => e.key === 'Enter' && handleClaim()}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowNamePrompt(false); setError(''); }}
          className="flex-1 text-sm border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleClaim}
          disabled={claiming || !purchaserName.trim()}
          className="flex-1 text-sm bg-green-500 text-white rounded-lg py-1.5 hover:bg-green-600 disabled:opacity-50"
        >
          {claiming ? 'Claiming…' : 'Confirm'}
        </button>
      </div>
    </div>
  );

  if (viewMode === 'list') {
    const priorityBadge: Record<string, string> = {
      HIGH: 'bg-red-50 text-red-600',
      MEDIUM: 'bg-amber-50 text-amber-600',
      LOW: 'bg-gray-100 text-gray-500',
    };
    const priorityText: Record<string, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

    return (
      <>
      <div
        className={`grid grid-cols-[3fr_1fr_1fr_1fr_auto] gap-4 items-start px-4 py-3 transition-colors ${
          item.isPurchased && showPurchasedStatus ? 'bg-green-50/40' : 'hover:bg-gray-50/60'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-10 h-10 object-contain flex-shrink-0 rounded-lg bg-gray-50"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
              🎁
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-medium leading-snug ${item.isPurchased && showPurchasedStatus ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {item.title}
              </p>
              {item.retailer && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{item.retailer}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {item.notes && (
                <span className="text-xs text-gray-400 truncate max-w-[200px]">{item.notes}</span>
              )}
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-amber-600 hover:underline flex-shrink-0">
                  View →
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="text-sm font-semibold text-amber-600 truncate">
          {item.price ?? <span className="text-gray-300">—</span>}
        </div>

        <div>
          {item.priority ? (
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge[item.priority]}`}>
              {priorityText[item.priority]}
            </span>
          ) : (
            <span className="text-gray-300 text-sm">—</span>
          )}
        </div>

        <div>{claimSection}</div>

        <div className="flex items-center justify-end gap-3 w-20">
          {isOwner && !showNamePrompt && (
            <>
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleRemove}
                disabled={deleting}
                className="text-xs text-gray-300 hover:text-red-400 transition-colors"
              >
                {deleting ? '…' : 'Remove'}
              </button>
            </>
          )}
        </div>
      </div>

      {showEdit && (
        <AddItemModal
          mode="catalog"
          editItem={item}
          onClose={() => setShowEdit(false)}
          onAdded={() => { setShowEdit(false); onChanged(); }}
        />
      )}
      </>
    );
  }

  // Grid view
  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
        item.isPurchased && showPurchasedStatus ? 'opacity-60 border-green-200' : 'border-gray-100 hover:shadow-md'
      }`}
    >
      {item.imageUrl && (
        <div className="w-full h-40 bg-gray-100 overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-contain p-2"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
            {item.title}
          </h3>
          {item.priority && (
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {priorityLabel[item.priority]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {item.price && (
            <p className="text-amber-600 font-semibold text-sm">{item.price}</p>
          )}
          {item.retailer && (
            <p className="text-gray-400 text-xs">{item.retailer}</p>
          )}
        </div>

        {item.notes && (
          <p className="text-gray-500 text-xs line-clamp-2">{item.notes}</p>
        )}

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-600 hover:underline truncate"
          >
            View product →
          </a>
        )}

        <div className="mt-1">{claimSection}</div>

        {isOwner && !showNamePrompt && (
          <div className="flex justify-between items-center mt-1">
            <button
              onClick={() => setShowEdit(true)}
              className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleRemove}
              disabled={deleting}
              className="text-xs text-gray-300 hover:text-red-400 transition-colors"
            >
              {deleting ? 'Removing…' : 'Remove'}
            </button>
          </div>
        )}
      </div>

      {showEdit && (
        <AddItemModal
          mode="catalog"
          editItem={item}
          onClose={() => setShowEdit(false)}
          onAdded={() => { setShowEdit(false); onChanged(); }}
        />
      )}
    </div>
  );
}
