import {
  BookOpen,
  Laptop,
  Armchair,
  Shirt,
  Dumbbell,
  Guitar,
  Pen,
  Package,
} from 'lucide-react';
import { CATEGORIES } from '../../lib/constants';
import { cn } from '../../lib/utils';

const ICON_MAP = {
  BookOpen,
  Laptop,
  Armchair,
  Shirt,
  Dumbbell,
  Guitar,
  Pen,
  Package,
};

export default function CategoryBar({ selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all',
          !selected
            ? 'bg-brand-600 text-white shadow-sm'
            : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
        )}
      >
        All
      </button>
      {CATEGORIES.map((cat) => {
        const Icon = ICON_MAP[cat.icon];
        const isActive = selected === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(isActive ? null : cat.id)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all',
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
