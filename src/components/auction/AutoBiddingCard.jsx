import { useState, useEffect, useRef } from 'react';
import { Bot, IndianRupee, ShieldCheck, CheckCircle2, AlertCircle, Loader2, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { formatINR, cn } from '../../lib/utils';

export default function AutoBiddingCard({ auction, onUpdated }) {
  const { user, isAuthenticated } = useAuth();
  const [autoBid, setAutoBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [maxBudget, setMaxBudget] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPlacingAutoBid, setIsPlacingAutoBid] = useState(false);
  const isAutoBiddingRef = useRef(false);

  const nextMinBid = auction.bid_count === 0
    ? auction.starting_price
    : (auction.current_bid || auction.starting_price) + (auction.min_increment || 10);

  // Load user's private auto-bid for this auction
  async function loadUserAutoBid() {
    if (!user || !supabase || !auction?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('auto_bids')
        .select('*')
        .eq('auction_id', auction.id)
        .eq('bidder_id', user.id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      setAutoBid(data);
      if (data) {
        setMaxBudget(String(data.max_amount));
      } else {
        setMaxBudget(String(nextMinBid + (auction.min_increment || 10) * 2));
      }
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserAutoBid();

    if (!user || !supabase || !auction?.id) return;

    // Realtime channel for auto-bids updates
    const channelName = `autobid-${auction.id}-${user.id}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_bids',
          filter: `auction_id=eq.${auction.id}`,
        },
        () => loadUserAutoBid()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auction?.id, user?.id]);

  // Active Realtime Counter-Bid Worker:
  // Whenever the auction updates (e.g. competitor outbids or budget is updated),
  // automatically fire the counter-bid within 120ms to take back the lead!
  useEffect(() => {
    if (!isAuthenticated || !user || !auction?.id || auction.status !== 'active') return;
    if (auction.seller_id === user.id) return;
    if (!autoBid || !autoBid.is_active) return;

    // If user is already the leading bidder, nothing to do
    if (auction.current_bidder_id === user.id) return;

    // If budget cannot cover next minimum bid, ceiling is reached
    if (autoBid.max_amount < nextMinBid) return;

    // Prevent concurrent runs
    if (isAutoBiddingRef.current) return;

    const timer = setTimeout(async () => {
      if (isAutoBiddingRef.current) return;
      isAutoBiddingRef.current = true;
      setIsPlacingAutoBid(true);
      try {
        const bidToPlace = Math.min(autoBid.max_amount, nextMinBid);
        if (supabase) {
          const { error: bidErr } = await supabase.rpc('place_bid', {
            p_auction_id: auction.id,
            p_bidder_id: user.id,
            p_amount: bidToPlace,
          });
          if (!bidErr && onUpdated) {
            onUpdated();
          }
        }
      } catch (err) {
        console.warn('Auto counter-bid execution note:', err);
      } finally {
        setIsPlacingAutoBid(false);
        setTimeout(() => {
          isAutoBiddingRef.current = false;
        }, 300);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [
    auction?.id,
    auction?.current_bid,
    auction?.current_bidder_id,
    auction?.status,
    autoBid?.is_active,
    autoBid?.max_amount,
    nextMinBid,
    user?.id,
    isAuthenticated,
  ]);

  async function handleSetAutoBid(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const budget = Number(maxBudget);
    if (!budget || budget < nextMinBid) {
      setError(`Max budget must be at least ₹${nextMinBid}.`);
      return;
    }

    try {
      setSubmitting(true);
      if (supabase) {
        const { data, error: rpcErr } = await supabase.rpc('set_auto_bid', {
          p_auction_id: auction.id,
          p_max_amount: budget,
        });

        if (rpcErr) throw rpcErr;
        const result = typeof data === 'string' ? JSON.parse(data) : data;
        if (!result.success) {
          setError(result.error);
        } else {
          setSuccess(`Auto-bidding enabled up to ${formatINR(budget)}!`);
          setEditing(false);
          await loadUserAutoBid();
          // If not currently holding the lead, immediately place the bid to take the lead!
          if (auction.current_bidder_id !== user.id && budget >= nextMinBid && auction.seller_id !== user.id) {
            const bidToPlace = Math.min(budget, nextMinBid);
            try {
              setIsPlacingAutoBid(true);
              await supabase.rpc('place_bid', {
                p_auction_id: auction.id,
                p_bidder_id: user.id,
                p_amount: bidToPlace,
              });
            } catch (err) {
              console.warn('Initial auto-bid placement note:', err);
            } finally {
              setIsPlacingAutoBid(false);
            }
          }
          if (onUpdated) onUpdated();
        }
      } else {
        // Demo fallback
        setAutoBid({
          auction_id: auction.id,
          bidder_id: user.id,
          max_amount: budget,
          is_active: true,
        });
        setSuccess(`Demo auto-bid set to ${formatINR(budget)}.`);
        setEditing(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to save auto-bid.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelAutoBid() {
    setError('');
    setSuccess('');
    try {
      setSubmitting(true);
      if (supabase) {
        const { data, error: rpcErr } = await supabase.rpc('cancel_auto_bid', {
          p_auction_id: auction.id,
        });
        if (rpcErr) throw rpcErr;
        const result = typeof data === 'string' ? JSON.parse(data) : data;
        if (!result.success) {
          setError(result.error);
        } else {
          setSuccess('Automatic bidding has been turned off.');
          setAutoBid((prev) => (prev ? { ...prev, is_active: false } : null));
          setEditing(false);
          if (onUpdated) onUpdated();
        }
      } else {
        setAutoBid((prev) => (prev ? { ...prev, is_active: false } : null));
        setSuccess('Auto-bidding cancelled.');
        setEditing(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel auto-bid.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated || auction.status !== 'active') {
    return null;
  }

  const isConfigured = autoBid && autoBid.is_active;
  const isLeading = user && auction.current_bidder_id === user.id;
  const budgetExceeded = isConfigured && (auction.current_bid || 0) >= autoBid.max_amount && !isLeading;

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-xs transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
              <span>Automatic Bidding</span>
              {isConfigured && (
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                  Active
                </span>
              )}
            </h3>
            <p className="text-[11px] text-surface-500">
              Proxy bidding responds to competitors up to your max budget
            </p>
          </div>
        </div>

        {isConfigured && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            Edit Budget
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Active status display */}
      {isConfigured && !editing ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-surface-50 border border-surface-200 p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-surface-400">Your Private Max</span>
              <p className="text-base font-extrabold text-surface-900">
                {formatINR(autoBid.max_amount)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-surface-400">Status</span>
              <p className="text-xs font-bold">
                {isLeading ? (
                  <span className="text-emerald-600 flex items-center gap-1 justify-end">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Currently Leading
                  </span>
                ) : budgetExceeded ? (
                  <span className="text-rose-600 font-semibold">
                    Budget Limit Reached
                  </span>
                ) : (
                  <span className="text-purple-600 font-semibold flex items-center gap-1.5 justify-end">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Counter-bidding...
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancelAutoBid}
              disabled={submitting}
              className="flex-1 rounded-xl border border-rose-200 bg-rose-50/60 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Turn Off Auto-Bidding'}
            </button>
          </div>
        </div>
      ) : (
        /* Configuration Form */
        <form onSubmit={handleSetAutoBid} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">
              Maximum Budget ({formatINR(nextMinBid)} or higher)
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="number"
                min={nextMinBid}
                step={auction.min_increment || 10}
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder={`Min ${nextMinBid}`}
                required
                className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-4 text-sm font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-surface-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Bot className="h-3.5 w-3.5" />
                  {isConfigured ? 'Update Maximum' : 'Enable Auto-Bidding'}
                </>
              )}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl border border-surface-200 px-3 py-2.5 text-xs font-semibold text-surface-600 hover:bg-surface-50"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-surface-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>
              Your max is encrypted in the database and never shown to the seller or other bidders.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
