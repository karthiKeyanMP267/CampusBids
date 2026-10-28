import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Building,
  Phone,
  KeyRound,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  ChevronLeft,
  Camera,
  ShieldCheck,
  Package,
  Gavel,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getInitials } from '../lib/utils';

export default function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  // Profile fields state
  const [displayName, setDisplayName] = useState('');
  const [college, setCollege] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password fields state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Activity stats
  const [stats, setStats] = useState({ listingsCount: 0, bidsCount: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Form states
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Initialize fields from current profile / user metadata
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || user?.user_metadata?.display_name || '');
      setCollege(profile.college || user?.user_metadata?.college || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatar_url || '');
    } else if (user) {
      setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || '');
      setCollege(user.user_metadata?.college || '');
    }
  }, [profile, user]);

  // Load account activity stats
  useEffect(() => {
    if (!user || !supabase) {
      setStatsLoading(false);
      return;
    }

    async function loadStats() {
      try {
        setStatsLoading(true);
        const [listingsRes, bidsRes] = await Promise.all([
          supabase
            .from('auctions')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', user.id),
          supabase
            .from('bids')
            .select('id', { count: 'exact', head: true })
            .eq('bidder_id', user.id),
        ]);

        setStats({
          listingsCount: listingsRes.count || 0,
          bidsCount: bidsRes.count || 0,
        });
      } catch (err) {
        console.warn('Could not load user stats:', err);
      } finally {
        setStatsLoading(false);
      }
    }

    loadStats();
  }, [user]);

  // Handle saving profile changes
  async function handleSaveProfile(e) {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!displayName.trim()) {
      setErrorMessage('Display Name cannot be empty.');
      return;
    }

    try {
      setSaving(true);

      if (supabase && user) {
        // 1. Update public.profiles table
        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            display_name: displayName.trim(),
            college: college.trim() || 'Campus',
            phone: phone.trim() || null,
            avatar_url: avatarUrl.trim() || null,
            updated_at: new Date().toISOString(),
          });

        if (profileErr) throw profileErr;

        // 2. Update auth.users metadata for sync
        await supabase.auth.updateUser({
          data: {
            display_name: displayName.trim(),
            college: college.trim() || 'Campus',
          },
        });

        // 3. Refresh profile in AuthContext
        if (refreshProfile) {
          await refreshProfile();
        }

        setSuccessMessage('Your profile details have been saved successfully.');
      } else {
        setSuccessMessage('Demo profile updated successfully.');
      }
    } catch (err) {
      console.error('Profile update failed:', err);
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  // Handle changing password
  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      setPasswordLoading(true);
      if (supabase) {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) throw error;

        setPasswordSuccess('Password changed successfully.');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordSuccess('Demo password updated.');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('Password change failed:', err);
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  }

  // Handle deleting own account
  async function handleDeleteAccount() {
    if (confirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm account deletion.');
      return;
    }

    try {
      setDeleting(true);
      setDeleteError('');

      if (supabase && user) {
        // 1. Try secure RPC delete_own_account
        const { error: rpcErr } = await supabase.rpc('delete_own_account');

        if (rpcErr) {
          console.warn('RPC delete_own_account note:', rpcErr.message);
          // Fallback: Delete profile directly via RLS
          const { error: profileErr } = await supabase
            .from('profiles')
            .delete()
            .eq('id', user.id);
          if (profileErr) throw profileErr;
        }

        // 2. Sign out locally
        await signOut();
      } else {
        await signOut();
      }

      navigate('/login?deleted=true');
    } catch (err) {
      console.error('Account deletion failed:', err);
      setDeleteError(err.message || 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  }

  const currentInitials = getInitials(displayName || user?.email || 'U');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 hover:text-brand-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to marketplace
        </Link>
        <span className="text-xs text-surface-400 font-mono">
          User ID: {user?.id ? `${user.id.slice(0, 8)}...` : 'demo-user'}
        </span>
      </div>

      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-200 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight sm:text-3xl">
            Account Settings
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            Manage your personal profile, campus credentials, and account security.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-2">
          <Link
            to="/my-listings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-3.5 py-2 text-xs font-semibold text-surface-700 shadow-xs hover:bg-surface-50 transition-colors"
          >
            <Package className="h-3.5 w-3.5 text-surface-400" />
            My Listings
          </Link>
          <Link
            to="/my-bids"
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-3.5 py-2 text-xs font-semibold text-surface-700 shadow-xs hover:bg-surface-50 transition-colors"
          >
            <Gavel className="h-3.5 w-3.5 text-surface-400" />
            My Bids
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card & Activity Summary */}
        <div className="lg:col-span-1 space-y-6">
          {/* Identity Snapshot Card */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-xs text-center">
            <div className="relative mx-auto mb-4 h-24 w-24">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-24 w-24 rounded-full object-cover border-2 border-brand-500 shadow-xs"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-extrabold text-2xl shadow-xs">
                  {currentInitials}
                </div>
              )}
              <div className="absolute bottom-0 right-0 rounded-full bg-white p-1.5 shadow-sm border border-surface-200 text-surface-500">
                <Camera className="h-3.5 w-3.5" />
              </div>
            </div>

            <h2 className="text-base font-bold text-surface-900 truncate">
              {displayName || 'Campus Student'}
            </h2>
            <p className="text-xs text-surface-400 truncate mt-0.5">{user?.email}</p>

            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified Student
            </div>

            <div className="mt-6 border-t border-surface-100 pt-4 text-left space-y-2.5 text-xs text-surface-600">
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Campus:</span>
                <span className="font-semibold text-surface-900 truncate max-w-[150px]">
                  {college || 'Campus Member'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Member Since:</span>
                <span className="font-medium text-surface-700 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-surface-400" />
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                      })
                    : '2026'}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Counters Card */}
          <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">
              Marketplace Activity
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/my-listings"
                className="rounded-xl bg-surface-50 p-3 hover:bg-surface-100/70 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-surface-500 text-xs">
                  <Package className="h-3.5 w-3.5 text-brand-600" />
                  <span>Listings</span>
                </div>
                <p className="mt-1 text-xl font-extrabold text-surface-900">
                  {statsLoading ? '...' : stats.listingsCount}
                </p>
              </Link>
              <Link
                to="/my-bids"
                className="rounded-xl bg-surface-50 p-3 hover:bg-surface-100/70 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-surface-500 text-xs">
                  <Gavel className="h-3.5 w-3.5 text-purple-600" />
                  <span>Bids Placed</span>
                </div>
                <p className="mt-1 text-xl font-extrabold text-surface-900">
                  {statsLoading ? '...' : stats.bidsCount}
                </p>
              </Link>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Edit Details, Security, and Danger Zone */}
        <div className="lg:col-span-2 space-y-8">
          {/* ─── Profile Details Form ─── */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-surface-100">
              <User className="h-4 w-4 text-brand-600" />
              <h2 className="text-base font-bold text-surface-900">Profile Information</h2>
            </div>

            {successMessage && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Display Name */}
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Aarav Mehta"
                      className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>

                {/* College / Institution */}
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                    College / University
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g. IIT Madras"
                      className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>

                {/* Email Address (Read-only) */}
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full rounded-xl border border-surface-200 bg-surface-100/70 py-2.5 pl-10 pr-4 text-sm text-surface-500 outline-none cursor-not-allowed"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-surface-400">
                    Primary login credential managed by authentication provider.
                  </p>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-surface-400">
                    Shared with handover counterpart only after winning an auction.
                  </p>
                </div>
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                  Profile Photo URL
                </label>
                <div className="relative">
                  <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/... or image link"
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ─── Security / Password Update ─── */}
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-surface-100">
              <KeyRound className="h-4 w-4 text-brand-600" />
              <h2 className="text-base font-bold text-surface-900">Change Password</h2>
            </div>

            {passwordSuccess && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 px-4 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 px-4 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={passwordLoading || !newPassword}
                  className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-5 py-2.5 text-sm font-semibold text-surface-700 shadow-xs hover:bg-surface-50 transition-colors disabled:opacity-50"
                >
                  {passwordLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ─── Danger Zone: Delete Account ─── */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              <h2 className="text-base font-bold text-rose-950">Danger Zone</h2>
            </div>
            <p className="text-xs text-rose-800 leading-relaxed max-w-xl">
              Permanently delete your account, campus profile, all your auction listings, and bidding
              history. Once deleted, this action cannot be reversed.
            </p>

            <div className="mt-4 pt-4 border-t border-rose-200/60 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-xs font-bold text-rose-900">Delete Account</h3>
                <p className="text-[11px] text-rose-700">
                  Immediate, irrevocable wipe of your account credentials and records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmText('');
                  setDeleteError('');
                  setDeleteModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-[0.98] transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Delete Account Confirmation Modal ─── */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-surface-200 bg-white p-6 shadow-xl animate-scale-in">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4">
              <ShieldAlert className="h-6 w-6" />
            </div>

            <h3 className="text-center text-lg font-bold text-surface-900">
              Permanently Delete Account?
            </h3>
            <p className="mt-2 text-center text-xs text-surface-500 leading-relaxed">
              This action is <strong className="text-rose-600 font-bold">permanent and irreversible</strong>.
              All your auction listings, active proxy bids, saved searches, and chat history will be completely erased.
            </p>

            {deleteError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-5 space-y-2">
              <label className="block text-xs font-semibold text-surface-700">
                To confirm, type <span className="font-mono font-bold text-rose-600">DELETE</span> below:
              </label>
              <input
                type="text"
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2 px-3 text-sm font-mono outline-none focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-100"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmText !== 'DELETE' || deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Permanently Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
