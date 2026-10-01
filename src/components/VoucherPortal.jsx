import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, 
  Trash2, 
  Receipt, 
  Star, 
  Search, 
  ArrowUpDown, 
  Layers, 
  Calendar, 
  MapPin, 
  User, 
  DollarSign, 
  Filter,
  LayoutGrid,
  FileSpreadsheet,
  List,
  AlignJustify,
  ArrowRight,
  Sun,
  Moon,
  Cloud,
  Database,
  RefreshCw,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  ExternalLink
} from 'lucide-react'
import { formatVoucherCode, calculateExpensesTotal } from '../utils/voucherUtils'
import { useTheme } from '../context/ThemeContext'
import { useAuth, DEMO_USERS } from '../context/AuthContext'
import { voucherService } from '../services/voucherService'
import AuthModal from './AuthModal'

const VIEW_MODE_KEY = 'smart-petty-cash-view-mode'

export default function VoucherPortal() {
  const navigate = useNavigate()
  const { theme, toggleTheme, isDark } = useTheme()
  const { user, profile, isCloudAuth, signOut, switchLocalUser } = useAuth()
  
  const [vouchers, setVouchers] = useState([])
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [syncState, setSyncState] = useState({
    isCloud: voucherService.isCloudEnabled(),
    syncing: false,
    label: voucherService.isCloudEnabled() ? 'Supabase Cloud' : 'Local Storage Mode'
  })
  
  // Search, Filter, Sort, Group & View Mode states
  const [searchQuery, setSearchQuery] = useState('')
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState('date-desc')
  const [groupBy, setGroupBy] = useState('none') // 'none' | 'location' | 'month' | 'employee'
  
  // View mode: 'grid' | 'descriptive' | 'detailed' | 'compact'
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem(VIEW_MODE_KEY) || 'grid'
  })

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode)
    } catch (e) {
      console.error('Failed to save view mode:', e)
    }
  }

  // Load vouchers from voucherService & auto-migrate un-synced local data to Supabase if configured
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (voucherService.isCloudEnabled()) {
        setSyncState(prev => ({ ...prev, syncing: true }))
        try {
          await voucherService.migrateLocalStorageToSupabase(user?.id)
        } catch (e) {
          console.warn('Auto migration error:', e)
        }
      }

      const { data, source } = await voucherService.getAllVouchers(user?.id)
      if (isMounted) {
        setVouchers(data)
        setSyncState({
          isCloud: source === 'supabase',
          syncing: false,
          label: source === 'supabase' ? 'Supabase Cloud Synced' : 'Local Storage Mode'
        })
      }
    }

    loadData()
    return () => { isMounted = false }
  }, [user?.id])

  // Manual sync trigger
  const handleManualSync = async () => {
    if (!voucherService.isCloudEnabled()) return
    setSyncState(prev => ({ ...prev, syncing: true }))
    try {
      await voucherService.migrateLocalStorageToSupabase(user?.id)
      const { data, source } = await voucherService.getAllVouchers(user?.id)
      setVouchers(data)
      setSyncState({
        isCloud: source === 'supabase',
        syncing: false,
        label: 'Supabase Cloud Synced'
      })
    } catch (e) {
      console.warn('Sync failed:', e)
      setSyncState(prev => ({ ...prev, syncing: false }))
    }
  }

  // Create new voucher with standardized naming convention and current user profile defaults
  const handleCreateVoucher = async () => {
    try {
      const timestamp = Date.now()
      const voucherCode = formatVoucherCode(timestamp)
      const newVoucher = await voucherService.createVoucher({
        voucherCode,
        isFavourite: false,
        formData: {
          name: profile?.fullName || '',
          date: new Date().toISOString().split('T')[0],
          location: profile?.location || '',
          title: profile?.title || '',
          expenseTitle: ''
        },
        expenses: []
      }, { id: user?.id, profile })
      setVouchers(prev => [newVoucher, ...prev])
      navigate(`/voucher/${newVoucher.voucherCode || newVoucher.id}`)
    } catch (e) {
      console.error('Failed to create voucher:', e)
    }
  }

  // Toggle Favourite Status
  const handleToggleFavourite = async (e, voucherId) => {
    e.stopPropagation()
    const target = vouchers.find(v => v.id === voucherId || v.voucherCode === voucherId)
    const currentFav = Boolean(target?.isFavourite)
    setVouchers(prev => prev.map(v => 
      (v.id === voucherId || v.voucherCode === voucherId) ? { ...v, isFavourite: !currentFav } : v
    ))
    await voucherService.toggleFavourite(voucherId, currentFav, user?.id)
  }

  // Delete Voucher
  const handleDeleteVoucher = async (e, voucherId) => {
    e.stopPropagation()
    const target = vouchers.find(v => v.id === voucherId || v.voucherCode === voucherId)
    const codeName = target?.voucherCode || `Voucher #${voucherId}`
    if (window.confirm(`Are you sure you want to delete ${codeName}?`)) {
      setVouchers(prev => prev.filter(v => v.id !== voucherId && v.voucherCode !== voucherId))
      await voucherService.deleteVoucher(voucherId, user?.id)
    }
  }

  // Filtered & Sorted Vouchers
  const filteredAndSortedVouchers = useMemo(() => {
    let result = [...vouchers]

    // 1. Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(v => {
        const code = (v.voucherCode || '').toLowerCase()
        const name = (v.formData?.name || '').toLowerCase()
        const location = (v.formData?.location || '').toLowerCase()
        const title = (v.formData?.title || '').toLowerCase()
        const expTitle = (v.formData?.expenseTitle || '').toLowerCase()
        const descriptions = (v.expenses || []).map(e => (e.description || '').toLowerCase()).join(' ')
        return code.includes(q) || name.includes(q) || location.includes(q) || title.includes(q) || expTitle.includes(q) || descriptions.includes(q)
      })
    }

    // 2. Filter by Favourites
    if (favouritesOnly) {
      result = result.filter(v => v.isFavourite)
    }

    // 3. Sort Vouchers
    result.sort((a, b) => {
      const dateA = new Date(a.formData?.date || a.id).getTime() || 0
      const dateB = new Date(b.formData?.date || b.id).getTime() || 0
      const totalA = parseFloat(calculateExpensesTotal(a.expenses)) || 0
      const totalB = parseFloat(calculateExpensesTotal(b.expenses)) || 0
      const itemsA = a.expenses?.length || 0
      const itemsB = b.expenses?.length || 0
      const nameA = (a.formData?.name || a.voucherCode || '').toLowerCase()
      const nameB = (b.formData?.name || b.voucherCode || '').toLowerCase()

      switch (sortBy) {
        case 'date-desc':
          return dateB - dateA
        case 'date-asc':
          return dateA - dateB
        case 'amount-desc':
          return totalB - totalA
        case 'amount-asc':
          return totalA - totalB
        case 'items-desc':
          return itemsB - itemsA
        case 'items-asc':
          return itemsA - itemsB
        case 'name-asc':
          return nameA.localeCompare(nameB)
        case 'name-desc':
          return nameB.localeCompare(nameA)
        default:
          return dateB - dateA
      }
    })

    return result
  }, [vouchers, searchQuery, favouritesOnly, sortBy])

  // Grouped Vouchers Map
  const groupedVouchers = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Vouchers': filteredAndSortedVouchers }
    }

    const groups = {}
    filteredAndSortedVouchers.forEach(v => {
      let groupKey = 'Other'
      if (groupBy === 'location') {
        groupKey = (v.formData?.location || 'Unspecified Location').toUpperCase().trim()
      } else if (groupBy === 'month') {
        const d = new Date(v.formData?.date || v.id)
        groupKey = isNaN(d.getTime()) 
          ? 'Unknown Date' 
          : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      } else if (groupBy === 'employee') {
        groupKey = (v.formData?.name || 'Unassigned Employee').trim()
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(v)
    })

    return groups
  }, [filteredAndSortedVouchers, groupBy])

  // Statistics Summary
  const stats = useMemo(() => {
    const totalCount = vouchers.length
    const totalAmount = vouchers.reduce(
      (sum, v) => sum + (parseFloat(calculateExpensesTotal(v.expenses)) || 0), 
      0
    ).toFixed(2)
    const favouritesCount = vouchers.filter(v => v.isFavourite).length
    const uniqueLocations = new Set(vouchers.map(v => v.formData?.location?.trim()).filter(Boolean)).size

    return { totalCount, totalAmount, favouritesCount, uniqueLocations }
  }, [vouchers])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 px-4 md:px-8 lg:px-12 text-gray-900 dark:text-slate-100 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top User Account Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {profile?.fullName ? profile.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'SP'}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                <span>Signed in as</span>
                <span className="font-semibold text-gray-800 dark:text-slate-200">
                  {profile?.fullName || user?.email || 'Guest User'}
                </span>
                {profile?.title && (
                  <span className="hidden md:inline px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium text-[10px]">
                    {profile.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Quick Demo Switcher Indicator if in Local Mode */}
            {!isCloudAuth && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[11px] font-semibold border border-amber-200 dark:border-amber-800/60">
                <ShieldCheck size={12} className="text-amber-600 dark:text-amber-400" />
                Isolated User Space
              </span>
            )}

            {/* User Profile / Switcher Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all border border-gray-200 dark:border-slate-700"
              >
                <User size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="max-w-[140px] truncate">{profile?.fullName || 'My Account'}</span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div 
                    className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-3 space-y-3 animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="border-b border-gray-100 dark:border-slate-800 pb-2">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{profile?.fullName || user?.email || 'User'}</p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{user?.email || 'Local Account'}</p>
                      {profile?.location && (
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {profile.location}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        navigate('/profile')
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <User size={14} /> My Profile & Defaults
                      </span>
                      <ExternalLink size={12} className="opacity-60" />
                    </button>

                    {/* Multi-User Local Switcher for Testing Isolation */}
                    {!isCloudAuth && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-slate-500 flex items-center gap-1">
                          <ShieldCheck size={11} className="text-amber-500" />
                          Test Multi-User Isolation:
                        </p>
                        {DEMO_USERS.map(demoUser => (
                          <button
                            key={demoUser.id}
                            onClick={() => {
                              switchLocalUser(demoUser.id)
                              setUserMenuOpen(false)
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              user?.id === demoUser.id
                                ? 'bg-blue-600 text-white font-semibold'
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className="truncate">{demoUser.profile.fullName}</span>
                            <span className={`text-[10px] ${user?.id === demoUser.id ? 'text-blue-100' : 'text-gray-400'}`}>
                              {user?.id === demoUser.id ? 'Active' : 'Switch'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-gray-100 dark:border-slate-800 pt-2 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          setIsAuthModalOpen(true)
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        {isCloudAuth ? 'Switch Account' : 'Sign In with Cloud'}
                      </button>

                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          signOut()
                        }}
                        className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 font-semibold"
                      >
                        <LogOut size={12} /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl shadow-lg p-8 text-center text-white relative overflow-hidden">
          <img
            src="/image.png"
            alt="Company Logo"
            className="mx-auto object-contain mb-4 relative z-10"
            style={{ width: '384px', maxHeight: '288px' }}
          />
          <h2 className="text-3xl md:text-4xl font-extrabold mt-2 relative z-10">Petty Cash Portal</h2>
          <p className="text-blue-100 mt-2 relative z-10">Manage, group, filter and track your business expense vouchers</p>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
              <Receipt size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Vouchers</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalCount}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
            <div className="p-3 bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Amount</p>
              <p className="text-2xl font-black text-green-600 dark:text-green-400">{stats.totalAmount} <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">AED</span></p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 rounded-lg">
              <Star size={24} className="fill-amber-500 dark:fill-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Favourites</p>
              <p className="text-2xl font-black text-amber-500 dark:text-amber-400">{stats.favouritesCount}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-lg">
              <MapPin size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Locations</p>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.uniqueLocations}</p>
            </div>
          </div>
        </div>

        {/* Controls Toolbar: Search, Sort, Group, Favourites, View Modes, Dark Mode Toggle, New Voucher */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code (e.g. exp_voucher_...), employee, location, or description..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Action Buttons: Sync Indicator + Dark Mode Toggle + New Voucher Primary Button */}
            <div className="flex items-center gap-2 shrink-0">
              {syncState.isCloud ? (
                <button
                  onClick={handleManualSync}
                  disabled={syncState.syncing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all shadow-sm"
                  title="Supabase Cloud Database & Storage Active. Click to re-sync."
                >
                  <Cloud size={15} className={`text-emerald-600 dark:text-emerald-400 ${syncState.syncing ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">{syncState.syncing ? 'Syncing...' : 'Cloud Synced'}</span>
                  <RefreshCw size={12} className={`text-emerald-500 ${syncState.syncing ? 'animate-spin' : ''}`} />
                </button>
              ) : (
                <div 
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 shadow-sm"
                  title="Running in LocalStorage fallback mode. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to enable multi-user cloud backend."
                >
                  <Database size={14} className="text-slate-500 dark:text-slate-400" />
                  <span className="hidden sm:inline">Local Storage</span>
                </div>
              )}

              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-amber-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors border border-gray-200 dark:border-slate-700 shadow-sm"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button
                onClick={handleCreateVoucher}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all font-semibold shadow-md shrink-0"
              >
                <Plus size={20} />
                New Voucher
              </button>
            </div>
          </div>

          {/* Filter, Sort, Group & View Mode Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800 text-sm">
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Favourites Only Toggle */}
              <button
                onClick={() => setFavouritesOnly(!favouritesOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  favouritesOnly 
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-sm' 
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700'
                }`}
              >
                <Star size={16} className={favouritesOnly ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : 'text-gray-400 dark:text-slate-500'} />
                Favourites Only
              </button>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
                <ArrowUpDown size={15} className="text-gray-400 dark:text-slate-500" />
                <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent font-medium text-gray-700 dark:text-slate-200 focus:outline-none cursor-pointer text-xs dark:bg-slate-800"
                >
                  <option value="date-desc" className="dark:bg-slate-800 dark:text-white">Date (Newest First)</option>
                  <option value="date-asc" className="dark:bg-slate-800 dark:text-white">Date (Oldest First)</option>
                  <option value="amount-desc" className="dark:bg-slate-800 dark:text-white">Amount (Highest First)</option>
                  <option value="amount-asc" className="dark:bg-slate-800 dark:text-white">Amount (Lowest First)</option>
                  <option value="items-desc" className="dark:bg-slate-800 dark:text-white">Item Count (Most First)</option>
                  <option value="items-asc" className="dark:bg-slate-800 dark:text-white">Item Count (Fewest First)</option>
                  <option value="name-asc" className="dark:bg-slate-800 dark:text-white">Code/Name (A–Z)</option>
                  <option value="name-desc" className="dark:bg-slate-800 dark:text-white">Code/Name (Z–A)</option>
                </select>
              </div>

              {/* Group By Dropdown */}
              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
                <Layers size={15} className="text-gray-400 dark:text-slate-500" />
                <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Group:</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="bg-transparent font-medium text-gray-700 dark:text-slate-200 focus:outline-none cursor-pointer text-xs dark:bg-slate-800"
                >
                  <option value="none" className="dark:bg-slate-800 dark:text-white">None (Flat Grid)</option>
                  <option value="location" className="dark:bg-slate-800 dark:text-white">By Location</option>
                  <option value="month" className="dark:bg-slate-800 dark:text-white">By Month</option>
                  <option value="employee" className="dark:bg-slate-800 dark:text-white">By Employee</option>
                </select>
              </div>
            </div>

            {/* View Mode Switcher (Grid | Descriptive Grid | Detailed List | Compact List) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-slate-500 font-medium hidden sm:inline">View:</span>
              <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold' 
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => handleViewModeChange('descriptive')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'descriptive' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold' 
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                  title="Descriptive Grid View"
                >
                  <FileSpreadsheet size={16} />
                </button>
                <button
                  onClick={() => handleViewModeChange('detailed')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'detailed' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold' 
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                  title="Detailed Table View"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => handleViewModeChange('compact')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'compact' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold' 
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                  title="Compact List View"
                >
                  <AlignJustify size={16} />
                </button>
              </div>

              {/* Results Count */}
              <div className="text-xs text-gray-500 dark:text-slate-400 font-medium pl-2 border-l border-gray-200 dark:border-slate-700">
                <span className="font-bold text-gray-800 dark:text-white">{filteredAndSortedVouchers.length}</span> of {vouchers.length}
              </div>
            </div>

          </div>
        </div>

        {/* Vouchers Display (Based on selected viewMode) */}
        {filteredAndSortedVouchers.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 transition-colors">
            <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
              <Receipt size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
              {vouchers.length === 0 ? 'No vouchers created yet' : 'No matching vouchers found'}
            </h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6 max-w-md mx-auto">
              {vouchers.length === 0 
                ? 'Create your first expense voucher to start tracking receipts and expenses.' 
                : 'Try adjusting your search query, clearing filters, or unchecking favourites.'}
            </p>
            {vouchers.length === 0 ? (
              <button
                onClick={handleCreateVoucher}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md inline-flex items-center gap-2"
              >
                <Plus size={18} />
                Create Your First Voucher
              </button>
            ) : (
              <button
                onClick={() => { setSearchQuery(''); setFavouritesOnly(false); setGroupBy('none'); }}
                className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-all font-medium text-sm inline-flex items-center gap-2 border border-transparent dark:border-slate-700"
              >
                <Filter size={16} />
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedVouchers).map(([groupTitle, groupItems]) => (
              <div key={groupTitle} className="space-y-4">
                
                {/* Group Heading (if grouped) */}
                {groupBy !== 'none' && (
                  <div className="flex items-center gap-3 pb-2 border-b-2 border-gray-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                      {groupTitle}
                    </h2>
                    <span className="text-xs font-semibold bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                      {groupItems.length} {groupItems.length === 1 ? 'voucher' : 'vouchers'}
                    </span>
                  </div>
                )}

                {/* 1. GRID VIEW */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupItems.map(voucher => {
                      const code = voucher.voucherCode || formatVoucherCode(voucher.id)
                      const totalAmount = calculateExpensesTotal(voucher.expenses)
                      const itemsCount = voucher.expenses?.length || 0

                      return (
                        <div
                          key={voucher.id}
                          onClick={() => navigate(`/voucher/${voucher.voucherCode || voucher.id}`)}
                          className={`bg-white dark:bg-slate-900 rounded-xl shadow-md p-6 hover:shadow-xl transition-all cursor-pointer border relative group ${
                            voucher.isFavourite 
                              ? 'border-amber-300 dark:border-amber-600/70 ring-1 ring-amber-200 dark:ring-amber-900/30' 
                              : 'border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600'
                          }`}
                        >
                          {/* Card Top Row: Code, Star & Delete */}
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 pr-2">
                              <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-100 dark:border-slate-700 inline-block mb-1">
                                {code}
                              </span>
                              <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">
                                {voucher.formData?.expenseTitle || 'Expense Voucher'}
                              </h3>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleToggleFavourite(e, voucher.id)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  voucher.isFavourite 
                                    ? 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50' 
                                    : 'text-gray-300 dark:text-slate-600 hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                                }`}
                                title={voucher.isFavourite ? 'Remove from Favourites' : 'Mark as Favourite'}
                              >
                                <Star size={18} className={voucher.isFavourite ? 'fill-amber-500 dark:fill-amber-400' : ''} />
                              </button>

                              <button
                                onClick={(e) => handleDeleteVoucher(e, voucher.id)}
                                className="text-gray-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Voucher"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>

                          {/* Card Meta details */}
                          <div className="mb-4 space-y-1.5 text-sm text-gray-600 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                              <User size={15} className="text-gray-400 dark:text-slate-500 shrink-0" />
                              <span className="truncate">
                                {voucher.formData?.name ? (
                                  <span className="font-semibold text-gray-800 dark:text-slate-200">{voucher.formData.name}</span>
                                ) : (
                                  <span className="italic text-gray-400 dark:text-slate-500">Employee not specified</span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <MapPin size={15} className="text-gray-400 dark:text-slate-500 shrink-0" />
                              <span className="truncate">
                                {voucher.formData?.location ? (
                                  <span className="font-medium text-gray-700 dark:text-slate-300">{voucher.formData.location}</span>
                                ) : (
                                  <span className="italic text-gray-400 dark:text-slate-500">Location not specified</span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Calendar size={15} className="text-gray-400 dark:text-slate-500 shrink-0" />
                              <span className="text-xs text-gray-500 dark:text-slate-400">
                                {voucher.formData?.date
                                  ? new Date(voucher.formData.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                  : 'No date set'}
                              </span>
                            </div>
                          </div>

                          {/* Card Footer */}
                          <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex justify-between items-center text-sm">
                            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded border border-transparent dark:border-slate-700">
                              {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                            </span>
                            <span className="font-black text-blue-700 dark:text-blue-400 text-lg">
                              {totalAmount} <span className="text-xs font-bold text-gray-500 dark:text-slate-400">AED</span>
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 2. DESCRIPTIVE GRID VIEW */}
                {viewMode === 'descriptive' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {groupItems.map(voucher => {
                      const code = voucher.voucherCode || formatVoucherCode(voucher.id)
                      const totalAmount = calculateExpensesTotal(voucher.expenses)
                      const itemsCount = voucher.expenses?.length || 0
                      const receiptCount = (voucher.expenses || []).filter(e => e.receiptImage).length
                      const previewExpenses = (voucher.expenses || []).slice(0, 3)

                      return (
                        <div
                          key={voucher.id}
                          onClick={() => navigate(`/voucher/${voucher.voucherCode || voucher.id}`)}
                          className={`bg-white dark:bg-slate-900 rounded-2xl shadow-md p-6 hover:shadow-xl transition-all cursor-pointer border relative group ${
                            voucher.isFavourite 
                              ? 'border-amber-300 dark:border-amber-600/70 ring-2 ring-amber-100 dark:ring-amber-900/30' 
                              : 'border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600'
                          }`}
                        >
                          {/* Card Header */}
                          <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-100 dark:border-slate-800">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs font-black text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-blue-200 dark:border-slate-700">
                                  {code}
                                </span>
                                {receiptCount > 0 && (
                                  <span className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                    📸 {receiptCount} {receiptCount === 1 ? 'Receipt' : 'Receipts'}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                                {voucher.formData?.expenseTitle || 'General Expense Voucher'}
                              </h3>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleToggleFavourite(e, voucher.id)}
                                className={`p-2 rounded-lg transition-colors ${
                                  voucher.isFavourite 
                                    ? 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50' 
                                    : 'text-gray-300 dark:text-slate-600 hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <Star size={20} className={voucher.isFavourite ? 'fill-amber-500 dark:fill-amber-400' : ''} />
                              </button>

                              <button
                                onClick={(e) => handleDeleteVoucher(e, voucher.id)}
                                className="text-gray-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </div>

                          {/* Employee & Location Info Row */}
                          <div className="grid grid-cols-2 gap-3 mb-4 bg-gray-50 dark:bg-slate-800/70 p-3 rounded-xl text-xs border border-transparent dark:border-slate-700/50">
                            <div>
                              <span className="text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Employee</span>
                              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm block truncate">
                                {voucher.formData?.name || 'Not specified'}
                              </span>
                              <span className="text-gray-500 dark:text-slate-400 text-[11px] block truncate">
                                {voucher.formData?.title || 'No position'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Location & Date</span>
                              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm block truncate">
                                {voucher.formData?.location || 'Not specified'}
                              </span>
                              <span className="text-gray-500 dark:text-slate-400 text-[11px] block">
                                {voucher.formData?.date ? new Date(voucher.formData.date).toLocaleDateString() : 'No date'}
                              </span>
                            </div>
                          </div>

                          {/* Expense Breakdown Preview */}
                          <div className="mb-4">
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                              Expense Breakdown ({itemsCount} items)
                            </span>
                            {itemsCount === 0 ? (
                              <p className="text-xs text-gray-400 dark:text-slate-500 italic py-2">No expense line items added yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {previewExpenses.map((exp, idx) => (
                                  <div key={exp.id || idx} className="flex justify-between items-center text-xs py-1 px-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <span className="truncate pr-2 text-gray-700 dark:text-slate-200 font-medium">
                                      {exp.description || `Item #${exp.receiptNo || idx + 1}`}
                                    </span>
                                    <span className="font-bold text-gray-900 dark:text-white shrink-0 font-mono">
                                      {exp.amountAED || exp.amount || '0.00'} AED
                                    </span>
                                  </div>
                                ))}
                                {itemsCount > 3 && (
                                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold text-right pt-0.5">
                                    + {itemsCount - 3} more items...
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Card Bottom: Total & Open Action */}
                          <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex justify-between items-center">
                            <div>
                              <span className="text-[11px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Total Amount</span>
                              <span className="text-2xl font-black text-blue-700 dark:text-blue-400">
                                {totalAmount} <span className="text-xs font-bold text-gray-500 dark:text-slate-400">AED</span>
                              </span>
                            </div>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 bg-blue-50 dark:bg-blue-950/50 px-3 py-1.5 rounded-lg border border-transparent dark:border-blue-900">
                              Open Voucher <ArrowRight size={14} />
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 3. DETAILED TABLE VIEW */}
                {viewMode === 'detailed' && (
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 text-center w-10">⭐</th>
                            <th className="px-4 py-3">Voucher Code</th>
                            <th className="px-4 py-3">Expense Title</th>
                            <th className="px-4 py-3">Employee</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3 text-center">Items</th>
                            <th className="px-4 py-3 text-right">Total (AED)</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                          {groupItems.map(voucher => {
                            const code = voucher.voucherCode || formatVoucherCode(voucher.id)
                            const totalAmount = calculateExpensesTotal(voucher.expenses)
                            const itemsCount = voucher.expenses?.length || 0

                            return (
                              <tr 
                                key={voucher.id}
                                onClick={() => navigate(`/voucher/${voucher.voucherCode || voucher.id}`)}
                                className={`hover:bg-blue-50/50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                                  voucher.isFavourite ? 'bg-amber-50/20 dark:bg-amber-950/20' : ''
                                }`}
                              >
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={(e) => handleToggleFavourite(e, voucher.id)}
                                    className="text-gray-300 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400 p-1"
                                  >
                                    <Star size={16} className={voucher.isFavourite ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : ''} />
                                  </button>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-blue-700 dark:text-blue-400 text-xs whitespace-nowrap">
                                  {code}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white max-w-[200px] truncate">
                                  {voucher.formData?.expenseTitle || 'Expense Voucher'}
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-slate-200 whitespace-nowrap">
                                  <span className="font-medium block">{voucher.formData?.name || '—'}</span>
                                  <span className="text-xs text-gray-400 dark:text-slate-500 block">{voucher.formData?.title || ''}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap">
                                  {voucher.formData?.location || '—'}
                                </td>
                                <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                  {voucher.formData?.date ? new Date(voucher.formData.date).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                  <span className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs font-semibold border border-transparent dark:border-slate-700">
                                    {itemsCount}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-black text-blue-700 dark:text-blue-400 whitespace-nowrap">
                                  {totalAmount} AED
                                </td>
                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => navigate(`/voucher/${voucher.voucherCode || voucher.id}`)}
                                      className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded text-xs font-semibold transition-colors"
                                    >
                                      Open
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteVoucher(e, voucher.id)}
                                      className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. COMPACT LIST VIEW */}
                {viewMode === 'compact' && (
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden transition-colors">
                    {groupItems.map(voucher => {
                      const code = voucher.voucherCode || formatVoucherCode(voucher.id)
                      const totalAmount = calculateExpensesTotal(voucher.expenses)
                      const itemsCount = voucher.expenses?.length || 0

                      return (
                        <div
                          key={voucher.id}
                          onClick={() => navigate(`/voucher/${voucher.voucherCode || voucher.id}`)}
                          className="flex items-center justify-between p-3 hover:bg-blue-50/50 dark:hover:bg-slate-800/60 cursor-pointer transition-all gap-4 text-sm"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                              onClick={(e) => handleToggleFavourite(e, voucher.id)}
                              className="text-gray-300 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400 shrink-0"
                            >
                              <Star size={16} className={voucher.isFavourite ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : ''} />
                            </button>
                            <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-100 dark:border-slate-700 shrink-0">
                              {code}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white truncate">
                              {voucher.formData?.expenseTitle || 'Expense Voucher'}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-slate-500 hidden md:inline truncate">
                              • {voucher.formData?.name || 'No employee'} ({voucher.formData?.location || 'No location'})
                            </span>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-xs text-gray-500 dark:text-slate-400 hidden sm:inline">
                              {itemsCount} items
                            </span>
                            <span className="font-bold text-blue-700 dark:text-blue-400 text-sm">
                              {totalAmount} AED
                            </span>
                            <button
                              onClick={(e) => handleDeleteVoucher(e, voucher.id)}
                              className="text-gray-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 p-1 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}

        {/* Authentication Modal */}
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
        />

      </div>
    </div>
  )
}
