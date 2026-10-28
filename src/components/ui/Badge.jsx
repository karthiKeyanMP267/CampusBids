import { cn } from '../../lib/utils';

/**
 * Reusable badge component for conditions, statuses, etc.
 */
export default function Badge({ children, variant = 'default', className }) {
  const variants = {
    default: 'bg-surface-100 text-surface-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
    brand: 'bg-brand-50 text-brand-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        variants[variant] || variants.default,
        className
      )}
    >
      {children}
    </span>
  );
}
