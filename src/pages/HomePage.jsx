import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import AuctionCard from '../components/auction/AuctionCard';
import CategoryBar from '../components/ui/CategoryBar';
import { SAMPLE_AUCTIONS, getClosingSoon, getFeatured } from '../lib/constants';

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAuctions = useMemo(() => {
    let items = SAMPLE_AUCTIONS;
    if (selectedCategory) {
      items = items.filter((a) => a.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }
    return items;
  }, [selectedCategory, searchQuery]);

  const closingSoon = useMemo(() => getClosingSoon(SAMPLE_AUCTIONS, 120), []);
  const featured = useMemo(() => getFeatured(SAMPLE_AUCTIONS, 4), []);

  return (
    <div className="animate-fade-in">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
        {/* Decorative grid */}
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
              Trusted by 2,000+ students across 50+ campuses
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
              Buy & sell on campus,
              <br />
              <span className="text-brand-200">the fair way.</span>
            </h1>

            <p className="mt-5 text-lg text-brand-100/90 max-w-lg leading-relaxed">
              Transparent auctions for textbooks, electronics, furniture, and
              everything students need. No haggling, no lowballing — just fair
              prices.
            </p>

            {/* Hero search */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-surface-400" />
                <input
                  type="text"
                  placeholder="What are you looking for?"
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
              { label: 'Active Auctions', value: '340+' },
              { label: 'Items Sold', value: '1,200+' },
              { label: 'Happy Students', value: '2,000+' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-brand-200/80 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: ShieldCheck,
              title: 'Verified Students',
              desc: 'Only verified campus accounts can list and bid. Your community, your marketplace.',
            },
            {
              icon: TrendingUp,
              title: 'Transparent Pricing',
              desc: 'Every bid is visible. No hidden fees, no dark patterns. The best price wins.',
            },
            {
              icon: Handshake,
              title: 'Campus Handover',
              desc: 'Meet on campus for safe exchanges. No shipping hassles, no scam risks.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-surface-200 bg-white p-5 transition-all hover:shadow-md hover:border-surface-300"
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
                <p className="text-xs text-surface-400">Don't miss your chance to bid</p>
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

      {/* ─── Categories + All Auctions ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900">Browse Auctions</h2>
              <p className="text-xs text-surface-400">
                {filteredAuctions.length} auction{filteredAuctions.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
        </div>

        {/* Category filter */}
        <div className="mb-6">
          <CategoryBar selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>

        {/* Grid */}
        {filteredAuctions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
            {filteredAuctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} className="animate-fade-in-up" />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-200 text-surface-400 mb-4">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-surface-700">No auctions found</h3>
            <p className="mt-1 text-sm text-surface-400">
              Try adjusting your filters or search terms.
            </p>
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
              Got something to sell?
            </h2>
            <p className="mt-2 text-brand-100/90 max-w-md mx-auto">
              List your item in under 2 minutes. Set your price, upload photos,
              and let the bids roll in.
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
