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

      {/* Extra bottom padding on mobile so content isn't hidden behind the tab bar */}
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 sm:pb-8">{children}</main>

      {/* Mobile bottom tab bar */}
      {showNav && user && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex z-40">
          <Link
            to="/"
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              location.pathname === '/'
                ? 'text-amber-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
              <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.432z" />
            </svg>
            My Wishlists
          </Link>
          <Link
            to="/items"
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              location.pathname === '/items'
                ? 'text-amber-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375zM6 12a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V12zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM6 15a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V15zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM6 18a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V18zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
            My Items
          </Link>
        </nav>
      )}
    </div>
  );
}
