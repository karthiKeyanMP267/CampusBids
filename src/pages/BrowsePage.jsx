import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  IndianRupee,
  PackageOpen,
  Plus,
  Bookmark,
} from 'lucide-react';
import AuctionCard from '../components/auction/AuctionCard';
import CategoryBar from '../components/ui/CategoryBar';
import SavedSearchesModal from '../components/search/SavedSearchesModal';
import { CONDITIONS, SAMPLE_AUCTIONS } from '../lib/constants';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest First' },
  { id: 'closing', label: 'Ending Soon' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'bids', label: 'Most Bids' },
];

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(false);
  const isConfigured = isSupabaseConfigured();

  // Filter state from URL params
  const searchQuery = searchParams.get('q') || '';
  const selectedCategory = searchParams.get('category') || null;
  const selectedCondition = searchParams.get('condition') || null;
  const sortBy = searchParams.get('sort') || 'newest';
  const maxPrice = searchParams.get('maxPrice') || '';
  const closingSoon = searchParams.get('closingSoon') === 'true';

  // Load real data from Supabase
  async function loadAuctions() {
    if (!isConfigured || !supabase) {
      setAuctions(SAMPLE_AUCTIONS);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Trigger opportunistic closing of expired auctions
      try {
        await supabase.rpc('close_expired_auctions');
      } catch (e) {
        console.warn('Auto-close expired auctions note:', e.message);
      }

      let query = supabase
        .from('auctions')
        .select('*, seller:profiles!seller_id(display_name, college, avatar_url)')
        .eq('status', 'active')
        .gt('closing_at', new Date().toISOString());

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }
      if (selectedCondition) {
        query = query.eq('condition', selectedCondition);
      }
      if (closingSoon) {
        const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        query = query.lte('closing_at', cutoff);
      }

      // Sorting
      if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'closing') {
        query = query.order('closing_at', { ascending: true });
      } else if (sortBy === 'price_asc') {
        query = query.order('current_bid', { ascending: true, nullsFirst: true });
      } else if (sortBy === 'price_desc') {
        query = query.order('current_bid', { ascending: false });
      } else if (sortBy === 'bids') {
        query = query.order('bid_count', { ascending: false });
      }

      const { data, error: qError } = await query;
      if (qError) throw qError;

      if (data) {
        const mapped = data.map((a) => ({
          ...a,
          seller: {
            name: a.seller?.display_name || 'Campus Student',
            college: a.seller?.college || 'Campus',
            avatar: a.seller?.avatar_url,
          },
        }));
        setAuctions(mapped);
      }
    } catch (e) {
      console.error('Failed to load auctions:', e);
      setError(e.message || 'Failed to load auctions');
      // If error occurs, fallback gracefully to sample so page doesn't break
      if (!auctions.length) setAuctions(SAMPLE_AUCTIONS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuctions();

    if (!isConfigured || !supabase) return;

    // Realtime subscription for auction changes
    const channelName = `browse-auctions-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auctions' },
        () => {
          loadAuctions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCategory, selectedCondition, sortBy, closingSoon, isConfigured]);

  function updateParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  }

  function clearAllFilters() {
    setSearchParams(new URLSearchParams());
  }

  // Client-side text search & price filtering for instantaneous responsive feel
  const filtered = useMemo(() => {
    let items = auctions;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.description || '').toLowerCase().includes(q)
      );
    }

    if (maxPrice) {
      const max = Number(maxPrice);
      items = items.filter(
        (a) => (a.current_bid || a.starting_price) <= max
      );
    }

    return items;
  }, [auctions, searchQuery, maxPrice]);

  const activeFilterCount = [
    selectedCategory,
    selectedCondition,
    maxPrice,
    closingSoon,
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">
            Browse Auctions
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            {loading ? (
              'Loading active campus listings…'
            ) : (
              `${filtered.length} active auction${filtered.length !== 1 ? 's' : ''} found`
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'sm:hidden flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
              showFilters || activeFilterCount > 0
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-surface-200 bg-white text-surface-700 hover:bg-surface-50'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Saved Searches Button */}
          <button
            type="button"
            onClick={() => setSavedSearchesOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-surface-700 hover:bg-surface-50 shadow-2xs transition-colors"
            title="Save this search or view match alerts"
          >
            <Bookmark className="h-4 w-4 text-brand-600" />
            <span className="hidden sm:inline">Saved Searches</span>
          </button>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="appearance-none rounded-xl border border-surface-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-surface-700 shadow-sm outline-none transition-colors hover:border-surface-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ArrowUpDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" />
          </div>
        </div>
      </div>

      {/* Category Bar */}
      <div className="mb-6">
        <CategoryBar
          selected={selectedCategory}
          onSelect={(id) => updateParam('category', id)}
        />
      </div>

      <div className="flex gap-8">
        {/* ─── Desktop Filter Sidebar ─── */}
        <aside className="hidden sm:block w-60 shrink-0 space-y-6">
          {/* Search */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search listings…"
                value={searchQuery}
                onChange={(e) => updateParam('q', e.target.value || null)}
                className="w-full rounded-xl border border-surface-200 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">
              Condition
            </label>
            <div className="space-y-1.5">
              <button
                onClick={() => updateParam('condition', null)}
                className={cn(
                  'w-full text-left rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  !selectedCondition
                    ? 'font-semibold text-brand-600 bg-brand-50'
                    : 'text-surface-600 hover:bg-surface-50'
                )}
              >
                All Conditions
              </button>
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => updateParam('condition', c.id)}
                  className={cn(
                    'w-full text-left rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                    selectedCondition === c.id
                      ? 'font-semibold text-brand-600 bg-brand-50'
                      : 'text-surface-600 hover:bg-surface-50'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">
              Max Price (₹)
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" />
              <input
                type="number"
                placeholder="e.g. 5000"
                value={maxPrice}
                onChange={(e) => updateParam('maxPrice', e.target.value || null)}
                className="w-full rounded-xl border border-surface-200 bg-white py-2 pl-8 pr-3 text-sm outline-none placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          {/* Closing Soon Toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={closingSoon}
                onChange={(e) =>
                  updateParam('closingSoon', e.target.checked ? 'true' : null)
                }
                className="rounded border-surface-300 text-brand-600 focus:ring-brand-400"
              />
              <span className="text-sm font-medium text-surface-700">
                Closing Soon (24h)
              </span>
            </label>
          </div>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="w-full rounded-xl border border-surface-200 py-2 text-xs font-semibold text-surface-600 hover:bg-surface-50 transition-colors"
            >
              Clear All Filters ({activeFilterCount})
            </button>
          )}
        </aside>

        {/* ─── Mobile Filters Drawer ─── */}
        {showFilters && (
          <div className="fixed inset-0 z-50 sm:hidden bg-black/40 backdrop-blur-sm flex justify-end">
            <div className="w-80 bg-white h-full p-6 overflow-y-auto space-y-6 animate-slide-in">
              <div className="flex items-center justify-between pb-4 border-b border-surface-100">
                <h3 className="font-bold text-surface-900">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="rounded-lg p-1 text-surface-400 hover:text-surface-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-semibold uppercase text-surface-500 mb-2">
                  Condition
                </label>
                <div className="space-y-1">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        updateParam('condition', c.id);
                        setShowFilters(false);
                      }}
                      className={cn(
                        'w-full text-left rounded-lg px-3 py-2 text-sm',
                        selectedCondition === c.id
                          ? 'font-semibold text-brand-600 bg-brand-50'
                          : 'text-surface-600'
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold uppercase text-surface-500 mb-2">
                  Max Price
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={maxPrice}
                  onChange={(e) => updateParam('maxPrice', e.target.value || null)}
                  className="w-full rounded-xl border border-surface-200 p-2.5 text-sm"
                />
              </div>

              <button
                onClick={() => setShowFilters(false)}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* ─── Main Content Grid ─── */}
        <main className="flex-1">
          {error && (
            <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={loadAuctions}
                className="font-semibold underline text-amber-900 hover:text-amber-950"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-surface-200 bg-white p-4 animate-pulse"
                >
                  <div className="aspect-[4/3] bg-surface-100 rounded-xl mb-4" />
                  <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-surface-100 rounded w-1/2 mb-4" />
                  <div className="h-6 bg-surface-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
              {filtered.map((auction) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  className="animate-fade-in-up"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-200 text-surface-400 mb-4">
                <PackageOpen className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-surface-900">
                No matching auctions
              </h3>
              <p className="mt-1 text-sm text-surface-500 max-w-sm mx-auto">
                No auctions match your current search and filter criteria.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-medium text-surface-700 shadow-sm hover:bg-surface-50"
                  >
                    Reset Filters
                  </button>
                )}
                <Link
                  to="/create"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  Create a Listing
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Saved Searches & Alerts Modal */}
      <SavedSearchesModal
        isOpen={savedSearchesOpen}
        onClose={() => setSavedSearchesOpen(false)}
        currentCriteria={{
          query: searchQuery,
          category: selectedCategory,
          condition: selectedCondition,
          max_price: maxPrice ? Number(maxPrice) : null,
        }}
        onApplySearch={(saved) => {
          if (saved.query !== undefined) updateParam('q', saved.query);
          if (saved.category !== undefined) updateParam('category', saved.category);
          if (saved.condition !== undefined) updateParam('condition', saved.condition);
          if (saved.max_price !== undefined) updateParam('maxPrice', saved.max_price ? String(saved.max_price) : null);
        }}
      />
    </div>
  );
}
