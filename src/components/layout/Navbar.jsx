import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  User,
  LogIn,
  LogOut,
  Menu,
  X,
  Gavel,
  Bell,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getInitials } from '../../lib/utils';

export default function Navbar() {
  const { user, profile, isAuthenticated, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  function handleSearchSubmit(e) {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  const displayName =
    profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Student';
  const college = profile?.college || 'Campus';

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-surface-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-xs">
              <Gavel className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-surface-900 tracking-tight">
              Campus<span className="text-brand-600">Bid</span>
            </span>
          </Link>

          {/* Search — desktop */}
          <div className="hidden sm:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search auctions… (Press Enter)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchSubmit}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-100 placeholder:text-surface-400"
              />
            </div>
          </div>

          {/* Actions — desktop */}
          <nav className="hidden sm:flex items-center gap-2.5">
            <Link
              to="/browse"
              className="px-3 py-2 text-sm font-medium text-surface-600 hover:text-brand-600 transition-colors"
            >
              Browse
            </Link>

            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-all hover:bg-brand-700 hover:shadow-sm active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Sell Item
            </Link>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white py-1.5 pl-2 pr-3 text-sm font-medium text-surface-700 shadow-xs hover:bg-surface-50 transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 font-bold text-xs">
                    {getInitials(displayName)}
                  </div>
                  <span className="max-w-[100px] truncate">{displayName}</span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-surface-200 bg-white p-2 shadow-lg animate-fade-in z-50">
                    <div className="px-3 py-2 border-b border-surface-100">
                      <p className="text-sm font-semibold text-surface-900 truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-surface-400 truncate">{user.email}</p>
                      <p className="text-[11px] text-brand-600 font-medium mt-0.5">{college}</p>
                    </div>

                    <div className="pt-1">
                      <Link
                        to="/create"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-surface-700 hover:bg-surface-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create Listing
                      </Link>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 text-left transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-surface-200 px-3.5 py-2 text-sm font-medium text-surface-700 transition-all hover:bg-surface-50"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-surface-900 px-3.5 py-2 text-sm font-medium text-white transition-all hover:bg-surface-800"
                >
                  Register
                </Link>
              </div>
            )}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setMobileOpen(false);
                    handleSearchSubmit(e);
                  }
                }}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <Link
              to="/browse"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-700"
            >
              Browse All Auctions
            </Link>

            <Link
              to="/create"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Sell Item
            </Link>

            {isAuthenticated ? (
              <div className="pt-2 border-t border-surface-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-surface-900">{displayName}</p>
                  <p className="text-xs text-surface-400">{college}</p>
                </div>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut();
                  }}
                  className="flex items-center gap-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 p-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-100">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-surface-200 py-2.5 text-sm font-medium text-surface-700"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-900 py-2.5 text-sm font-medium text-white"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
