import { Link } from 'react-router-dom';
import { WishlistSearch } from '../components/WishlistSearch';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl font-bold text-amber-600">
          🎁 Wishlist
        </div>
        <Link
          to="/login"
          className="text-sm font-medium text-amber-700 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
        >
          Sign in
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎁</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Find a Wishlist
          </h1>
          <p className="text-gray-500 text-lg">
            Search by name, alias, or the person's name
          </p>
        </div>

        <div className="w-full max-w-lg">
          <WishlistSearch autoFocus />
        </div>

        <p className="mt-8 text-gray-400 text-sm">
          Want to create your own wishlist?{' '}
          <Link to="/login" className="text-amber-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
