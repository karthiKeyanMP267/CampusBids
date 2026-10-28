import { useState, useEffect } from 'react';
import { Bookmark, Search, Trash2, ArrowRight, X, CheckCircle2, AlertCircle, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { formatINR } from '../../lib/utils';

export default function SavedSearchesModal({
  isOpen,
  onClose,
  currentCriteria = {},
  onApplySearch,
}) {
  const { user, isAuthenticated } = useAuth();
  const [savedSearches, setSavedSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadSavedSearches() {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setSavedSearches(data || []);
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadSavedSearches();
      // Pre-fill name based on criteria
      const queryPart = currentCriteria.query ? `"${currentCriteria.query}"` : '';
      const catPart = currentCriteria.category ? currentCriteria.category : '';
      setSearchName([queryPart, catPart].filter(Boolean).join(' in ') || 'My Campus Search');
    }
  }, [isOpen, user?.id]);

  async function handleSaveCurrentSearch(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const name = searchName.trim();
    if (!name) {
      setError('Please provide a name for this search.');
      return;
    }

    try {
      setSaving(true);
      if (supabase) {
        const { error: insErr } = await supabase
          .from('saved_searches')
          .insert({
            user_id: user.id,
            name,
            query: currentCriteria.query || null,
            category: currentCriteria.category || null,
            condition: currentCriteria.condition || null,
            min_price: currentCriteria.min_price || null,
            max_price: currentCriteria.max_price || null,
          });

        if (insErr) throw insErr;
        setSuccess(`Saved "${name}"! You will receive match alerts when new items are listed.`);
        await loadSavedSearches();
      } else {
        setSavedSearches((prev) => [
          {
            id: `ss-${Date.now()}`,
            name,
            query: currentCriteria.query,
            category: currentCriteria.category,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setSuccess(`Saved "${name}" (Demo mode).`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save search.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSavedSearch(id) {
    try {
      if (supabase) {
        await supabase.from('saved_searches').delete().eq('id', id);
      }
      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Non-blocking
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-surface-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-150">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 font-bold">
              <Bookmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-surface-900">Saved Searches & Alerts</h3>
              <p className="text-xs text-surface-500">Get notified when matching items are listed</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Save Current Search Form */}
        {isAuthenticated && (
          <form onSubmit={handleSaveCurrentSearch} className="mt-4 p-4 rounded-xl bg-surface-50 border border-surface-200">
            <h4 className="text-xs font-bold text-surface-900 mb-2 flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-brand-600" />
              Save Current Search Filters
            </h4>
            <div className="text-[11px] text-surface-500 mb-3 flex flex-wrap gap-2">
              {currentCriteria.query && (
                <span className="rounded-lg bg-white border border-surface-200 px-2 py-0.5 font-medium">
                  Keyword: &quot;{currentCriteria.query}&quot;
                </span>
              )}
              {currentCriteria.category && (
                <span className="rounded-lg bg-white border border-surface-200 px-2 py-0.5 font-medium">
                  Category: {currentCriteria.category}
                </span>
              )}
              {currentCriteria.condition && (
                <span className="rounded-lg bg-white border border-surface-200 px-2 py-0.5 font-medium">
                  Condition: {currentCriteria.condition}
                </span>
              )}
              {!currentCriteria.query && !currentCriteria.category && !currentCriteria.condition && (
                <span className="italic">All active auctions</span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Name your alert (e.g. Mechanical Keyboards)"
                required
                className="flex-1 rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-all shadow-xs shrink-0"
              >
                {saving ? 'Saving…' : 'Save Search'}
              </button>
            </div>
          </form>
        )}

        {/* Saved Searches List */}
        <div className="mt-6 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">
            Your Active Saved Searches ({savedSearches.length})
          </h4>

          {loading ? (
            <div className="py-8 text-center text-xs text-surface-400 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
              Loading saved searches…
            </div>
          ) : savedSearches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-200 p-8 text-center">
              <Search className="h-6 w-6 text-surface-300 mx-auto mb-2" />
              <p className="text-xs text-surface-500">
                You haven&apos;t saved any searches yet. Save your favorite queries to get notified the second a campus peer lists a matching item!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedSearches.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-50 border border-surface-200 hover:border-brand-300 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-surface-900 truncate">{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-surface-500">
                      {s.query && <span>&quot;{s.query}&quot;</span>}
                      {s.category && <span>• {s.category}</span>}
                      {s.condition && <span>• {s.condition}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (onApplySearch) onApplySearch(s);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-white border border-surface-200 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors shadow-2xs"
                    >
                      <span>Run</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedSearch(s.id)}
                      className="rounded-lg p-1.5 text-surface-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Delete saved search"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
