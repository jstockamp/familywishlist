import { useEffect, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
  const { user, signOut } = useAuthenticator((ctx) => [ctx.user, ctx.signOut]);
  const [displayName, setDisplayName] = useState('');
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    fetchUserAttributes()
      .then((attrs) => {
        setDisplayName(attrs.name ?? attrs.email ?? user.signInDetails?.loginId ?? '');
      })
      .catch(() => {});
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      {showNav && (
        <header className="bg-white shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 text-xl font-bold text-amber-600">
                🎁 Wishlist
              </Link>
              {user && (
                <nav className="hidden sm:flex items-center gap-1">
                  <Link
                    to="/"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === '/'
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    My Wishlists
                  </Link>
                  <Link
                    to="/items"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === '/items'
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    My Items
                  </Link>
                </nav>
              )}
            </div>
            {user && (
              <div className="flex items-center gap-4">
                {displayName && (
                  <span className="text-sm text-gray-600 hidden sm:block">{displayName}</span>
                )}
                <button
                  onClick={signOut}
                  className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>
      )}
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
