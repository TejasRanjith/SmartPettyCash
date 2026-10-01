import { useState } from 'react'
import { X, Mail, Lock, User, Briefcase, MapPin, Sparkles, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth, DEMO_USERS } from '../context/AuthContext'

export default function AuthModal({ isOpen, onClose }) {
  const { 
    signInWithPassword, 
    signUp, 
    signInWithGoogle, 
    signInWithMagicLink, 
    switchLocalUser, 
    isCloudAuth,
    profile 
  } = useAuth()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'magiclink'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
      if (mode === 'signin') {
        if (!email.trim() || !password) {
          throw new Error('Please enter both email and password.')
        }
        await signInWithPassword({ email, password })
        onClose()
      } else if (mode === 'signup') {
        if (!email.trim() || !password) {
          throw new Error('Please enter an email and password.')
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.')
        }
        await signUp({ email, password, fullName, title, location })
        if (isCloudAuth) {
          setSuccessMessage('Account created! Please check your email inbox to confirm your account, or sign in.')
        } else {
          onClose()
        }
      } else if (mode === 'magiclink') {
        if (!email.trim()) {
          throw new Error('Please enter your email address.')
        }
        await signInWithMagicLink({ email })
        setSuccessMessage('Magic Link sent! Check your email for the login link.')
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
      if (!isCloudAuth) onClose()
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
      setLoading(false)
    }
  }

  const handleDemoSwitch = (demoUserId) => {
    switchLocalUser(demoUserId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-xl font-bold">
              {mode === 'signin' && 'Sign In to Your Account'}
              {mode === 'signup' && 'Create Your Account'}
              {mode === 'magiclink' && 'Sign In with Magic Link'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Access your personalized petty cash vouchers
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 p-1">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); setSuccessMessage(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'signin' 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); setSuccessMessage(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'signup' 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => { setMode('magiclink'); setError(''); setSuccessMessage(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'magiclink' 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Magic Link
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Local Mode Notice & Demo User Switcher */}
          {!isCloudAuth && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <Sparkles size={14} />
                <span>Local Multi-User Mode Active</span>
              </div>
              <p className="text-amber-700 dark:text-amber-400/90 text-[11px]">
                Test user-isolated vouchers right away by switching between demo accounts:
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {DEMO_USERS.map((demo) => {
                  const isActive = profile?.id === demo.id
                  return (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => handleDemoSwitch(demo.id)}
                      className={`text-left p-2 rounded-lg border transition-all text-xs ${
                        isActive
                          ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-400 font-bold text-amber-900 dark:text-amber-200'
                          : 'bg-white dark:bg-slate-800/80 border-amber-200 dark:border-amber-900/40 hover:bg-amber-50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="truncate font-semibold">{demo.fullName}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{demo.title}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Social Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">or with email</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Alerts */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 rounded-xl text-xs">
              <CheckCircle2 size={16} className="shrink-0 text-green-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value.replace(/[0-9]/g, ''))}
                      placeholder="e.g. John Doe"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Designation / Title
                    </label>
                    <div className="relative">
                      <Briefcase size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value.replace(/[0-9]/g, ''))}
                        placeholder="e.g. Site Lead"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Default Location
                    </label>
                    <div className="relative">
                      <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value.replace(/[0-9]/g, ''))}
                        placeholder="e.g. DUBAI"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {mode !== 'magiclink' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 mt-2"
            >
              {loading ? 'Processing...' : (
                <>
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'magiclink' && 'Send Magic Link'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

        </div>

      </div>
    </div>
  )
}
