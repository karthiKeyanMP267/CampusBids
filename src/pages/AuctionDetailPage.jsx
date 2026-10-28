import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Clock,
  Gavel,
  IndianRupee,
  AlertCircle,
  ChevronLeft,
  Shield,
  MapPin,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Trophy,
  Bot,
} from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown';
import { useAuth } from '../context/AuthContext';
import { SAMPLE_AUCTIONS, CONDITIONS, CATEGORIES } from '../lib/constants';
import { formatINR, getInitials, cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import Badge from '../components/ui/Badge';
import AutoBiddingCard from '../components/auction/AutoBiddingCard';
import AuctionQACard from '../components/auction/AuctionQACard';
import DealScoreBadge from '../components/auction/DealScoreBadge';
import AIAssistantDrawer from '../components/ai/AIAssistantDrawer';

export default function AuctionDetailPage() {
  const { id } = useParams();
  const { user, isAuthenticated, isConfigured } = useAuth();

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [handover, setHandover] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  // Load auction, bids, and handover data
  async function loadAuctionData() {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('auctions')
          .select('*, seller:profiles!seller_id(*)')
          .eq('id', id)
          .single();

        if (error) {
          console.warn('Supabase auction query note:', error.message);
        }

        if (data) {
          if (data.status === 'active' && new Date(data.closing_at).getTime() <= Date.now()) {
            data.status = data.bid_count > 0 ? 'pending_approval' : 'unsold';
            supabase.rpc('close_expired_auctions').catch(() => {});
          }
          setAuction(data);

          // Load bids
          const { data: bidsData } = await supabase
            .from('bids')
            .select('*, bidder:profiles!bidder_id(display_name, college, avatar_url)')
            .eq('auction_id', id)
            .order('created_at', { ascending: false });
          setBids(bidsData || []);

          // Load handover confirmation if status is approved or completed
          if (['approved', 'completed'].includes(data.status)) {
            const { data: handoverData } = await supabase
              .from('handover_confirmations')
              .select('*')
              .eq('auction_id', id)
              .maybeSingle();
            setHandover(handoverData);
          }

          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error loading auction data from Supabase:', err);
      }
    }

    // Fallback: check sample data
    const sample = SAMPLE_AUCTIONS.find((a) => a.id === id);
    if (sample) {
      setAuction(sample);
      setBids(generateSampleBids(sample));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAuctionData();

    if (!isConfigured || !supabase) return;

    // Realtime channel for this auction, bids, and handovers
    const channelName = `auction-room-${id}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setAuction((prev) => ({ ...prev, ...payload.new }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${id}`,
        },
        async (payload) => {
          // Fetch new bid with bidder profile
          const { data: newBid } = await supabase
            .from('bids')
            .select('*, bidder:profiles!bidder_id(display_name, college, avatar_url)')
            .eq('id', payload.new.id)
            .single();

          if (newBid) {
            setBids((prev) => [newBid, ...prev.filter((b) => b.id !== newBid.id)]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'handover_confirmations',
          filter: `auction_id=eq.${id}`,
        },
        (payload) => {
          if (payload.new) setHandover(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, isConfigured]);

  const conditionData = CONDITIONS.find((c) => c.id === auction?.condition);
  const categoryData = CATEGORIES.find((c) => c.id === auction?.category);

  // Minimum bid rule:
  // If no bids yet, minimum is starting_price.
  // If bids exist, minimum is current_bid + min_increment.
  const minBid = useMemo(() => {
    if (!auction) return 0;
    if (auction.bid_count === 0) return auction.starting_price;
    return (auction.current_bid || auction.starting_price) + auction.min_increment;
  }, [auction]);

  useEffect(() => {
    if (minBid > 0 && !bidAmount) {
      setBidAmount(String(minBid));
    }
  }, [minBid]);

  // Atomic bid submission
  async function handlePlaceBid(e) {
    e.preventDefault();
    setBidError('');
    setBidSuccess('');

    if (isWinningBidder) {
      setBidError('You are already the highest bidder! You can only place another bid if someone outbids you.');
      return;
    }

    const amount = Number(bidAmount);
    if (!amount || amount < minBid) {
      setBidError(`Minimum bid is ${formatINR(minBid)}`);
      return;
    }

    if (!isAuthenticated) {
      setBidError('You must be signed in with your campus account to place a bid.');
      return;
    }

    setBidLoading(true);

    try {
      if (isConfigured && supabase) {
        const { data, error } = await supabase.rpc('place_bid', {
          p_auction_id: auction.id,
          p_bidder_id: user.id,
          p_amount: amount,
        });

        if (error) throw error;

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        if (!result.success) {
          setBidError(result.error);
        } else {
          setBidSuccess(
            `Bid of ${formatINR(amount)} placed successfully!${
              result.anti_snipe ? ' ⏰ Anti-snipe: Auction extended by 60s!' : ''
            }`
          );
          setBidAmount(String(amount + auction.min_increment));
          // Refresh state immediately
          await loadAuctionData();
        }
      } else {
        // Demo fallback
        const newBid = {
          id: `bid-${Date.now()}`,
          amount,
          bidder: { display_name: user?.user_metadata?.display_name || 'You' },
          created_at: new Date().toISOString(),
        };
        setBids((prev) => [newBid, ...prev]);
        setAuction((prev) => ({
          ...prev,
          current_bid: amount,
          current_bidder_id: user?.id,
          bid_count: prev.bid_count + 1,
        }));
        setBidSuccess(`Demo bid of ${formatINR(amount)} placed!`);
        setBidAmount(String(amount + auction.min_increment));
      }
    } catch (err) {
      setBidError(err.message || 'Failed to place bid.');
    } finally {
      setBidLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-surface-900">Auction not found</h1>
        <p className="mt-2 text-surface-500">
          This auction does not exist or may have been removed.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-brand-600 font-medium hover:text-brand-700"
        >
          <ChevronLeft className="h-4 w-4" /> Back to home
        </Link>
      </div>
    );
  }

  const isOwner = user && auction.seller_id === user.id;
  const isWinningBidder = user && auction.current_bidder_id === user.id;
  const sellerName =
    auction.seller?.display_name || auction.seller?.name || 'Campus Student';
  const sellerCollege = auction.seller?.college || 'Campus Member';

  const images =
    auction.images && auction.images.length > 0
      ? auction.images
      : ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=600&fit=crop'];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-fade-in">
      {/* Breadcrumb */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-brand-600 transition-colors mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to auctions
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ─── Left 2 cols: Gallery & Details ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Cover Image */}
          <div className="overflow-hidden rounded-2xl border border-surface-200 bg-surface-100 aspect-[16/10] relative shadow-sm">
            <img
              src={images[selectedImage] || images[0]}
              alt={auction.title}
              className="h-full w-full object-cover transition-all duration-300"
            />
            <div className="absolute top-4 left-4 flex gap-2">
              <AuctionStatusBadge status={auction.status} />
              {conditionData && (
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm',
                    conditionData.color
                  )}
                >
                  {conditionData.label}
                </span>
              )}
            </div>
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    'h-18 w-24 shrink-0 rounded-xl overflow-hidden border-2 transition-all',
                    selectedImage === i
                      ? 'border-brand-600 ring-2 ring-brand-100'
                      : 'border-surface-200 opacity-60 hover:opacity-100'
                  )}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Title & Description */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-2 text-xs font-medium text-surface-400">
              <span className="capitalize">{categoryData?.label || auction.category}</span>
              <span>•</span>
              <span>Listed {new Date(auction.created_at).toLocaleDateString()}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 tracking-tight">
              {auction.title}
            </h1>
            <p className="mt-4 text-sm text-surface-600 leading-relaxed whitespace-pre-line">
              {auction.description || 'No description provided.'}
            </p>
          </div>

          {/* Transparent Deal Score Analysis */}
          <DealScoreBadge auction={auction} />

          {/* Seller Profile Card */}
          <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3">
              Seller Information
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700 font-semibold text-sm">
                {getInitials(sellerName)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-surface-900">{sellerName}</p>
                <div className="flex items-center gap-1.5 text-xs text-surface-500">
                  <MapPin className="h-3.5 w-3.5 text-surface-400" />
                  <span>{sellerCollege}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                <Shield className="h-3.5 w-3.5" />
                Verified Student
              </div>
            </div>
          </div>

          {/* Live Bid History Table */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-surface-500" />
                <h3 className="text-sm font-semibold text-surface-900">
                  Bid History ({bids.length})
                </h3>
              </div>
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Realtime Feed
              </span>
            </div>

            {bids.length > 0 ? (
              <div className="divide-y divide-surface-100 max-h-72 overflow-y-auto">
                {bids.map((b, i) => (
                  <div
                    key={b.id || i}
                    className="flex items-center justify-between py-3 text-sm animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-100 text-surface-700 text-xs font-bold">
                        {getInitials(b.bidder?.display_name || b.bidder_name || 'B')}
                      </div>
                      <div>
                        <p className="font-medium text-surface-900">
                          {b.bidder?.display_name || b.bidder_name || 'Student Bidder'}
                          {i === 0 && (
                            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Highest
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-surface-400">
                          {new Date(b.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-surface-900">
                      {formatINR(b.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-surface-400">
                <Gavel className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No bids placed yet. Be the first to bid!</p>
              </div>
            )}
          </div>

          {/* Public Questions & Answers (Q&A) */}
          <AuctionQACard auction={auction} />
        </div>

        {/* ─── Right 1 col: Bidding Panel & Workflows ─── */}
        <div className="space-y-6">
          {/* Live Countdown Card */}
          <CountdownCard closingAt={auction.closing_at} status={auction.status} />

          {/* AI Assistant Quick Advice Trigger */}
          <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-2xs shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-surface-900">AI Auction Advisor</h4>
                <p className="text-[11px] text-surface-500">Risk check, specs & checklist</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiDrawerOpen(true)}
              className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 transition-colors shadow-2xs shrink-0"
            >
              Ask AI
            </button>
          </div>

          {/* Current Bid & Pricing Summary */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-surface-500">
                {auction.bid_count > 0 ? 'Current Highest Bid' : 'Starting Price'}
              </span>
              <span className="text-xs text-surface-400">
                {auction.bid_count} {auction.bid_count === 1 ? 'bid' : 'bids'}
              </span>
            </div>

            <div className="text-3xl font-extrabold text-surface-900 tracking-tight">
              {formatINR(auction.current_bid || auction.starting_price)}
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-surface-500 pt-2 border-t border-surface-100">
              <span>Starting: {formatINR(auction.starting_price)}</span>
              <span>Min increment: +{formatINR(auction.min_increment)}</span>
            </div>

            {/* Bid Placement Form / Leading Bidder Banner */}
            {auction.status === 'active' && !isOwner && (
              isWinningBidder ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-xs animate-fade-in text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    You Are Currently the Highest Bidder!
                  </h4>
                  <p className="mt-1.5 text-xs text-emerald-800 leading-relaxed max-w-sm mx-auto">
                    Your bid of <strong className="font-bold text-emerald-950">{formatINR(auction.current_bid || auction.starting_price)}</strong> is currently leading. You can only place another bid if someone outbids you.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-emerald-800 bg-white/90 border border-emerald-200 py-2 px-3 rounded-xl shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live monitoring active — will unlock if outbid
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePlaceBid} className="mt-5 space-y-3">
                  {bidError && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{bidError}</span>
                    </div>
                  )}

                  {bidSuccess && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{bidSuccess}</span>
                    </div>
                  )}

                  <div className="relative">
                    <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                      type="number"
                      min={minBid}
                      step={auction.min_increment}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={`Min ₹${minBid}`}
                      disabled={bidLoading}
                      className="w-full rounded-xl border border-surface-200 bg-surface-50 py-3 pl-10 pr-4 text-base font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-surface-900"
                    />
                  </div>

                  {/* Quick increment buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      minBid,
                      minBid + auction.min_increment,
                      minBid + auction.min_increment * 2,
                    ].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setBidAmount(String(val))}
                        className="rounded-lg border border-surface-200 bg-surface-50 py-1.5 text-xs font-semibold text-surface-700 hover:bg-surface-100 transition-colors"
                      >
                        {formatINR(val)}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={bidLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {bidLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Gavel className="h-4 w-4" />
                        Place Bid ({formatINR(Number(bidAmount) || minBid)})
                      </>
                    )}
                  </button>

                  {!isAuthenticated && (
                    <p className="mt-2 text-xs text-center text-surface-500">
                      <Link
                        to="/login"
                        className="text-brand-600 font-medium hover:text-brand-700 underline"
                      >
                        Sign in with your campus account
                      </Link>{' '}
                      to bid
                    </p>
                  )}
                </form>
              )
            )}

            {isOwner && auction.status === 'active' && (
              <div className="mt-4 rounded-xl border border-surface-200 bg-surface-50 p-4 text-center">
                <p className="text-xs text-surface-500 font-medium">
                  This is your listing. As seller, you cannot bid on your own item.
                </p>
              </div>
            )}
          </div>

          {/* Automatic Proxy Bidding Card */}
          {auction.status === 'active' && !isOwner && (
            <AutoBiddingCard auction={auction} onUpdated={loadAuctionData} />
          )}

          {/* ─── Seller Approval Workflow ─── */}
          {isOwner && auction.status === 'pending_approval' && (
            <SellerApprovalCard
              auction={auction}
              onApproved={loadAuctionData}
            />
          )}

          {/* ─── Handover Confirmation Workflow ─── */}
          {(auction.status === 'approved' || auction.status === 'completed') && (
            <HandoverConfirmationCard
              auction={auction}
              handover={handover}
              isOwner={isOwner}
              isWinningBidder={isWinningBidder}
              onUpdated={loadAuctionData}
            />
          )}

          {/* Auction Integrity Rules Card */}
          <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-surface-900 mb-3">
              CampusBid Protections
            </h3>
            <ul className="space-y-2.5 text-xs text-surface-500">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Anti-Sniping:</strong> Bids in the final 30s automatically extend the auction by 60s.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Atomic Transactions:</strong> Database locking guarantees zero bid collisions.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Seller Approval:</strong> Winning bid is finalized by seller approval.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Safe Campus Handover:</strong> Mutual 2-step verification on campus.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        auction={auction}
        bids={bids}
      />
    </div>
  );
}

/* ── Countdown Component ────────────────────────── */

function CountdownCard({ closingAt, status }) {
  const remaining = useCountdown(closingAt);

  if (status !== 'active') {
    return (
      <div className="rounded-2xl border border-surface-200 bg-surface-50 p-5 text-center">
        <p className="text-sm font-semibold text-surface-700 capitalize">
          Auction {status.replace('_', ' ')}
        </p>
      </div>
    );
  }

  const urgencyColors = {
    critical: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    normal: 'bg-surface-50 border-surface-200 text-surface-700',
  };

  return (
    <div className={cn('rounded-2xl border p-5', urgencyColors[remaining.urgency])}>
      <div className="flex items-center gap-2 mb-3">
        <Clock
          className={cn(
            'h-4 w-4',
            remaining.urgency === 'critical' && 'animate-pulse'
          )}
        />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {remaining.urgency === 'critical' ? '⚡ Closing Very Soon!' : 'Time Remaining'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { value: remaining.days || 0, label: 'Days' },
          { value: remaining.hours || 0, label: 'Hours' },
          { value: remaining.minutes || 0, label: 'Min' },
          { value: remaining.seconds || 0, label: 'Sec' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-white/70 py-2 shadow-xs">
            <p className="text-2xl font-bold">{String(item.value).padStart(2, '0')}</p>
            <p className="text-[10px] uppercase tracking-wider opacity-60 font-medium">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Status Badge Component ─────────────────────── */

function AuctionStatusBadge({ status }) {
  const styles = {
    active: { variant: 'success', label: 'Active' },
    ended: { variant: 'default', label: 'Ended' },
    pending_approval: { variant: 'warning', label: 'Pending Approval' },
    approved: { variant: 'info', label: 'Approved' },
    sold: { variant: 'success', label: 'Sold' },
    unsold: { variant: 'default', label: 'Unsold' },
    cancelled: { variant: 'danger', label: 'Cancelled' },
    rejected: { variant: 'danger', label: 'Rejected' },
    completed: { variant: 'success', label: 'Completed' },
  };

  const s = styles[status] || styles.active;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

/* ── Seller Approval Card ───────────────────────── */

function SellerApprovalCard({ auction, onApproved }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleApproval(approved) {
    setLoading(true);
    setError('');
    try {
      if (supabase) {
        const { data, error: rpcError } = await supabase.rpc('seller_approve', {
          p_auction_id: auction.id,
          p_seller_id: user.id,
          p_approved: approved,
        });

        if (rpcError) throw rpcError;
        const result = typeof data === 'string' ? JSON.parse(data) : data;
        if (!result.success) {
          setError(result.error);
        } else {
          onApproved();
        }
      }
    } catch (err) {
      setError(err.message || 'Error updating approval status');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-amber-900 mb-1">
        Action Required: Approve Winning Bid
      </h3>
      <p className="text-xs text-amber-800 mb-4 leading-relaxed">
        The auction ended with a highest bid of{' '}
        <strong>{formatINR(auction.current_bid)}</strong>. Review and approve to
        unlock campus handover, or reject to cancel.
      </p>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => handleApproval(true)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Approve Bid
        </button>
        <button
          onClick={() => handleApproval(false)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white border border-surface-200 py-2.5 text-xs font-semibold text-surface-700 hover:bg-surface-50 disabled:opacity-50 transition-colors"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </button>
      </div>
    </div>
  );
}

/* ── Handover Confirmation Card ─────────────────── */

function HandoverConfirmationCard({
  auction,
  handover,
  isOwner,
  isWinningBidder,
  onUpdated,
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [location] = useState(handover?.meeting_location || 'Campus Student Center');
  const [error, setError] = useState('');

  const isCompleted = auction.status === 'completed';
  const sellerConfirmed = handover?.seller_confirmed;
  const buyerConfirmed = handover?.buyer_confirmed;

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      if (supabase) {
        const { error: rpcError } = await supabase.rpc('confirm_handover', {
          p_auction_id: auction.id,
          p_user_id: user.id,
          p_role: isOwner ? 'seller' : 'buyer',
          p_location: location,
        });

        if (rpcError) throw rpcError;
        onUpdated();
      }
    } catch (err) {
      setError(err.message || 'Failed to confirm handover');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-900 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-brand-600" />
          Campus Handover Protocol
        </h3>
        {isCompleted && (
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
            Completed
          </span>
        )}
      </div>

      <p className="text-xs text-brand-800 leading-relaxed">
        {isCompleted
          ? 'Both seller and buyer have confirmed the exchange! Handover is complete.'
          : 'Meet at a secure campus spot. When the exchange is made, both parties tap confirm.'}
      </p>

      {/* Meetup Spot */}
      <div className="rounded-xl bg-white p-3 border border-brand-100 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-surface-700">
          <MapPin className="h-3.5 w-3.5 text-brand-600" />
          <span>Meetup Location:</span>
        </div>
        <p className="text-xs text-surface-600 pl-5 font-medium">
          {handover?.meeting_location || 'Campus Student Center / Library Steps'}
        </p>
      </div>

      {/* Confirmation Badges */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div
          className={cn(
            'p-2.5 rounded-xl border flex items-center gap-2',
            sellerConfirmed
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
              : 'bg-white border-surface-200 text-surface-500'
          )}
        >
          {sellerConfirmed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 text-surface-400 shrink-0" />
          )}
          <span>Seller: {sellerConfirmed ? 'Confirmed' : 'Pending'}</span>
        </div>

        <div
          className={cn(
            'p-2.5 rounded-xl border flex items-center gap-2',
            buyerConfirmed
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
              : 'bg-white border-surface-200 text-surface-500'
          )}
        >
          {buyerConfirmed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 text-surface-400 shrink-0" />
          )}
          <span>Buyer: {buyerConfirmed ? 'Confirmed' : 'Pending'}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Action button */}
      {!isCompleted && (
        <div>
          {isOwner && !sellerConfirmed && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirm Item Handed to Buyer
            </button>
          )}

          {isWinningBidder && !buyerConfirmed && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirm Item Received & Verified
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Fallback Sample Bids Generator ─────────────── */

function generateSampleBids(auction) {
  if (auction.bid_count === 0) return [];
  const names = ['Arjun S.', 'Priya M.', 'Rahul K.', 'Sneha P.', 'Vikram T.', 'Kavya R.'];
  const bids = [];
  let currentAmount = auction.starting_price;

  for (let i = 0; i < auction.bid_count; i++) {
    currentAmount += auction.min_increment * (1 + Math.floor(Math.random() * 2));
    if (currentAmount > (auction.current_bid || auction.starting_price)) {
      currentAmount = auction.current_bid || auction.starting_price;
    }
    bids.push({
      id: `bid-${i}`,
      amount: i === auction.bid_count - 1 ? (auction.current_bid || auction.starting_price) : currentAmount,
      bidder_name: names[i % names.length],
      bidder: { display_name: names[i % names.length] },
      created_at: new Date(Date.now() - (auction.bid_count - i) * 15 * 60 * 1000).toISOString(),
    });
  }

  return bids.reverse();
}
