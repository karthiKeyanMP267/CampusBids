import { Link } from 'react-router-dom';
import { Clock, Users, TrendingUp, Gavel } from 'lucide-react';
import { useCountdown } from '../../hooks/useCountdown';
import { formatINR, getInitials, cn } from '../../lib/utils';
import { CONDITIONS } from '../../lib/constants';
import Badge from '../ui/Badge';
import DealScoreBadge from './DealScoreBadge';

export default function AuctionCard({ auction, className }) {
  const remaining = useCountdown(auction.closing_at);

  const conditionData = CONDITIONS.find((c) => c.id === auction.condition);

  const urgencyStyles = {
    critical: 'text-red-600 bg-red-50',
    warning: 'text-amber-600 bg-amber-50',
    normal: 'text-surface-600 bg-surface-100',
    ended: 'text-surface-400 bg-surface-100',
  };

  return (
    <Link
      to={`/auction/${auction.id}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-surface-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-surface-300 hover:-translate-y-1',
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-100">
        <img
          src={auction.images?.[0]}
          alt={auction.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Timer badge */}
        <div className="absolute top-3 right-3">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold backdrop-blur-sm',
              urgencyStyles[remaining.urgency]
            )}
          >
            <Clock className="h-3 w-3" />
            {remaining.text}
          </span>
        </div>

        {/* Condition badge */}
        {conditionData && (
          <div className="absolute top-3 left-3">
            <Badge className={conditionData.color}>{conditionData.label}</Badge>
          </div>
        )}

        {/* Bid count overlay */}
        {auction.bid_count > 0 && (
          <div className="absolute bottom-3 left-3">
            <span className="inline-flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <TrendingUp className="h-3 w-3" />
              {auction.bid_count} bid{auction.bid_count !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Deal Score & Category */}
        <div className="mb-2 flex items-center justify-between">
          <DealScoreBadge auction={auction} compact />
          <span className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">
            {auction.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-surface-900 leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors">
          {auction.title}
        </h3>

        {/* Seller */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
            {getInitials(auction.seller?.name)}
          </div>
          <span className="text-xs text-surface-500 truncate">
            {auction.seller?.name}
            {auction.seller?.college && (
              <span className="text-surface-400"> · {auction.seller.college}</span>
            )}
          </span>
        </div>

        {/* Price section */}
        <div className="mt-auto pt-3 border-t border-surface-100 mt-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-surface-400 font-medium">
                {auction.bid_count > 0 ? 'Current bid' : 'Starting at'}
              </p>
              <p className="text-lg font-bold text-surface-900">
                {formatINR(auction.current_bid || auction.starting_price)}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              <Gavel className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Bid</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
