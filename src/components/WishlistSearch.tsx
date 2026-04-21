import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const guestClient = generateClient<Schema>({ authMode: 'iam' });

type WishlistResult = {
  id: string;
  name: string;
  ownerName?: string | null;
  alias?: string | null;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  inputClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function WishlistSearch({
  inputClassName = 'w-full pl-12 pr-4 py-4 text-lg bg-white rounded-2xl shadow-md border border-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent',
  placeholder = 'Search wishlists…',
  autoFocus = false,
}: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WishlistResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);

  const search = useCallback(async (q: string) => {
    if (!q) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const lower = q.toLowerCase();
      const { data } = await guestClient.models.Wishlist.list({
        filter: {
          or: [
            { name: { contains: q } },
            { name: { contains: lower } },
            { alias: { contains: lower } },
            { ownerName: { contains: q } },
            { ownerName: { contains: lower } },
          ],
        },
      });
      const seen = new Set<string>();
      const deduped: WishlistResult[] = [];
      for (const wl of data) {
        if (!seen.has(wl.id)) {
          seen.add(wl.id);
          deduped.push({ id: wl.id, name: wl.name, ownerName: wl.ownerName, alias: wl.alias });
        }
      }
      setResults(deduped.slice(0, 8));
      setOpen(true);
      setActiveIndex(-1);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => { search(debouncedQuery); }, [debouncedQuery, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectResult(wl: WishlistResult) {
    setOpen(false);
    setQuery('');
    navigate(`/wishlist/${wl.alias ?? wl.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectResult(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {searching ? (
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
        />
      </div>

      {open && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
        >
          {results.map((wl, i) => (
            <button
              key={wl.id}
              onMouseDown={(e) => { e.preventDefault(); selectResult(wl); }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                i === activeIndex ? 'bg-amber-50' : 'hover:bg-gray-50'
              } ${i > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{wl.name}</p>
                {wl.ownerName && (
                  <p className="text-sm text-gray-400 truncate">by {wl.ownerName}</p>
                )}
              </div>
              {wl.alias && (
                <span className="flex-shrink-0 text-xs font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                  /{wl.alias}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && !searching && query.trim() && results.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-4 text-center text-gray-400 z-50"
        >
          No wishlists found for "{query}"
        </div>
      )}
    </div>
  );
}
