import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  setSession: (session: Session | null) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null })
  },
}))

// Initialize auth state from existing session
supabase.auth.getSession().then(({ data: { session } }) => {
  useAuthStore.getState().setSession(session)
})

// Listen for auth changes
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session)
})
