import { Layout } from '../components/Layout';
import { WishlistSearch } from '../components/WishlistSearch';

export function SearchPage() {
  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Find a Wishlist</h1>
        <WishlistSearch
          autoFocus
          placeholder="Search by name, alias, or person…"
          inputClassName="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm"
        />
        <p className="text-sm text-gray-400 mt-3">
          Search by wishlist name, custom alias, or the owner's name.
        </p>
      </div>
    </Layout>
  );
}
