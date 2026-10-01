import { useState } from 'react'
import { 
  Receipt, 
  ShieldCheck, 
  Sparkles, 
  FileText, 
  ArrowRight, 
  Mail, 
  Lock, 
  User, 
  Briefcase, 
  MapPin, 
  Sun, 
  Moon, 
  CheckCircle2, 
  AlertCircle,
  ScanLine,
  Database,
  Layers,
  ArrowUpRight
} from 'lucide-react'
import { useAuth, DEMO_USERS } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function LandingPage() {
  const { 
    signInWithPassword, 
    signUp, 
    signInWithGoogle, 
    signInWithMagicLink, 
    switchLocalUser, 
    isCloudAuth 
  } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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
      } else {
        if (!email.trim() || !password) {
          throw new Error('Please enter an email and password.')
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.')
        }
        await signUp({ email, password, fullName, title, location })
        if (isCloudAuth) {
          setSuccessMessage('Account created! Check your email to confirm your account, or sign in.')
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
      setLoading(false)
    }
  }

  const handleDemoSelect = (demoUserId) => {
    switchLocalUser(demoUserId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-200 flex flex-col justify-between">
      
      {/* Top Navbar */}
      <header className="w-full border-b border-gray-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/image.png" 
              alt="Manlift Logo" 
              className="h-8 w-auto object-contain"
            />
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
              Smart Petty Cash
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-amber-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-700 shadow-sm"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={() => {
                setMode('signin')
                document.getElementById('auth-form-card')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors border border-blue-200 dark:border-blue-900/60"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero & Auth Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800/80 shadow-sm">
              <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
              <span>Secure Multi-User Expense Management</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-950 dark:text-white leading-[1.15]">
              Smart Business Expenses, <span className="text-blue-600 dark:text-blue-400">Simplified.</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Please sign in or create an account to start creating and managing your business petty cash vouchers. Each user has their own private workspace with complete data confidentiality.
            </p>

            {/* Quick Feature Bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-gray-200/70 dark:border-slate-800">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 mt-0.5">
                  <ScanLine size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">Smart OCR Scanner</h4>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">Extracts vendor, amounts & dates in seconds.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-gray-200/70 dark:border-slate-800">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0 mt-0.5">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">Strict Tenant Privacy</h4>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">You only see and edit your own vouchers.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-gray-200/70 dark:border-slate-800">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-lg shrink-0 mt-0.5">
                  <FileText size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">Pixel-Perfect PDF</h4>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">Audit-ready multi-page exports with receipts.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-gray-200/70 dark:border-slate-800">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg shrink-0 mt-0.5">
                  <Database size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">Cloud & Offline Sync</h4>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">Works seamlessly online and in offline mode.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Authentication Card */}
          <div className="lg:col-span-5" id="auth-form-card">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200/80 dark:border-slate-800 p-6 sm:p-8 space-y-6 relative overflow-hidden transition-all">
              
              {/* Card Header & Switcher */}
              <div className="space-y-4">
                <div className="flex rounded-xl bg-gray-100 dark:bg-slate-800/80 p-1 border border-gray-200/60 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setError(''); setSuccessMessage(''); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      mode === 'signin'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setError(''); setSuccessMessage(''); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      mode === 'signup'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">
                    {mode === 'signin' ? 'Welcome Back' : 'Create Your Account'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {mode === 'signin' 
                      ? 'Sign in to access your business vouchers and receipts.' 
                      : 'Register to start creating and tracking your expense reimbursements.'}
                  </p>
                </div>
              </div>

              {/* Status Notifications */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Continue with Google Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-white rounded-xl text-sm font-semibold transition-all border border-gray-300 dark:border-slate-700 shadow-sm disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-gray-200 dark:border-slate-800 w-full" />
                <span className="bg-white dark:bg-slate-900 px-3 text-[11px] uppercase font-bold tracking-wider text-gray-400 dark:text-slate-500">
                  Or continue with email
                </span>
                <div className="border-t border-gray-200 dark:border-slate-800 w-full" />
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === 'signup' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. John Doe"
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                          Title / Position
                        </label>
                        <div className="relative">
                          <Briefcase size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Engineer"
                            className="w-full pl-8 pr-2.5 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                          Location / Branch
                        </label>
                        <div className="relative">
                          <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. Dubai"
                            className="w-full pl-8 pr-2.5 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loading ? 'Processing...' : mode === 'signin' ? 'Sign In to Portal' : 'Create Free Account'}
                  <ArrowRight size={16} />
                </button>
              </form>

              {/* Instant 1-Click Demo Accounts */}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-amber-500" />
                  Quick Demo Access (Test Isolation):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_USERS.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => handleDemoSelect(demo.id)}
                      className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700/80 bg-gray-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-slate-800 hover:border-blue-300 text-left transition-all"
                    >
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{demo.fullName}</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">{demo.title}</p>
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-1 inline-block">
                        Enter Workspace →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200/80 dark:border-slate-800/80 py-6 text-center text-xs text-gray-500 dark:text-slate-400 bg-white/40 dark:bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} MANLIFT Middle East. All rights reserved.</span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={13} /> Strict Multi-Tenant Data Isolation Active
          </span>
        </div>
      </footer>

    </div>
  )
}
