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
  CheckCircle2
} from 'lucide-react'
import { formatVoucherCode, calculateExpensesTotal } from '../utils/voucherUtils'

const VOUCHERS_KEY = 'smart-petty-cash-vouchers'
const LEGACY_SAVE_KEY = 'smart-petty-cash-data'

export default function VoucherPortal() {
  const navigate = useNavigate()
  const [vouchers, setVouchers] = useState([])
  
  // Search, Filter, Sort, and Group states
  const [searchQuery, setSearchQuery] = useState('')
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState('date-desc')
  const [groupBy, setGroupBy] = useState('none') // 'none' | 'location' | 'month' | 'employee'

  // Load vouchers & migrate legacy data
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VOUCHERS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Ensure every voucher has a standardized voucherCode and isFavourite flag
        const normalized = parsed.map(v => ({
          ...v,
          voucherCode: v.voucherCode || formatVoucherCode(v.id || v.formData?.date || Date.now()),
          isFavourite: !!v.isFavourite
        }))
        setVouchers(normalized)
      } else {
        // Check for legacy single-voucher session and migrate
        const legacy = localStorage.getItem(LEGACY_SAVE_KEY)
        if (legacy) {
          const parsedLegacy = JSON.parse(legacy)
          if (parsedLegacy.formData || parsedLegacy.expenses?.length > 0) {
            const timestamp = Date.now()
            const initialVoucher = {
              id: timestamp,
              voucherCode: formatVoucherCode(timestamp),
              isFavourite: false,
              formData: parsedLegacy.formData || {
                name: '',
                date: new Date().toISOString().split('T')[0],
                location: '',
                title: '',
                expenseTitle: ''
              },
              expenses: parsedLegacy.expenses || []
            }
            const initialList = [initialVoucher]
            localStorage.setItem(VOUCHERS_KEY, JSON.stringify(initialList))
            setVouchers(initialList)
          }
        }
      }
    } catch (e) {
      console.error('Failed to load vouchers:', e)
    }
  }, [])

  // Create new voucher with standardized naming convention
  const handleCreateVoucher = () => {
    try {
      const timestamp = Date.now()
      const voucherCode = formatVoucherCode(timestamp)
      const newVoucher = {
        id: timestamp,
        voucherCode: voucherCode,
        isFavourite: false,
        formData: {
          name: '',
          date: new Date().toISOString().split('T')[0],
          location: '',
          title: '',
          expenseTitle: ''
        },
        expenses: []
      }
      const updated = [newVoucher, ...vouchers]
      localStorage.setItem(VOUCHERS_KEY, JSON.stringify(updated))
      setVouchers(updated)
      navigate(`/voucher/${newVoucher.id}`)
    } catch (e) {
      console.error('Failed to create voucher:', e)
    }
  }

  // Toggle Favourite Status
  const handleToggleFavourite = (e, voucherId) => {
    e.stopPropagation()
    const updated = vouchers.map(v => 
      v.id === voucherId ? { ...v, isFavourite: !v.isFavourite } : v
    )
    localStorage.setItem(VOUCHERS_KEY, JSON.stringify(updated))
    setVouchers(updated)
  }

  // Delete Voucher
  const handleDeleteVoucher = (e, voucherId) => {
    e.stopPropagation()
    const target = vouchers.find(v => v.id === voucherId)
    const codeName = target?.voucherCode || `Voucher #${voucherId}`
    if (window.confirm(`Are you sure you want to delete ${codeName}?`)) {
      const updated = vouchers.filter(v => v.id !== voucherId)
      localStorage.setItem(VOUCHERS_KEY, JSON.stringify(updated))
      setVouchers(updated)
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
        return code.includes(q) || name.includes(q) || location.includes(q) || title.includes(q) || expTitle.includes(q)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 md:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto space-y-6">
        
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
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Receipt size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Vouchers</p>
              <p className="text-2xl font-black text-gray-900">{stats.totalCount}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Amount</p>
              <p className="text-2xl font-black text-green-600">{stats.totalAmount} <span className="text-xs font-semibold text-gray-400">AED</span></p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-500 rounded-lg">
              <Star size={24} className="fill-amber-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Favourites</p>
              <p className="text-2xl font-black text-amber-500">{stats.favouritesCount}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <MapPin size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Locations</p>
              <p className="text-2xl font-black text-purple-600">{stats.uniqueLocations}</p>
            </div>
          </div>
        </div>

        {/* Controls Toolbar: Search, Sort, Group, Favourites, New Voucher */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code (e.g. exp_voucher_...), employee, location, or title..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* New Voucher Primary Button */}
            <button
              onClick={handleCreateVoucher}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all font-semibold shadow-md shrink-0"
            >
              <Plus size={20} />
              New Voucher
            </button>
          </div>

          {/* Filter, Sort & Group Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-sm">
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Favourites Only Toggle */}
              <button
                onClick={() => setFavouritesOnly(!favouritesOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  favouritesOnly 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-sm' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Star size={16} className={favouritesOnly ? 'fill-amber-500 text-amber-500' : 'text-gray-400'} />
                Favourites Only
              </button>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                <ArrowUpDown size={15} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="date-desc">Date (Newest First)</option>
                  <option value="date-asc">Date (Oldest First)</option>
                  <option value="amount-desc">Amount (Highest First)</option>
                  <option value="amount-asc">Amount (Lowest First)</option>
                  <option value="items-desc">Item Count (Most First)</option>
                  <option value="items-asc">Item Count (Fewest First)</option>
                  <option value="name-asc">Code/Name (A–Z)</option>
                  <option value="name-desc">Code/Name (Z–A)</option>
                </select>
              </div>

              {/* Group By Dropdown */}
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                <Layers size={15} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Group:</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="none">None (Flat Grid)</option>
                  <option value="location">By Location</option>
                  <option value="month">By Month</option>
                  <option value="employee">By Employee</option>
                </select>
              </div>
            </div>

            {/* Results Count */}
            <div className="text-xs text-gray-500 font-medium">
              Showing <span className="font-bold text-gray-800">{filteredAndSortedVouchers.length}</span> of {vouchers.length} vouchers
            </div>
          </div>
        </div>

        {/* Vouchers List / Grouped Display */}
        {filteredAndSortedVouchers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Receipt size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {vouchers.length === 0 ? 'No vouchers created yet' : 'No matching vouchers found'}
            </h3>
            <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
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
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-all font-medium text-sm inline-flex items-center gap-2"
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
                  <div className="flex items-center gap-3 pb-2 border-b-2 border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
                      {groupTitle}
                    </h2>
                    <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                      {groupItems.length} {groupItems.length === 1 ? 'voucher' : 'vouchers'}
                    </span>
                  </div>
                )}

                {/* Vouchers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupItems.map(voucher => {
                    const code = voucher.voucherCode || formatVoucherCode(voucher.id)
                    const totalAmount = calculateExpensesTotal(voucher.expenses)
                    const itemsCount = voucher.expenses?.length || 0

                    return (
                      <div
                        key={voucher.id}
                        onClick={() => navigate(`/voucher/${voucher.id}`)}
                        className={`bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all cursor-pointer border relative group ${
                          voucher.isFavourite ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        {/* Card Top Row: Code, Star & Delete */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 pr-2">
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block mb-1">
                              {code}
                            </span>
                            <h3 className="text-base font-bold text-gray-900 line-clamp-1">
                              {voucher.formData?.expenseTitle || 'Expense Voucher'}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Star Favourite Button */}
                            <button
                              onClick={(e) => handleToggleFavourite(e, voucher.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                voucher.isFavourite 
                                  ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' 
                                  : 'text-gray-300 hover:text-amber-400 hover:bg-gray-100'
                              }`}
                              title={voucher.isFavourite ? 'Remove from Favourites' : 'Mark as Favourite'}
                            >
                              <Star size={18} className={voucher.isFavourite ? 'fill-amber-500' : ''} />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={(e) => handleDeleteVoucher(e, voucher.id)}
                              className="text-gray-300 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Voucher"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Card Meta details */}
                        <div className="mb-4 space-y-1.5 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <User size={15} className="text-gray-400 shrink-0" />
                            <span className="truncate">
                              {voucher.formData?.name ? (
                                <span className="font-semibold text-gray-800">{voucher.formData.name}</span>
                              ) : (
                                <span className="italic text-gray-400">Employee not specified</span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <MapPin size={15} className="text-gray-400 shrink-0" />
                            <span className="truncate">
                              {voucher.formData?.location ? (
                                <span className="font-medium text-gray-700">{voucher.formData.location}</span>
                              ) : (
                                <span className="italic text-gray-400">Location not specified</span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Calendar size={15} className="text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-500">
                              {voucher.formData?.date
                                ? new Date(voucher.formData.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                : 'No date set'}
                            </span>
                          </div>
                        </div>

                        {/* Card Footer: Items & Total AED */}
                        <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-sm">
                          <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded">
                            {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                          </span>
                          <span className="font-black text-blue-700 text-lg">
                            {totalAmount} <span className="text-xs font-bold text-gray-500">AED</span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
