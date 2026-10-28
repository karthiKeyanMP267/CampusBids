import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Gavel, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { signIn, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDeleted = new URLSearchParams(location.search).get('deleted') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!isConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
      return;
    }

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    const { error: authError } = await signIn({ email, password });
    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      const destination = location.state?.from?.pathname || '/';
      navigate(destination, { replace: true });
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Gavel className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold text-surface-900 tracking-tight">
              Campus<span className="text-brand-600">Bid</span>
            </span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-surface-900">Welcome back</h1>
          <p className="mt-2 text-sm text-surface-500">
            Sign in to your account to start bidding
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
          {!isConfigured && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Demo Mode</p>
                  <p className="mt-1 text-xs text-amber-600">
                    Supabase is not configured. Authentication requires a Supabase project.
                    Add <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
                    <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to your{' '}
                    <code className="bg-amber-100 px-1 rounded">.env</code> file.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isDeleted && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800">
                Your account and all associated records have been permanently deleted.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-surface-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@college.edu"
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-100 placeholder:text-surface-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-surface-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-10 text-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-100 placeholder:text-surface-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-surface-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
