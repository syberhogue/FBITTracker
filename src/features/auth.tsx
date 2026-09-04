/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../lib/types';
import { demoProfile } from '../lib/demo-data';
import { demoMode, supabase } from '../lib/supabase';

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestReset(email: string): Promise<void>;
  setPassword(password: string): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const mapProfile = (row: any): Profile => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  role: row.role,
  organizationUnitId: row.organization_unit_id ?? undefined,
  organizationUnit: row.organization_units?.name,
  isActive: row.is_active,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(demoMode ? demoProfile : null);
  const [loading, setLoading] = useState(!demoMode);

  useEffect(() => {
    if (demoMode) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(Boolean(next));
      if (!next) setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (demoMode || !session) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase.from('profiles').select('*, organization_units!profiles_organization_unit_id_fkey(name)').eq('id', session.user.id).single();
      if (!active) return;
      if (error || !data?.is_active) {
        setProfile(null);
        setLoading(false);
        await supabase.auth.signOut();
        return;
      }
      setProfile(mapProfile(data));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [session]);

  const value = useMemo<AuthValue>(() => ({
    session,
    profile,
    loading,
    async signIn(email, password) {
      if (demoMode) { setProfile({ ...demoProfile, email }); return; }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() { if (!demoMode) await supabase.auth.signOut(); else setProfile(null); },
    async requestReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/accept-invite` });
      if (error) throw error;
    },
    async setPassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
  }), [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
