import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Clock,
  IndianRupee,
  Filter,
} from 'lucide-react';
import AuctionCard from '../components/auction/AuctionCard';
import CategoryBar from '../components/ui/CategoryBar';
import { SAMPLE_AUCTIONS, CONDITIONS, CATEGORIES } from '../lib/constants';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
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
  const [auctions, setAuctions] = useState(SAMPLE_AUCTIONS);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state from URL params
  const searchQuery = searchParams.get('q') || '';
  const selectedCategory = searchParams.get('category') || null;
  const selectedCondition = searchParams.get('condition') || null;
  const sortBy = searchParams.get('sort') || 'newest';
  const maxPrice = searchParams.get('maxPrice') || '';
  const closingSoon = searchParams.get('closingSoon') === 'true';

  // Load real data if Supabase is configured
  useEffect(() => {
    async function loadAuctions() {
      if (!isSupabaseConfigured()) return;
      setLoading(true);
      try {
        const supabase = await getSupabase();
        if (!supabase) return;

        let query = supabase
          .from('auctions')
          .select('*, seller:profiles!seller_id(display_name, college, avatar_url)')
          .eq('status', 'active');

        if (selectedCategory) query = query.eq('category', selectedCategory);
        if (selectedCondition) query = query.eq('condition', selectedCondition);
        if (maxPrice) query = query.lte('current_bid', Number(maxPrice));
        if (closingSoon) {
          const cutoff = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          query = query.lte('closing_at', cutoff);
        }

        if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
        else if (sortBy === 'closing') query = query.order('closing_at', { ascending: true });
        else if (sortBy === 'price_asc') query = query.order('current_bid', { ascending: true, nullsFirst: true });
        else if (sortBy === 'price_desc') query = query.order('current_bid', { ascending: false });
        else if (sortBy === 'bids') query = query.order('bid_count', { ascending: false });

        const { data } = await query;
        if (data) {
          // Transform to match card format
          setAuctions(data.map((a) => ({
            ...a,
            seller: {
              name: a.seller?.display_name,
              college: a.seller?.college,
              avatar: a.seller?.avatar_url,
            },
          })));
        }
      } catch (e) {
        console.error('Failed to load auctions:', e);
      } finally {
        setLoading(false);
      }
    }
    loadAuctions();
  }, [selectedCategory, selectedCondition, sortBy, maxPrice, closingSoon]);

  function updateParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  }

  // Client-side filtering for sample data
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

    if (selectedCategory && !isSupabaseConfigured()) {
      items = items.filter((a) => a.category === selectedCategory);
    }
    if (selectedCondition && !isSupabaseConfigured()) {
      items = items.filter((a) => a.condition === selectedCondition);
    }
    if (maxPrice && !isSupabaseConfigured()) {
      items = items.filter((a) => (a.current_bid || a.starting_price) <= Number(maxPrice));
    }
    if (closingSoon && !isSupabaseConfigured()) {
      const cutoff = Date.now() + 60 * 60 * 1000;
      items = items.filter((a) => new Date(a.closing_at).getTime() <= cutoff);
    }

    // Sort (sample data only)
    if (!isSupabaseConfigured()) {
      switch (sortBy) {
        case 'closing':
          items = [...items].sort((a, b) => new Date(a.closing_at) - new Date(b.closing_at));
          break;
        case 'price_asc':
          items = [...items].sort((a, b) => (a.current_bid || a.starting_price) - (b.current_bid || b.starting_price));
          break;
        case 'price_desc':
          items = [...items].sort((a, b) => (b.current_bid || b.starting_price) - (a.current_bid || a.starting_price));
          break;
        case 'bids':
          items = [...items].sort((a, b) => b.bid_count - a.bid_count);
          break;
        default:
          break;
      }
    }

    return items;
  }, [auctions, searchQuery, selectedCategory, selectedCondition, sortBy, maxPrice, closingSoon]);

  const activeFilterCount = [selectedCategory, selectedCondition, maxPrice, closingSoon].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900">Browse Auctions</h1>
        <p className="mt-1 text-sm text-surface-500">
          {filtered.length} auction{filtered.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Search + Sort bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search auctions…"
            value={searchQuery}
            onChange={(e) => updateParam('q', e.target.value)}
            className="w-full rounded-xl border border-surface-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 placeholder:text-surface-400"
          />
          {searchQuery && (
            <button
              onClick={() => updateParam('q', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
              showFilters || activeFilterCount > 0
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'
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

          <select
            value={sortBy}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-600 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category pills */}
      <div className="mb-4">
        <CategoryBar
          selected={selectedCategory}
          onSelect={(cat) => updateParam('category', cat)}
        />
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="rounded-2xl border border-surface-200 bg-white p-5 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </h3>
            <button
              onClick={() => {
                updateParam('condition', '');
                updateParam('maxPrice', '');
                updateParam('closingSoon', '');
              }}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Condition */}
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1.5">Condition</label>
              <select
                value={selectedCondition || ''}
                onChange={(e) => updateParam('condition', e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2 px-3 text-sm outline-none focus:border-brand-400"
              >
                <option value="">All conditions</option>
                {CONDITIONS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Max price */}
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1.5">Max price (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" />
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => updateParam('maxPrice', e.target.value)}
                  placeholder="No limit"
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 placeholder:text-surface-400"
                />
              </div>
            </div>

            {/* Closing soon */}
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1.5">Time</label>
              <button
                onClick={() => updateParam('closingSoon', closingSoon ? '' : 'true')}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-sm font-medium transition-all',
                  closingSoon
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-surface-200 bg-surface-50 text-surface-600 hover:bg-surface-100'
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Closing within 1 hour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
          {filtered.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} className="animate-fade-in-up" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-200 text-surface-400 mb-4">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-surface-700">No auctions found</h3>
          <p className="mt-2 text-sm text-surface-400 max-w-sm mx-auto">
            Try adjusting your search terms or filters. New items are listed every day!
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setSearchParams({})}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <X className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
