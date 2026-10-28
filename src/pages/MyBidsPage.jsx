import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Gavel,
  Clock,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PackageOpen,
  ArrowRight,
  Handshake,
  Loader2,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { formatINR, cn } from '../lib/utils';
import Badge from '../components/ui/Badge';

const BID_TABS = [
  { id: 'all', label: 'All Bids' },
  { id: 'active', label: 'Active Auctions' },
  { id: 'leading', label: 'Leading' },
  { id: 'outbid', label: 'Outbid' },
  { id: 'awaiting_approval', label: 'Awaiting Approval' },
  { id: 'awaiting_handover', label: 'Awaiting Handover' },
  { id: 'completed', label: 'Won & Completed' },
  { id: 'unsuccessful', label: 'Unsuccessful' },
];

export default function MyBidsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [biddedAuctions, setBiddedAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  async function loadUserBidsAndAuctions() {
    if (!user || !supabase) return;
    try {
      setLoading(true);

      // Opportunistically close any expired active auctions
      try {
        await supabase.rpc('close_expired_auctions');
      } catch {
        // Non-blocking
      }

      // Step 1: Fetch all bids placed by the logged-in user
      const { data: userBids, error: bidsError } = await supabase
        .from('bids')
        .select('id, auction_id, amount, created_at')
        .eq('bidder_id', user.id)
        .order('amount', { ascending: false });

      if (bidsError) throw bidsError;

      if (!userBids || userBids.length === 0) {
        setBiddedAuctions([]);
        setLoading(false);
        return;
      }

      // Group user's highest bid per auction
      const userMaxBidMap = {};
      const distinctAuctionIds = [];
      userBids.forEach((b) => {
        if (!userMaxBidMap[b.auction_id]) {
          userMaxBidMap[b.auction_id] = b.amount;
          distinctAuctionIds.push(b.auction_id);
        } else if (b.amount > userMaxBidMap[b.auction_id]) {
          userMaxBidMap[b.auction_id] = b.amount;
        }
      });

      // Step 2: Fetch the authoritative auctions
      const { data: auctionsData, error: aucError } = await supabase
        .from('auctions')
        .select(`
          *,
          seller:profiles!seller_id(display_name, college, avatar_url),
          current_bidder:profiles!current_bidder_id(display_name, college),
          handover:handover_confirmations(seller_confirmed, buyer_confirmed, meeting_location, completed_at)
        `)
        .in('id', distinctAuctionIds)
        .order('closing_at', { ascending: false });

      if (aucError) throw aucError;

      // Merge user bid stats into auction objects
      const enriched = (auctionsData || []).map((auction) => {
        const userHighestBid = userMaxBidMap[auction.id] || 0;
        const isLeading =
          auction.status === 'active' && auction.current_bidder_id === user.id;
        const isOutbidOnActive =
          auction.status === 'active' && auction.current_bidder_id !== user.id;

        // Authoritative outcome logic
        const isWinner = auction.current_bidder_id === user.id;
        const isPendingApproval = isWinner && auction.status === 'pending_approval';
        const isApprovedWinner = isWinner && auction.status === 'approved';
        const isCompletedWinner = isWinner && auction.status === 'completed';
        const isRejected = auction.status === 'rejected';
        const isUnsuccessful =
          auction.status !== 'active' &&
          (!isWinner || isRejected || auction.status === 'unsold');

        return {
          ...auction,
          userHighestBid,
          isLeading,
          isOutbidOnActive,
          isWinner,
          isPendingApproval,
          isApprovedWinner,
          isCompletedWinner,
          isRejected,
          isUnsuccessful,
        };
      });

      setBiddedAuctions(enriched);
    } catch (err) {
      console.error('Error loading user bids dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadUserBidsAndAuctions();

    // Realtime subscription for auctions and bids
    const channel = supabase
      .channel(`user-bids-feed-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bids', filter: `bidder_id=eq.${user.id}` },
        () => loadUserBidsAndAuctions()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auctions' },
        () => loadUserBidsAndAuctions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Tab filtering
  const filteredAuctions = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return biddedAuctions.filter((a) => a.status === 'active');
      case 'leading':
        return biddedAuctions.filter((a) => a.isLeading);
      case 'outbid':
        return biddedAuctions.filter((a) => a.isOutbidOnActive);
      case 'awaiting_approval':
        return biddedAuctions.filter((a) => a.isPendingApproval);
      case 'awaiting_handover':
        return biddedAuctions.filter((a) => a.isApprovedWinner);
      case 'completed':
        return biddedAuctions.filter((a) => a.isCompletedWinner);
      case 'unsuccessful':
        return biddedAuctions.filter((a) => a.isUnsuccessful);
      case 'all':
      default:
        return biddedAuctions;
    }
  }, [biddedAuctions, activeTab]);

  // Summary counts
  const counts = useMemo(() => {
    return {
      all: biddedAuctions.length,
      active: biddedAuctions.filter((a) => a.status === 'active').length,
      leading: biddedAuctions.filter((a) => a.isLeading).length,
      outbid: biddedAuctions.filter((a) => a.isOutbidOnActive).length,
      awaiting_approval: biddedAuctions.filter((a) => a.isPendingApproval).length,
      awaiting_handover: biddedAuctions.filter((a) => a.isApprovedWinner).length,
      completed: biddedAuctions.filter((a) => a.isCompletedWinner).length,
      unsuccessful: biddedAuctions.filter((a) => a.isUnsuccessful).length,
    };
  }, [biddedAuctions]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 mb-4 shadow-xs">
          <Gavel className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-surface-900">Sign in to view your bids</h1>
        <p className="mt-2 text-sm text-surface-500 max-w-md mx-auto">
          Track the status of all your active bids, winning auctions, and campus handovers.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 tracking-tight">
            My Bids — Bidder Dashboard
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Track your bids, outbid alerts, winning results, and campus pickup progress.
          </p>
        </div>
        <Link
          to="/browse"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition-colors"
        >
          <Gavel className="h-4 w-4" />
          Browse More Auctions
        </Link>
      </div>

      {/* Top Highlight Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Total Auctions Bidded
          </div>
          <div className="mt-2 text-2xl font-extrabold text-surface-900">{counts.all}</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Currently Leading
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">{counts.leading}</div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Approved / Handover
            </span>
            <Trophy className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-700">{counts.awaiting_handover}</div>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Won & Completed
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600">{counts.completed}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-surface-200">
        {BID_TABS.map((tab) => {
          const count = counts[tab.id] || 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-2',
                activeTab === tab.id
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-surface-600 hover:bg-surface-100'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-surface-200 text-surface-700'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bids List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-2xl border border-surface-200 bg-white p-5 animate-pulse"
            />
          ))}
        </div>
      ) : filteredAuctions.length > 0 ? (
        <div className="space-y-4">
          {filteredAuctions.map((auction) => {
            const coverImage =
              auction.images && auction.images[0]
                ? auction.images[0]
                : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80';

            const sellerName = auction.seller?.display_name || 'Campus Student';
            const sellerCollege = auction.seller?.college || 'Campus';

            return (
              <div
                key={auction.id}
                className={cn(
                  'rounded-2xl border bg-white p-5 transition-all shadow-xs hover:shadow-sm',
                  auction.isApprovedWinner
                    ? 'border-blue-300 ring-1 ring-blue-200 bg-blue-50/20'
                    : auction.isLeading
                    ? 'border-emerald-300 ring-1 ring-emerald-100 bg-emerald-50/20'
                    : auction.isOutbidOnActive
                    ? 'border-red-200 bg-red-50/10'
                    : 'border-surface-200'
                )}
              >
                <div className="flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                  {/* Left: Thumbnail & Title */}
                  <div className="flex gap-4 items-center flex-1 min-w-0">
                    <img
                      src={coverImage}
                      alt={auction.title}
                      className="h-20 w-24 rounded-xl object-cover border border-surface-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <BidOutcomeBadge auction={auction} />
                        <span className="text-xs text-surface-400 capitalize">
                          {auction.category}
                        </span>
                      </div>
                      <Link
                        to={`/auction/${auction.id}`}
                        className="text-base font-bold text-surface-900 hover:text-brand-600 transition-colors line-clamp-1"
                      >
                        {auction.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-surface-500 mt-1">
                        <span>
                          Seller: <strong>{sellerName}</strong> ({sellerCollege})
                        </span>
                        <span>•</span>
                        <span>
                          Closes:{' '}
                          {new Date(auction.closing_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Bid Comparison */}
                  <div className="border-t md:border-t-0 md:border-l border-surface-100 pt-3 md:pt-0 md:pl-5 w-full md:w-60 shrink-0 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-surface-500">Your Highest Bid:</span>
                      <strong className="text-sm text-surface-900">
                        {formatINR(auction.userHighestBid)}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-surface-500">
                        {auction.status === 'active' ? 'Current Leading Bid:' : 'Winning Bid:'}
                      </span>
                      <span
                        className={cn(
                          'text-sm font-extrabold',
                          auction.isLeading || auction.isWinner
                            ? 'text-emerald-600'
                            : 'text-surface-900'
                        )}
                      >
                        {formatINR(auction.current_bid || auction.starting_price)}
                      </span>
                    </div>

                    {/* Result guidance message */}
                    <div className="pt-1">
                      {auction.isCompletedWinner ? (
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Purchase completed.
                        </span>
                      ) : auction.isApprovedWinner ? (
                        <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
                          <Trophy className="h-3.5 w-3.5" />
                          Congratulations! You won this auction.
                        </span>
                      ) : auction.isPendingApproval ? (
                        <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Your winning bid is awaiting seller approval.
                        </span>
                      ) : auction.isLeading ? (
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          You are currently the highest bidder!
                        </span>
                      ) : auction.isOutbidOnActive ? (
                        <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          You were outbid! Place a higher bid to win.
                        </span>
                      ) : auction.isRejected ? (
                        <span className="text-[11px] font-medium text-red-600 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" />
                          Winning bid was rejected by seller.
                        </span>
                      ) : (
                        <span className="text-[11px] text-surface-400">
                          Auction ended. You did not win.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-surface-100">
                    {/* Outbid on active -> button to place higher bid */}
                    {auction.isOutbidOnActive && (
                      <Link
                        to={`/auction/${auction.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700 shadow-xs transition-colors"
                      >
                        Place Higher Bid
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}

                    {/* Approved winner -> button to proceed to handover */}
                    {auction.isApprovedWinner && (
                      <Link
                        to={`/auction/${auction.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-colors"
                      >
                        <Handshake className="h-3.5 w-3.5" />
                        Proceed to Handover
                      </Link>
                    )}

                    {/* Default link to auction */}
                    <Link
                      to={`/auction/${auction.id}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-surface-200 bg-white px-3.5 py-2 text-xs font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                    >
                      View Auction
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 mb-4 shadow-xs">
            <PackageOpen className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-surface-900">
            {activeTab === 'all'
              ? "You haven't placed any bids yet"
              : `No bids found in "${BID_TABS.find((t) => t.id === activeTab)?.label}"`}
          </h3>
          <p className="mt-1 text-sm text-surface-500 max-w-sm mx-auto">
            Browse through active campus auctions to find textbooks, electronics, and gear at fair prices.
          </p>
          <div className="mt-6">
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition-colors"
            >
              <Gavel className="h-4 w-4" />
              Explore Auctions
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function BidOutcomeBadge({ auction }) {
  if (auction.isCompletedWinner) {
    return <Badge variant="success">Purchased ✓</Badge>;
  }
  if (auction.isApprovedWinner) {
    return <Badge variant="info">Won • Handover</Badge>;
  }
  if (auction.isPendingApproval) {
    return <Badge variant="warning">Awaiting Approval</Badge>;
  }
  if (auction.isLeading) {
    return <Badge variant="success">Leading Bid</Badge>;
  }
  if (auction.isOutbidOnActive) {
    return <Badge variant="danger">Outbid</Badge>;
  }
  if (auction.isRejected) {
    return <Badge variant="danger">Rejected</Badge>;
  }
  if (auction.status === 'unsold') {
    return <Badge variant="default">Unsold</Badge>;
  }
  return <Badge variant="default">Auction Ended</Badge>;
}
