import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Gavel,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  ArrowRight,
  User,
  Loader2,
  Handshake,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { formatINR, cn } from '../lib/utils';
import Badge from '../components/ui/Badge';

const STATUS_FILTERS = [
  { id: 'all', label: 'All Listings' },
  { id: 'active', label: 'Active' },
  { id: 'pending_approval', label: 'Awaiting Approval' },
  { id: 'approved', label: 'Approved & Handover' },
  { id: 'completed', label: 'Completed' },
  { id: 'unsold', label: 'Unsold' },
  { id: 'rejected', label: 'Rejected' },
];

export default function MyListingsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);

  async function loadSellerListings() {
    if (!user || !supabase) return;
    try {
      setLoading(true);
      // Opportunistically close any expired active auctions
      try {
        await supabase.rpc('close_expired_auctions');
      } catch {
        // Non-blocking
      }

      // Fetch all listings created by this seller with bidder profile and handover confirmation
      const { data, error } = await supabase
        .from('auctions')
        .select(`
          *,
          current_bidder:profiles!current_bidder_id(display_name, college),
          handover:handover_confirmations(seller_confirmed, buyer_confirmed, meeting_location, completed_at)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (err) {
      console.error('Error fetching seller listings:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadSellerListings();

    // Realtime subscription for updates to user's listings
    const channelName = `seller-listings-${user.id}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auctions',
          filter: `seller_id=eq.${user.id}`,
        },
        () => {
          loadSellerListings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Handle seller approving or rejecting winning bid
  async function handleApproval(auctionId, approved) {
    setActionLoading(auctionId);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc('seller_approve', {
        p_auction_id: auctionId,
        p_seller_id: user.id,
        p_approved: approved,
      });

      if (error) throw error;
      const res = typeof data === 'string' ? JSON.parse(data) : data;

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to update approval.' });
      } else {
        setFeedback({
          type: 'success',
          message: approved
            ? 'Winning bid approved! Handover stage is now open.'
            : 'Winning bid rejected.',
        });
        await loadSellerListings();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Action failed.' });
    } finally {
      setActionLoading(null);
    }
  }

  // Handle seller cancelling an active listing with 0 bids
  async function handleCancel(auctionId) {
    if (!confirm('Are you sure you want to cancel this listing?')) return;
    setActionLoading(auctionId);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc('cancel_auction', {
        p_auction_id: auctionId,
      });

      if (error) throw error;
      const res = typeof data === 'string' ? JSON.parse(data) : data;

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to cancel auction.' });
      } else {
        setFeedback({ type: 'success', message: 'Auction cancelled successfully.' });
        await loadSellerListings();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Cancel failed.' });
    } finally {
      setActionLoading(null);
    }
  }

  // Metrics summary
  const stats = useMemo(() => {
    const total = listings.length;
    const active = listings.filter((l) => l.status === 'active').length;
    const pending = listings.filter((l) => l.status === 'pending_approval').length;
    const completed = listings.filter((l) => l.status === 'completed').length;
    const totalEarnings = listings
      .filter((l) => l.status === 'completed' && l.current_bid)
      .reduce((acc, curr) => acc + curr.current_bid, 0);

    return { total, active, pending, completed, totalEarnings };
  }, [listings]);

  // Filtered listings by selected status
  const filteredListings = useMemo(() => {
    if (selectedStatus === 'all') return listings;
    return listings.filter((l) => l.status === selectedStatus);
  }, [listings, selectedStatus]);

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
        <h1 className="text-2xl font-bold text-surface-900">Sign in to view your listings</h1>
        <p className="mt-2 text-sm text-surface-500 max-w-md mx-auto">
          Manage your items, review winning student bids, and oversee safe campus handovers.
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
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 tracking-tight">
            My Listings — Seller Dashboard
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Track and manage all campus auctions you have created.
          </p>
        </div>
        <Link
          to="/create"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" />
          Create New Listing
        </Link>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Total Listings
          </div>
          <div className="mt-2 text-2xl font-extrabold text-surface-900">{stats.total}</div>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Active Auctions
          </div>
          <div className="mt-2 text-2xl font-extrabold text-brand-600">{stats.active}</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Awaiting Approval
            </span>
            {stats.pending > 0 && (
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-900">{stats.pending}</div>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Completed Sales
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600">
            {formatINR(stats.totalEarnings)}
          </div>
        </div>
      </div>

      {/* Global Action Feedback Alert */}
      {feedback && (
        <div
          className={cn(
            'mb-6 rounded-2xl border p-4 text-sm flex items-start gap-3 animate-fade-in',
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          )}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Status Filter Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-surface-200">
        {STATUS_FILTERS.map((tab) => {
          const count =
            tab.id === 'all'
              ? listings.length
              : listings.filter((l) => l.status === tab.id).length;

          return (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={cn(
                'whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-2',
                selectedStatus === tab.id
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-surface-600 hover:bg-surface-100'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  selectedStatus === tab.id
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

      {/* Listings Grid */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-2xl border border-surface-200 bg-white p-5 animate-pulse"
            />
          ))}
        </div>
      ) : filteredListings.length > 0 ? (
        <div className="space-y-4">
          {filteredListings.map((auction) => {
            const hasBids = (auction.bid_count || 0) > 0;
            const winningBidderName =
              auction.current_bidder?.display_name || 'Anonymous Bidder';
            const winningBidderCollege = auction.current_bidder?.college || 'Campus';
            const isPendingApproval = auction.status === 'pending_approval';
            const isApproved = auction.status === 'approved';
            const isCompleted = auction.status === 'completed';
            const isActionLoading = actionLoading === auction.id;

            const coverImage =
              auction.images && auction.images[0]
                ? auction.images[0]
                : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80';

            return (
              <div
                key={auction.id}
                className={cn(
                  'rounded-2xl border bg-white p-5 transition-all shadow-xs hover:shadow-sm',
                  isPendingApproval
                    ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20'
                    : 'border-surface-200'
                )}
              >
                <div className="flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                  {/* Left: Thumbnail & Main Info */}
                  <div className="flex gap-4 items-center flex-1 min-w-0">
                    <img
                      src={coverImage}
                      alt={auction.title}
                      className="h-20 w-24 rounded-xl object-cover border border-surface-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <ListingStatusBadge status={auction.status} />
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
                        <span>Starting: {formatINR(auction.starting_price)}</span>
                        <span>•</span>
                        <span>
                          Current Bid:{' '}
                          <strong className="text-surface-900">
                            {formatINR(auction.current_bid || auction.starting_price)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>{auction.bid_count} bids</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Winner/Bidder Outcome */}
                  <div className="border-t md:border-t-0 md:border-l border-surface-100 pt-3 md:pt-0 md:pl-5 w-full md:w-64 shrink-0 text-xs text-surface-600">
                    {hasBids ? (
                      <div>
                        <span className="font-semibold text-surface-800 block mb-0.5">
                          {isCompleted
                            ? 'Sold to Winner:'
                            : isApproved
                            ? 'Approved Winner:'
                            : isPendingApproval
                            ? 'Winning Bidder:'
                            : 'Highest Bidder:'}
                        </span>
                        <div className="flex items-center gap-1.5 font-medium text-surface-900">
                          <User className="h-3.5 w-3.5 text-brand-600" />
                          <span>{winningBidderName}</span>
                        </div>
                        <span className="text-[11px] text-surface-400">
                          {winningBidderCollege} • {formatINR(auction.current_bid)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-surface-400 italic">No bids placed</span>
                    )}

                    {/* Handover Status */}
                    {auction.handover && (isApproved || isCompleted) && (
                      <div className="mt-2 text-[11px]">
                        <span className="font-semibold text-surface-700">Handover: </span>
                        <span
                          className={cn(
                            'font-medium',
                            isCompleted ? 'text-emerald-700' : 'text-blue-700'
                          )}
                        >
                          {isCompleted
                            ? 'Completed ✓'
                            : auction.handover.seller_confirmed
                            ? 'Awaiting Buyer Confirmation'
                            : 'Awaiting Your Confirmation'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions / Decision Controls */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-surface-100">
                    {/* Approve/Reject Buttons if Pending Approval */}
                    {isPendingApproval && (
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleApproval(auction.id, true)}
                          disabled={isActionLoading}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Approve Bid
                        </button>
                        <button
                          onClick={() => handleApproval(auction.id, false)}
                          disabled={isActionLoading}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50 disabled:opacity-50 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Manage Handover if Approved */}
                    {isApproved && (
                      <Link
                        to={`/auction/${auction.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <Handshake className="h-3.5 w-3.5 text-blue-600" />
                        Manage Handover
                      </Link>
                    )}

                    {/* Cancel button if active with 0 bids */}
                    {auction.status === 'active' && !hasBids && (
                      <button
                        onClick={() => handleCancel(auction.id)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1 text-xs text-surface-400 hover:text-red-600 p-2 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    )}

                    {/* View Details Link */}
                    <Link
                      to={`/auction/${auction.id}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-surface-200 bg-white px-3.5 py-2 text-xs font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                    >
                      View Page
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
            <Package className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-surface-900">
            {selectedStatus === 'all'
              ? "You haven't created any listings yet"
              : `No listings in "${STATUS_FILTERS.find((f) => f.id === selectedStatus)?.label}"`}
          </h3>
          <p className="mt-1 text-sm text-surface-500 max-w-sm mx-auto">
            {selectedStatus === 'all'
              ? 'List textbooks, electronics, or dorm gear for transparent campus auctions.'
              : 'Try selecting a different status filter or create a new auction.'}
          </p>
          <div className="mt-6">
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Auction Listing
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ListingStatusBadge({ status }) {
  const map = {
    active: { variant: 'success', label: 'Active' },
    pending_approval: { variant: 'warning', label: 'Awaiting Approval' },
    approved: { variant: 'info', label: 'Approved' },
    completed: { variant: 'success', label: 'Completed' },
    unsold: { variant: 'default', label: 'Unsold' },
    rejected: { variant: 'danger', label: 'Rejected' },
    cancelled: { variant: 'danger', label: 'Cancelled' },
  };

  const current = map[status] || { variant: 'default', label: status };
  return <Badge variant={current.variant}>{current.label}</Badge>;
}
