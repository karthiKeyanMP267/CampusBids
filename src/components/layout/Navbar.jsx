import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  User,
  LogIn,
  Menu,
  X,
  Gavel,
  Bell,
} from 'lucide-react';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-surface-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Gavel className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-surface-900 tracking-tight">
              Campus<span className="text-brand-600">Bid</span>
            </span>
          </Link>

          {/* Search — desktop */}
          <div className="hidden sm:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search auctions…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-100 placeholder:text-surface-400"
              />
            </div>
          </div>

          {/* Actions — desktop */}
          <nav className="hidden sm:flex items-center gap-2">
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Sell Item
            </Link>
            <button
              className="relative rounded-xl p-2 text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger" />
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-700 transition-all hover:bg-surface-50 hover:border-surface-300"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="sm:hidden rounded-lg p-2 text-surface-600 hover:bg-surface-100"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-surface-200 bg-white animate-fade-in">
          <div className="px-4 py-3 space-y-3">
            {/* Search — mobile */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search auctions…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <Link
              to="/create"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Sell Item
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-700"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
