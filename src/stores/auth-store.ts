import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  username: string
  email: string
  firstname: string
  lastname: string
  role: 'Administrator' | 'Operator' | 'User'
  avatar?: string | null
}

interface AuthStore {
  user: AuthUser | null
  isAuthenticated: boolean
  token: string | null
  setUser: (user: AuthUser | null) => void
  setToken: (token: string | null) => void
  login: (user: AuthUser, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'sla-auth',
    }
  )
)
