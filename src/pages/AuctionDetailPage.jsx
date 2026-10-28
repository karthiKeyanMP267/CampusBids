import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Clock,
  User,
  TrendingUp,
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
  ArrowUp,
} from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown';
import { useAuth } from '../context/AuthContext';
import { SAMPLE_AUCTIONS, CONDITIONS, CATEGORIES } from '../lib/constants';
import { formatINR, getInitials, cn } from '../lib/utils';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import Badge from '../components/ui/Badge';

export default function AuctionDetailPage() {
  const { id } = useParams();
  const { user, isAuthenticated, isConfigured } = useAuth();

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);

  // Load auction data
  useEffect(() => {
    async function load() {
      if (isConfigured) {
        const supabase = await getSupabase();
        if (supabase) {
          const { data } = await supabase
            .from('auctions')
            .select('*, seller:profiles!seller_id(*)')
            .eq('id', id)
            .single();

          if (data) {
            setAuction(data);
            // Load bids
            const { data: bidsData } = await supabase
              .from('bids')
              .select('*, bidder:profiles!bidder_id(display_name, college)')
              .eq('auction_id', id)
              .order('created_at', { ascending: false });
            setBids(bidsData || []);
            setLoading(false);

            // Set up realtime subscriptions
            const channel = supabase
              .channel(`auction-${id}`)
              .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'auctions',
                filter: `id=eq.${id}`,
              }, (payload) => {
                setAuction((prev) => ({ ...prev, ...payload.new }));
              })
              .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'bids',
                filter: `auction_id=eq.${id}`,
              }, async (payload) => {
                // Fetch full bid with profile
                const { data: newBid } = await supabase
                  .from('bids')
                  .select('*, bidder:profiles!bidder_id(display_name, college)')
                  .eq('id', payload.new.id)
                  .single();
                if (newBid) {
                  setBids((prev) => [newBid, ...prev]);
                }
              })
              .subscribe();

            return () => {
              supabase.removeChannel(channel);
            };
          }
        }
      }

      // Fallback: sample data
      const sample = SAMPLE_AUCTIONS.find((a) => a.id === id);
      if (sample) {
        setAuction(sample);
        // Generate sample bid history
        setBids(generateSampleBids(sample));
      }
      setLoading(false);
    }

    load();
  }, [id, isConfigured]);

  const conditionData = CONDITIONS.find((c) => c.id === auction?.condition);
  const categoryData = CATEGORIES.find((c) => c.id === auction?.category);

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

  async function handlePlaceBid(e) {
    e.preventDefault();
    setBidError('');
    setBidSuccess('');

    const amount = Number(bidAmount);
    if (!amount || amount < minBid) {
      setBidError(`Minimum bid is ${formatINR(minBid)}`);
      return;
    }

    if (!isAuthenticated) {
      setBidError('You must be signed in to place a bid.');
      return;
    }

    setBidLoading(true);

    try {
      const supabase = await getSupabase();
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
        setBidSuccess(`Bid of ${formatINR(amount)} placed successfully!${result.anti_snipe ? ' Anti-snipe: Auction extended.' : ''}`);
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
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-surface-900">Auction not found</h1>
        <p className="mt-2 text-surface-500">This auction may have been removed.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 text-brand-600 font-medium hover:text-brand-700">
          <ChevronLeft className="h-4 w-4" /> Back to home
        </Link>
      </div>
    );
  }

  const isOwner = user && auction.seller_id === user.id;
  const sellerName = auction.seller?.display_name || auction.seller?.name || 'Unknown';
  const sellerCollege = auction.seller?.college || '';

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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Images */}
        <div className="lg:col-span-3 space-y-3">
          {/* Main image */}
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-surface-100">
            <img
              src={auction.images?.[selectedImage] || auction.images?.[0]}
              alt={auction.title}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Thumbnail strip */}
          {auction.images?.length > 1 && (
            <div className="flex gap-2">
              {auction.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    'h-16 w-16 rounded-lg overflow-hidden border-2 transition-all',
                    i === selectedImage ? 'border-brand-500 ring-2 ring-brand-200' : 'border-transparent opacity-70 hover:opacity-100'
                  )}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="rounded-2xl border border-surface-200 bg-white p-5 mt-6">
            <h2 className="text-sm font-semibold text-surface-900 mb-3">Description</h2>
            <p className="text-sm text-surface-600 leading-relaxed whitespace-pre-wrap">
              {auction.description || 'No description provided.'}
            </p>
          </div>

          {/* Bid History */}
          <div className="rounded-2xl border border-surface-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-4 w-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-900">
                Bid History ({bids.length})
              </h2>
            </div>

            {bids.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-4">
                No bids yet. Be the first to bid!
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bids.map((bid, i) => (
                  <div
                    key={bid.id || i}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-2 text-sm',
                      i === 0 ? 'bg-brand-50' : 'bg-surface-50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
                        {getInitials(bid.bidder?.display_name || bid.bidder_name)}
                      </div>
                      <span className="text-surface-700 font-medium">
                        {bid.bidder?.display_name || bid.bidder_name}
                      </span>
                      {i === 0 && (
                        <Badge variant="brand" className="text-[10px]">Leading</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-surface-900">{formatINR(bid.amount)}</p>
                      <p className="text-[10px] text-surface-400">
                        {new Date(bid.created_at).toLocaleString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Info + Bidding */}
        <div className="lg:col-span-2 space-y-4">
          {/* Title & Meta */}
          <div className="rounded-2xl border border-surface-200 bg-white p-5">
            <div className="flex flex-wrap gap-2 mb-3">
              {categoryData && <Badge variant="info">{categoryData.label}</Badge>}
              {conditionData && <Badge className={conditionData.color}>{conditionData.label}</Badge>}
              <AuctionStatusBadge status={auction.status} />
            </div>

            <h1 className="text-xl font-bold text-surface-900 leading-snug">
              {auction.title}
            </h1>

            {/* Seller */}
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface-50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-sm">
                {getInitials(sellerName)}
              </div>
              <div>
                <p className="text-sm font-medium text-surface-900">{sellerName}</p>
                {sellerCollege && (
                  <p className="text-xs text-surface-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {sellerCollege}
                  </p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-1 text-xs text-emerald-600">
                <Shield className="h-3.5 w-3.5" />
                Verified
              </div>
            </div>
          </div>

          {/* Countdown */}
          <CountdownCard closingAt={auction.closing_at} status={auction.status} />

          {/* Current Bid / Price */}
          <div className="rounded-2xl border border-surface-200 bg-white p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs uppercase tracking-wider text-surface-400 font-medium">
                {auction.bid_count > 0 ? 'Current bid' : 'Starting price'}
              </p>
              <p className="text-xs text-surface-400">
                {auction.bid_count} bid{auction.bid_count !== 1 ? 's' : ''}
              </p>
            </div>
            <p className="text-3xl font-bold text-surface-900">
              {formatINR(auction.current_bid || auction.starting_price)}
            </p>
            {auction.bid_count > 0 && (
              <p className="mt-1 text-xs text-surface-400">
                Started at {formatINR(auction.starting_price)}
              </p>
            )}
          </div>

          {/* Place Bid */}
          {auction.status === 'active' && !isOwner && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-5">
              <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Gavel className="h-4 w-4 text-brand-600" />
                Place your bid
              </h3>

              {bidSuccess && (
                <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-700">{bidSuccess}</p>
                </div>
              )}

              {bidError && (
                <div className="mb-3 rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 animate-fade-in">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{bidError}</p>
                </div>
              )}

              <form onSubmit={handlePlaceBid}>
                <div className="relative mb-3">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                  <input
                    type="number"
                    min={minBid}
                    step={auction.min_increment}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="w-full rounded-xl border border-surface-200 bg-white py-3 pl-10 pr-4 text-lg font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <p className="text-xs text-surface-400 mb-3">
                  Minimum: {formatINR(minBid)} (increment: {formatINR(auction.min_increment)})
                </p>
                <button
                  type="submit"
                  disabled={bidLoading || !isAuthenticated}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bidLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                  {bidLoading ? 'Placing bid…' : `Bid ${bidAmount ? formatINR(Number(bidAmount)) : ''}`}
                </button>

                {!isAuthenticated && (
                  <p className="mt-2 text-xs text-center text-surface-400">
                    <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">Sign in</Link>{' '}
                    to place a bid
                  </p>
                )}
              </form>
            </div>
          )}

          {/* Owner actions */}
          {isOwner && auction.status === 'pending_approval' && (
            <SellerApprovalCard auction={auction} />
          )}

          {isOwner && auction.status === 'active' && (
            <div className="rounded-2xl border border-surface-200 bg-white p-5 text-center">
              <p className="text-sm text-surface-500">
                This is your listing. You cannot bid on your own items.
              </p>
            </div>
          )}

          {/* Auction rules */}
          <div className="rounded-2xl border border-surface-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-surface-900 mb-3">Auction Rules</h3>
            <ul className="space-y-2 text-xs text-surface-500">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                Bids placed in the final 30 seconds extend the auction by 60 seconds
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                All bids are final and binding
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                Seller approves the winning bid after auction ends
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                Campus handover confirmed by both parties
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────── */

function CountdownCard({ closingAt, status }) {
  const remaining = useCountdown(closingAt);

  if (status !== 'active') {
    return (
      <div className="rounded-2xl border border-surface-200 bg-surface-50 p-5 text-center">
        <p className="text-sm font-medium text-surface-500">Auction has ended</p>
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
        <Clock className={cn('h-4 w-4', remaining.urgency === 'critical' && 'animate-pulse-soft')} />
        <span className="text-xs font-medium uppercase tracking-wider">
          {remaining.urgency === 'critical' ? 'Ending soon!' : 'Time remaining'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { value: remaining.days || 0, label: 'Days' },
          { value: remaining.hours || 0, label: 'Hours' },
          { value: remaining.minutes || 0, label: 'Min' },
          { value: remaining.seconds || 0, label: 'Sec' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-white/60 py-2">
            <p className="text-2xl font-bold">{String(item.value).padStart(2, '0')}</p>
            <p className="text-[10px] uppercase tracking-wider opacity-60">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

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

function SellerApprovalCard({ auction }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleApproval(approved) {
    setLoading(true);
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.rpc('seller_approve', {
        p_auction_id: auction.id,
        p_seller_id: user.id,
        p_approved: approved,
      });
      if (error) throw error;
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <h3 className="text-sm font-semibold text-surface-900 mb-2">
        Approve Winning Bid?
      </h3>
      <p className="text-sm text-surface-600 mb-4">
        The highest bid is <strong>{formatINR(auction.current_bid)}</strong>.
        Approve to proceed with the campus handover, or reject to cancel.
      </p>
      {result ? (
        <p className="text-sm font-medium text-surface-700">
          {result.success
            ? `Decision: ${result.status}`
            : `Error: ${result.error}`
          }
        </p>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => handleApproval(true)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </button>
          <button
            onClick={() => handleApproval(false)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white border border-surface-200 py-2.5 text-sm font-semibold text-surface-700 hover:bg-surface-50 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────────── */

function generateSampleBids(auction) {
  if (auction.bid_count === 0) return [];

  const names = ['Arjun S.', 'Priya M.', 'Rahul K.', 'Sneha P.', 'Vikram T.', 'Kavya R.', 'Deepa N.'];
  const bids = [];
  let currentAmount = auction.starting_price;

  for (let i = 0; i < auction.bid_count; i++) {
    currentAmount += auction.min_increment * (1 + Math.floor(Math.random() * 3));
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
