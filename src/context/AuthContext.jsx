import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

const LOCAL_USERS_KEY = 'smart-petty-cash-local-users'
const LOCAL_CURRENT_USER_KEY = 'smart-petty-cash-current-user'

// Built-in Demo Accounts for instant local testing without cloud credentials
export const DEMO_USERS = [
  {
    id: 'local-user-alice-001',
    email: 'alice@company.com',
    fullName: 'Alice Smith',
    title: 'Operations Director',
    location: 'Dubai Office',
    avatarUrl: ''
  },
  {
    id: 'local-user-bob-002',
    email: 'bob@company.com',
    fullName: 'Bob Jones',
    title: 'Site Lead Engineer',
    location: 'Abu Dhabi Site',
    avatarUrl: ''
  }
]

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  isCloudAuth: false,
  signInWithPassword: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signInWithMagicLink: async () => {},
  switchLocalUser: () => {},
  signOut: async () => {},
  updateProfile: async () => {}
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const isCloudAuth = Boolean(isSupabaseConfigured && supabase)

  // ---------------------------------------------------------------------------
  // Local Mode Auth Helpers
  // ---------------------------------------------------------------------------
  const getStoredLocalUsers = () => {
    try {
      const saved = localStorage.getItem(LOCAL_USERS_KEY)
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.error('Failed to read local users:', e)
    }
    return DEMO_USERS
  }

  const getStoredCurrentLocalUser = () => {
    try {
      const saved = localStorage.getItem(LOCAL_CURRENT_USER_KEY)
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.error('Failed to read current local user:', e)
    }
    // Default to Alice if no user active in local mode
    return DEMO_USERS[0]
  }

  // ---------------------------------------------------------------------------
  // Load Profile from Supabase
  // ---------------------------------------------------------------------------
  const fetchCloudProfile = useCallback(async (userId, userEmail, userMetadata = {}) => {
    if (!supabase) return null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data) {
        return {
          id: data.id,
          email: data.email || userEmail,
          fullName: data.full_name || userMetadata.full_name || userMetadata.name || '',
          title: data.title || '',
          location: data.location || '',
          avatarUrl: data.avatar_url || userMetadata.avatar_url || ''
        }
      }

      // If no profile row yet, return metadata
      return {
        id: userId,
        email: userEmail,
        fullName: userMetadata.full_name || userMetadata.name || '',
        title: userMetadata.title || '',
        location: userMetadata.location || '',
        avatarUrl: userMetadata.avatar_url || ''
      }
    } catch (err) {
      console.warn('Failed to fetch cloud profile:', err)
      return {
        id: userId,
        email: userEmail,
        fullName: userMetadata.full_name || userMetadata.name || '',
        title: '',
        location: '',
        avatarUrl: ''
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Initial Auth State Listener
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      if (isCloudAuth) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user && isMounted) {
            setUser(session.user)
            const prof = await fetchCloudProfile(session.user.id, session.user.email, session.user.user_metadata)
            if (isMounted) setProfile(prof)
          } else if (isMounted) {
            setUser(null)
            setProfile(null)
          }
        } catch (err) {
          console.warn('Error reading Supabase session:', err)
        } finally {
          if (isMounted) setLoading(false)
        }

        // Listen for realtime auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!isMounted) return
          if (session?.user) {
            setUser(session.user)
            const prof = await fetchCloudProfile(session.user.id, session.user.email, session.user.user_metadata)
            if (isMounted) setProfile(prof)
          } else {
            setUser(null)
            setProfile(null)
          }
          setLoading(false)
        })

        return () => {
          subscription?.unsubscribe()
        }
      } else {
        // Local mode initialization
        const currentLocal = getStoredCurrentLocalUser()
        if (isMounted) {
          setUser(currentLocal ? { id: currentLocal.id, email: currentLocal.email } : null)
          setProfile(currentLocal || null)
          setLoading(false)
        }
      }
    }

    initAuth()

    return () => {
      isMounted = false
    }
  }, [isCloudAuth, fetchCloudProfile])

  // ---------------------------------------------------------------------------
  // Auth Actions
  // ---------------------------------------------------------------------------

  // 1. Sign In with Email & Password
  const signInWithPassword = async ({ email, password }) => {
    if (isCloudAuth) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })
      if (error) throw error
      return data
    } else {
      // Local Mode: check local user list or register dynamically
      const localUsers = getStoredLocalUsers()
      let found = localUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
      if (!found) {
        // Create user dynamically in local mode
        found = {
          id: `local-user-${Date.now()}`,
          email: email.trim(),
          fullName: email.split('@')[0],
          title: 'Employee',
          location: '',
          avatarUrl: ''
        }
        const updated = [...localUsers, found]
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated))
      }
      localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(found))
      setUser({ id: found.id, email: found.email })
      setProfile(found)
      return { user: found }
    }
  }

  // 2. Sign Up
  const signUp = async ({ email, password, fullName = '', title = '', location = '' }) => {
    if (isCloudAuth) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            title: title.trim(),
            location: location.trim()
          }
        }
      })
      if (error) throw error

      if (data?.user) {
        // Insert or update profile in database
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: email.trim(),
            full_name: fullName.trim(),
            title: title.trim(),
            location: location.trim()
          })
        } catch (e) {
          console.warn('Profile creation hook warning:', e)
        }
      }
      return data
    } else {
      // Local Mode
      const localUsers = getStoredLocalUsers()
      const newUser = {
        id: `local-user-${Date.now()}`,
        email: email.trim(),
        fullName: fullName.trim() || email.split('@')[0],
        title: title.trim(),
        location: location.trim(),
        avatarUrl: ''
      }
      const updated = [...localUsers.filter(u => u.email !== newUser.email), newUser]
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated))
      localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(newUser))
      setUser({ id: newUser.id, email: newUser.email })
      setProfile(newUser)
      return { user: newUser }
    }
  }

  // 3. Google OAuth Sign In
  const signInWithGoogle = async () => {
    if (isCloudAuth) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
      return data
    } else {
      // Mock Google login in local mode
      const googleUser = {
        id: 'local-user-google-mock',
        email: 'google.user@company.com',
        fullName: 'Google User',
        title: 'Cloud Specialist',
        location: 'HQ',
        avatarUrl: ''
      }
      localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(googleUser))
      setUser({ id: googleUser.id, email: googleUser.email })
      setProfile(googleUser)
      return { user: googleUser }
    }
  }

  // 4. Magic Link (Passwordless OTP link)
  const signInWithMagicLink = async ({ email }) => {
    if (isCloudAuth) {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin
        }
      })
      if (error) throw error
      return data
    } else {
      // Local mode instant login via magic link email
      return signInWithPassword({ email, password: 'local-mock-password' })
    }
  }

  // 5. Quick Switch Local User (for testing multiple users locally)
  const switchLocalUser = (userId) => {
    const localUsers = getStoredLocalUsers()
    const target = localUsers.find(u => u.id === userId) || DEMO_USERS[0]
    localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(target))
    setUser({ id: target.id, email: target.email })
    setProfile(target)
  }

  // 6. Sign Out
  const signOut = async () => {
    if (isCloudAuth) {
      await supabase.auth.signOut()
    }
    localStorage.removeItem(LOCAL_CURRENT_USER_KEY)
    setUser(null)
    setProfile(null)
  }

  // 7. Update User Profile
  const updateProfile = async (updates) => {
    const updatedData = {
      fullName: updates.fullName !== undefined ? updates.fullName : (profile?.fullName || ''),
      title: updates.title !== undefined ? updates.title : (profile?.title || ''),
      location: updates.location !== undefined ? updates.location : (profile?.location || ''),
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : (profile?.avatarUrl || '')
    }

    if (isCloudAuth && user?.id) {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: updatedData.fullName,
          title: updatedData.title,
          location: updatedData.location,
          avatar_url: updatedData.avatarUrl,
          updated_at: new Date().toISOString()
        })
      if (error) throw error
    } else if (profile?.id) {
      // Local mode
      const localUsers = getStoredLocalUsers().map(u => 
        u.id === profile.id ? { ...u, ...updatedData } : u
      )
      const current = { ...profile, ...updatedData }
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers))
      localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(current))
    }

    setProfile(prev => ({
      ...(prev || {}),
      id: user?.id || prev?.id,
      email: user?.email || prev?.email,
      ...updatedData
    }))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isCloudAuth,
        signInWithPassword,
        signUp,
        signInWithGoogle,
        signInWithMagicLink,
        switchLocalUser,
        signOut,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
