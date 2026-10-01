import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  User, 
  Mail, 
  Briefcase, 
  MapPin, 
  Save, 
  ArrowLeft, 
  LogOut, 
  Receipt, 
  DollarSign, 
  Star, 
  ShieldCheck, 
  Sparkles,
  Sun,
  Moon
} from 'lucide-react'
import { useAuth, DEMO_USERS } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { voucherService } from '../services/voucherService'
import Toast from './Toast'

export default function UserProfile() {
  const navigate = useNavigate()
  const { user, profile, updateProfile, signOut, switchLocalUser, isCloudAuth } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  const [fullName, setFullName] = useState(profile?.fullName || '')
  const [title, setTitle] = useState(profile?.title || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [userStats, setUserStats] = useState({ count: 0, amount: '0.00', favourites: 0 })

  // Synchronize state when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '')
      setTitle(profile.title || '')
      setLocation(profile.location || '')
    }
  }, [profile])

  // Load user-specific voucher stats
  useEffect(() => {
    async function loadStats() {
      if (!user?.id) return
      try {
        const { data } = await voucherService.getAllVouchers(user.id)
        if (Array.isArray(data)) {
          const count = data.length
          const amount = data.reduce((sum, v) => {
            const expTotal = (v.expenses || []).reduce((eSum, e) => eSum + (parseFloat(e.amountAED) || 0), 0)
            return sum + expTotal
          }, 0).toFixed(2)
          const favourites = data.filter(v => v.isFavourite).length
          setUserStats({ count, amount, favourites })
        }
      } catch (err) {
        console.warn('Failed to load user stats:', err)
      }
    }
    loadStats()
  }, [user?.id])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({
        fullName: fullName.trim(),
        title: title.trim(),
        location: location.trim()
      })
      setToast({ message: 'Profile updated successfully! Default values will pre-fill new vouchers.', type: 'success' })
    } catch (err) {
      setToast({ message: err.message || 'Failed to update profile.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  // Get user initials for avatar
  const initials = (fullName || profile?.email || 'U')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 px-4 md:px-8 lg:px-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Top Control Bar */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-lg transition-all"
          >
            <ArrowLeft size={16} />
            Back to Vouchers
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-750"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-all border border-red-200 dark:border-red-900/50"
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Profile Header Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 p-6 md:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative overflow-hidden">
          
          {/* Avatar / Badge */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shrink-0">
            {initials}
          </div>

          {/* User Info */}
          <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-2xl font-bold truncate">
                {fullName || 'User Profile'}
              </h2>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                isCloudAuth 
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' 
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}>
                {isCloudAuth ? <ShieldCheck size={13} /> : <Sparkles size={13} />}
                {isCloudAuth ? 'Supabase Cloud Account' : 'Local User Mode'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1">
              <Mail size={13} />
              {profile?.email || user?.email || 'No email provided'}
            </p>

            {title && (
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium pt-1">
                {title} {location && `• ${location}`}
              </p>
            )}
          </div>
        </div>

        {/* User Personal Voucher Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
              <Receipt size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">My Vouchers</p>
              <p className="text-lg font-black">{userStats.count}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 rounded-lg">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">My Total</p>
              <p className="text-lg font-black text-green-600 dark:text-green-400">{userStats.amount} <span className="text-[10px]">AED</span></p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 rounded-lg">
              <Star size={20} className="fill-amber-500" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Favourites</p>
              <p className="text-lg font-black text-amber-500">{userStats.favourites}</p>
            </div>
          </div>
        </div>

        {/* Demo Account Switcher Banner (if in local mode) */}
        {!isCloudAuth && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Switch Active Test Profile (Multi-User Demo)
                </h3>
              </div>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wider">
                Isolated Voucher Stores
              </span>
            </div>

            <p className="text-xs text-amber-800 dark:text-amber-300">
              Notice: Switching users updates the view so you only see the vouchers belonging to that user. One user cannot view another user's vouchers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {DEMO_USERS.map((demo) => {
                const isActive = profile?.id === demo.id
                return (
                  <button
                    key={demo.id}
                    onClick={() => switchLocalUser(demo.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isActive 
                        ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-400 font-bold shadow-sm' 
                        : 'bg-white dark:bg-slate-900/80 border-amber-200 dark:border-amber-900/40 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{demo.fullName}</span>
                      {isActive && (
                        <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.2 rounded font-semibold">Active</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{demo.title} • {demo.location}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Profile Settings Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 p-6 md:p-8">
          <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold">Personal & Business Defaults</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              These details will automatically pre-fill your name, title, and location whenever you create a new petty cash voucher.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Employee Name <span className="text-[11px] text-slate-400 font-normal">(Text only)</span>
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value.replace(/[0-9]/g, ''))}
                  placeholder="e.g. John Doe"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Designation / Position <span className="text-[11px] text-slate-400 font-normal">(Text only)</span>
              </label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.replace(/[0-9]/g, ''))}
                  placeholder="e.g. OPERATIONS MANAGER"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Default Site / Location <span className="text-[11px] text-slate-400 font-normal">(Text only)</span>
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value.replace(/[0-9]/g, ''))}
                  placeholder="e.g. DUBAI OFFICE"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                <Save size={16} />
                {saving ? 'Saving Changes...' : 'Save Profile Defaults'}
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
