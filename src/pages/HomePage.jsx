import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  Sparkles,
  Clock,
  ShieldCheck,
  Handshake,
  TrendingUp,
  Plus,
  Loader2,
  PackageOpen,
} from 'lucide-react';
import AuctionCard from '../components/auction/AuctionCard';
import CategoryBar from '../components/ui/CategoryBar';
import { SAMPLE_AUCTIONS } from '../lib/constants';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const isConfigured = isSupabaseConfigured();

  // Load real auctions from Supabase
  async function loadRealAuctions() {
    if (!isConfigured || !supabase) {
      setAuctions(SAMPLE_AUCTIONS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('auctions')
        .select('*, seller:profiles!seller_id(display_name, college, avatar_url)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching auctions from Supabase:', error);
        setAuctions(SAMPLE_AUCTIONS);
      } else if (data) {
        const formatted = data.map((a) => ({
          ...a,
          seller: {
            name: a.seller?.display_name || 'Campus Student',
            college: a.seller?.college || 'Campus',
            avatar: a.seller?.avatar_url,
          },
        }));
        setAuctions(formatted);
      }
    } catch (err) {
      console.error('Error loading auctions:', err);
      setAuctions(SAMPLE_AUCTIONS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRealAuctions();

    if (!isConfigured || !supabase) return;

    // Realtime subscription for newly created or updated auctions
    const channel = supabase
      .channel('home-auctions-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auctions' },
        () => {
          loadRealAuctions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isConfigured]);

  // Seed demo items to database for quick hackathon presentation
  async function handleSeedDemoData() {
    if (!user || !supabase) return;
    try {
      setSeeding(true);
      const itemsToSeed = SAMPLE_AUCTIONS.slice(0, 4).map((item) => ({
        seller_id: user.id,
        title: item.title,
        description: item.description,
        category: item.category,
        condition: item.condition === 'like_new' ? 'like_new' : 'good',
        images: item.images,
        starting_price: item.starting_price,
        min_increment: item.min_increment,
        closing_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        status: 'active',
      }));

      const { error } = await supabase.from('auctions').insert(itemsToSeed);
      if (error) throw error;
      await loadRealAuctions();
    } catch (e) {
      console.error('Failed to seed demo data:', e);
      alert('Seeding error: ' + e.message);
    } finally {
      setSeeding(false);
    }
  }

  // Filtered auctions based on category and search query
  const filteredAuctions = useMemo(() => {
    let items = auctions;
    if (selectedCategory) {
      items = items.filter((a) => a.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.description || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [auctions, selectedCategory, searchQuery]);

  // Closing soon: closing within 24 hours
  const closingSoon = useMemo(() => {
    const now = Date.now();
    const cutoff = now + 24 * 60 * 60 * 1000;
    return auctions
      .filter((a) => {
        const time = new Date(a.closing_at).getTime();
        return time > now && time <= cutoff;
      })
      .sort((a, b) => new Date(a.closing_at) - new Date(b.closing_at));
  }, [auctions]);

  return (
    <div className="animate-fade-in">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
        <div className="absolute inset-0 opacity-10">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Trusted by 2,000+ students across campuses
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
              Buy & sell on campus,
              <br />
              <span className="text-brand-200">the fair way.</span>
            </h1>

            <p className="mt-5 text-lg text-brand-100/90 max-w-lg leading-relaxed">
              Transparent live auctions for textbooks, electronics, dorm essentials,
              and gear. Zero haggling, live anti-sniping rules, and safe in-person campus handover.
            </p>

            {/* Hero search */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search textbooks, laptops, bikes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl bg-white py-3 pl-11 pr-4 text-sm text-surface-900 shadow-lg outline-none placeholder:text-surface-400 focus:ring-2 focus:ring-brand-300"
                />
              </div>
              <Link
                to="/browse"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-700 shadow-lg transition-all hover:bg-brand-50 active:scale-[0.97]"
              >
                Browse All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-4 max-w-md">
            {[
              { label: 'Active Auctions', value: `${auctions.length}+` },
              { label: 'Fair Bidding', value: '100%' },
              { label: 'Campus Meetup', value: 'Verified' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-white/10 p-3 text-center backdrop-blur-sm"
              >
                <div className="text-xl sm:text-2xl font-bold text-white">
                  {stat.value}
                </div>
                <div className="text-xs text-brand-200/80 mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Value Props ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 relative z-10 mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: ShieldCheck,
              title: 'Student-Only Marketplace',
              desc: 'Only authenticated campus peers list and bid. Your community, your trusted network.',
            },
            {
              icon: TrendingUp,
              title: 'Atomic Live Auctions',
              desc: 'Every bid is locked and validated server-side. Real-time updates with anti-sniping protection.',
            },
            {
              icon: Handshake,
              title: 'Secure Campus Handover',
              desc: 'Two-party confirmation protocol for safe, in-person campus item handovers.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-surface-300"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-surface-900">{item.title}</h3>
                <p className="mt-1 text-sm text-surface-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Closing Soon ─── */}
      {closingSoon.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-surface-900">Closing Soon</h2>
                <p className="text-xs text-surface-400">Items ending in the next 24 hours</p>
              </div>
            </div>
            <Link
              to="/browse?sort=closing"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
            {closingSoon.slice(0, 4).map((auction) => (
              <AuctionCard key={auction.id} auction={auction} className="animate-fade-in-up" />
            ))}
          </div>
        </section>
      )}

      {/* ─── Categories + Live Auctions Feed ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900">Active Campus Auctions</h2>
              <p className="text-xs text-surface-400">
                {filteredAuctions.length} live auction{filteredAuctions.length !== 1 ? 's' : ''} in your database
              </p>
            </div>
          </div>
        </div>

        {/* Category filter */}
        <div className="mb-6">
          <CategoryBar selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border border-surface-200 bg-white p-4 animate-pulse">
                <div className="aspect-[4/3] bg-surface-100 rounded-xl mb-4" />
                <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-surface-100 rounded w-1/2 mb-4" />
                <div className="h-6 bg-surface-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filteredAuctions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
            {filteredAuctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} className="animate-fade-in-up" />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 mb-4">
              <PackageOpen className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-surface-900">No active auctions found</h3>
            <p className="mt-1 text-sm text-surface-500 max-w-sm mx-auto">
              {searchQuery || selectedCategory
                ? 'Try clearing your filters or searching for something else.'
                : 'Your database is connected and ready. Be the first student to create a listing!'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/create"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Post First Auction
              </Link>
              {user && (
                <button
                  type="button"
                  onClick={handleSeedDemoData}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-medium text-surface-700 shadow-sm hover:bg-surface-50 transition-colors disabled:opacity-50"
                >
                  {seeding && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
                  Seed 4 Demo Listings into DB
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-800 p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
          </div>
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Got textbooks, electronics, or dorm gear to sell?
            </h2>
            <p className="mt-2 text-brand-100/90 max-w-md mx-auto">
              List your item in under 2 minutes. Transparent bids, automated timer extensions,
              and safe campus meetups.
            </p>
            <Link
              to="/create"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-lg transition-all hover:bg-brand-50 active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Create Listing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
