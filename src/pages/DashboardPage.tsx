import { useEffect, useState, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';
import { Layout } from '../components/Layout';
import { WishlistCard } from '../components/WishlistCard';
import { CreateWishlistModal } from '../components/CreateWishlistModal';

const client = generateClient<Schema>();

type Wishlist = Schema['Wishlist']['type'];

export function DashboardPage() {
  const { user } = useAuthenticator((ctx) => [ctx.user]);
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [ownerName, setOwnerName] = useState('');

  useEffect(() => {
    fetchUserAttributes().then((attrs) => {
      setOwnerName(attrs.name ?? attrs.email ?? user.userId);
    });
  }, [user]);

  const loadWishlists = useCallback(async () => {
    setLoading(true);
    try {
      const { username, userId } = await getCurrentUser();
      const { data } = await client.models.Wishlist.list();
      // Filter to only this user's lists. The owner field is set to
      // cognito:username at creation time; for federated logins that
      // can be the username OR the sub UUID, so we check both.
      const mine = data.filter(
        (wl) => wl.owner === username || wl.owner === userId
      );
      setWishlists(
        [...mine].sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
        )
      );
    } catch (err) {
      console.error('Failed to load wishlists:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWishlists();
  }, [loadWishlists]);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Wishlists</h1>
          {ownerName && (
            <p className="text-gray-500 text-sm mt-0.5">
              Signed in as {ownerName}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-amber-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-amber-600 transition-colors"
        >
          + New list
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
        </div>
      ) : wishlists.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎁</div>
          <p className="text-gray-500 text-lg">No wishlists yet.</p>
          <p className="text-gray-400 text-sm mt-1">
            Create your first list and share it with family!
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 bg-amber-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-amber-600 transition-colors"
          >
            Create a wishlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wishlists.map((wl) => (
            <WishlistCard
              key={wl.id}
              wishlist={wl}
              onDeleted={loadWishlists}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateWishlistModal
          ownerName={ownerName}
          onClose={() => setShowCreate(false)}
          onCreated={loadWishlists}
        />
      )}
    </Layout>
  );
}
