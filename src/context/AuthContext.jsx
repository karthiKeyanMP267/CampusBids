import { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Provides auth state throughout the app.
 * When Supabase is not configured, provides a demo mode with no auth.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured] = useState(isSupabaseConfigured());

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    let subscription;

    async function init() {
      const supabase = await getSupabase();
      if (!supabase) { setLoading(false); return; }

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(supabase, session.user.id);
      }
      setLoading(false);

      // Listen for auth changes
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(supabase, session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
        }
      );
      subscription = sub;
    }

    init();

    return () => {
      subscription?.unsubscribe();
    };
  }, [isConfigured]);

  async function fetchProfile(supabase, userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  }

  async function signUp({ email, password, displayName, college }) {
    const supabase = await getSupabase();
    if (!supabase) return { error: { message: 'Supabase not configured' } };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (!error && data.user) {
      // Update profile with college
      await supabase
        .from('profiles')
        .update({ college, display_name: displayName })
        .eq('id', data.user.id);
    }

    return { data, error };
  }

  async function signIn({ email, password }) {
    const supabase = await getSupabase();
    if (!supabase) return { error: { message: 'Supabase not configured' } };

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { data, error };
  }

  async function signOut() {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function updateProfile(updates) {
    const supabase = await getSupabase();
    if (!supabase || !user) return { error: { message: 'Not authenticated' } };

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (data) setProfile(data);
    return { data, error };
  }

  const value = {
    user,
    profile,
    loading,
    isConfigured,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
