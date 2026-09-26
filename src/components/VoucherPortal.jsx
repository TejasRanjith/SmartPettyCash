import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Receipt } from 'lucide-react'

const VOUCHERS_KEY = 'smart-petty-cash-vouchers'
const LEGACY_SAVE_KEY = 'smart-petty-cash-data'

export default function VoucherPortal() {
  const navigate = useNavigate()
  const [vouchers, setVouchers] = useState([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VOUCHERS_KEY)
      if (saved) {
        setVouchers(JSON.parse(saved))
      } else {
        // Check for legacy single-voucher session and migrate if exists
        const legacy = localStorage.getItem(LEGACY_SAVE_KEY)
        if (legacy) {
          const parsedLegacy = JSON.parse(legacy)
          if (parsedLegacy.formData || parsedLegacy.expenses?.length > 0) {
            const initialVoucher = {
              id: Date.now(),
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

  const handleCreateVoucher = () => {
    try {
      const newVoucher = {
        id: Date.now(),
        formData: {
          name: '',
          date: new Date().toISOString().split('T')[0],
          location: '',
          title: '',
          expenseTitle: ''
        },
        expenses: []
      }
      const updated = [...vouchers, newVoucher]
      localStorage.setItem(VOUCHERS_KEY, JSON.stringify(updated))
      setVouchers(updated)
      navigate(`/voucher/${newVoucher.id}`)
    } catch (e) {
      console.error('Failed to create voucher:', e)
    }
  }

  const handleDeleteVoucher = (e, voucherId) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this voucher?')) {
      const updated = vouchers.filter(v => v.id !== voucherId)
      localStorage.setItem(VOUCHERS_KEY, JSON.stringify(updated))
      setVouchers(updated)
    }
  }

  const calculateVoucherTotal = (expenses = []) => {
    return expenses
      .reduce((sum, exp) => sum + (parseFloat(exp.amountAED) || 0), 0)
      .toFixed(2)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 md:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl shadow-lg p-8 text-center text-white">
          <img
            src="/image.png"
            alt="Company Logo"
            className="mx-auto object-contain mb-4"
            style={{ width: '384px', maxHeight: '288px' }}
          />
          <h2 className="text-3xl md:text-4xl font-bold mt-2">Petty Cash Portal</h2>
          <p className="text-blue-100 mt-2">Manage and track your business expenses efficiently</p>
        </div>

        {/* Action Title Bar */}
        <div className="flex justify-between items-center pb-2">
          <h1 className="text-3xl font-bold text-gray-900">Petty Cash Vouchers</h1>
          <button
            onClick={handleCreateVoucher}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md"
          >
            <Plus size={20} />
            New Voucher
          </button>
        </div>

        {/* Vouchers Grid / Empty State */}
        {vouchers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Receipt size={32} />
            </div>
            <p className="text-gray-500 text-lg mb-6">No vouchers created yet</p>
            <button
              onClick={handleCreateVoucher}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Create Your First Voucher
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vouchers.map(voucher => (
              <div
                key={voucher.id}
                onClick={() => navigate(`/voucher/${voucher.id}`)}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all cursor-pointer border border-gray-200 relative group hover:border-blue-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Voucher #{voucher.id}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {voucher.formData?.expenseTitle || 'General Expenses'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                      {voucher.formData?.date
                        ? new Date(voucher.formData.date).toLocaleDateString()
                        : 'No date'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteVoucher(e, voucher.id)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete Voucher"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="mb-4 space-y-1 text-sm">
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-700">Employee:</span>{' '}
                    {voucher.formData?.name || 'Not specified'}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-700">Location:</span>{' '}
                    {voucher.formData?.location || 'Not specified'}
                  </p>
                </div>

                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-sm">
                  <p className="font-semibold text-gray-600">
                    Expense Items: <span className="text-gray-900">{voucher.expenses?.length || 0}</span>
                  </p>
                  <p className="font-bold text-blue-600 text-base">
                    {calculateVoucherTotal(voucher.expenses)} AED
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
