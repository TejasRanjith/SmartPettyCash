import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Download, Send, ScanLine, Home } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import ExpenseForm from './ExpenseForm'
import ExpenseTable from './ExpenseTable'
import Header from './Header'
import Toast from './Toast'
import ReceiptScanner from './ReceiptScanner'
import { formatVoucherCode } from '../utils/voucherUtils'

const VOUCHERS_KEY = 'smart-petty-cash-vouchers'

const loadVoucherFromStorage = (id) => {
  try {
    const saved = localStorage.getItem(VOUCHERS_KEY)
    if (saved) {
      const vouchers = JSON.parse(saved)
      const found = vouchers.find(v => v.id === parseInt(id))
      if (found) return found
    }
  } catch (e) {
    console.error('Failed to load voucher:', e)
  }
  return null
}

export default function VoucherDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const getVoucher = useCallback(() => {
    if (id) {
      return loadVoucherFromStorage(id)
    }
    return null
  }, [id])

  const [formData, setFormData] = useState(() => {
    const voucher = getVoucher()
    return voucher?.formData || {
      name: '',
      date: new Date().toISOString().split('T')[0],
      location: '',
      title: '',
      expenseTitle: ''
    }
  })

  const [expenses, setExpenses] = useState(() => {
    const voucher = getVoucher()
    return voucher?.expenses || []
  })

  const [toast, setToast] = useState(null)
  const [viewMode, setViewMode] = useState('form')
  const [isExporting, setIsExporting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // Reload state if ID changes
  useEffect(() => {
    const voucher = getVoucher()
    if (voucher) {
      setFormData(voucher.formData || {
        name: '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        title: '',
        expenseTitle: ''
      })
      setExpenses(voucher.expenses || [])
    }
  }, [id, getVoucher])

  // Persist voucher changes to localStorage
  useEffect(() => {
    if (!id) return
    try {
      const saved = localStorage.getItem(VOUCHERS_KEY)
      const vouchers = saved ? JSON.parse(saved) : []
      const exists = vouchers.some(v => v.id === parseInt(id))
      
      let updatedVouchers
      if (exists) {
        updatedVouchers = vouchers.map(v => 
          v.id === parseInt(id) ? { ...v, formData, expenses } : v
        )
      } else {
        updatedVouchers = [...vouchers, { id: parseInt(id), formData, expenses }]
      }

      localStorage.setItem(VOUCHERS_KEY, JSON.stringify(updatedVouchers))
      console.log(`💾 Voucher #${id} autosaved to LocalStorage`)
    } catch (e) {
      console.error('Failed to persist voucher:', e)
    }
  }, [formData, expenses, id])

  // Dynamic preview scale to fit the 1200px-wide document on any screen
  const [previewScale, setPreviewScale] = useState(1)

  useEffect(() => {
    const calculateScale = () => {
      const viewportWidth = window.innerWidth
      const padding = 32 // 16px on each side
      const availableWidth = viewportWidth - padding
      const scale = Math.min(1, Math.max(0.25, availableWidth / 1200))
      setPreviewScale(scale)
    }

    calculateScale()
    window.addEventListener('resize', calculateScale)
    return () => window.removeEventListener('resize', calculateScale)
  }, [])

  const exportRef = useRef(null)
  const measureRef = useRef(null)
  const [pages, setPages] = useState([{ pageNumber: 1, expenses: [], showTotals: true }])

  useEffect(() => {
    const container = measureRef.current
    if (!container) return

    const headerP1El = document.getElementById('measure-header-p1')
    const infoP1El = document.getElementById('measure-info-p1')
    const tableHeaderEl = document.getElementById('measure-table-header')
    const totalsEl = document.getElementById('measure-totals')
    const subHeaderEl = document.getElementById('measure-header-sub')

    const page1Overhead = 
      (headerP1El?.getBoundingClientRect().height || 0) +
      (infoP1El?.getBoundingClientRect().height || 0) +
      (tableHeaderEl?.getBoundingClientRect().height || 0) +
      40; // Spacing/margins

    const subsequentPageOverhead = 
      (subHeaderEl?.getBoundingClientRect().height || 0) +
      (tableHeaderEl?.getBoundingClientRect().height || 0) +
      40; // Spacing/margins

    const totalsHeight = (totalsEl?.getBoundingClientRect().height || 0) + 40;

    // Measure each row
    const rowHeights = {}
    expenses.forEach(exp => {
      const rowEl = document.getElementById(`measure-row-${exp.id}`)
      if (rowEl) {
        rowHeights[exp.id] = rowEl.getBoundingClientRect().height
      } else {
        rowHeights[exp.id] = 60; // Fallback height
      }
    })

    // Run partition algorithm
    const computedPages = []
    const maxContentHeight = 1700 - 120 - 60 // 1520px (total page height - padding - footer)
    
    let currentPageNum = 1
    let currentUsedHeight = page1Overhead
    let currentPageExpenses = []

    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i]
      const rowHeight = rowHeights[exp.id] || 60
      const isLastExpense = i === expenses.length - 1

      let neededHeight = currentUsedHeight + rowHeight

      if (isLastExpense) {
        neededHeight += totalsHeight
      }

      if (neededHeight <= maxContentHeight) {
        currentPageExpenses.push(exp)
        currentUsedHeight += rowHeight
      } else {
        computedPages.push({
          pageNumber: currentPageNum,
          expenses: currentPageExpenses,
          showTotals: false
        })

        currentPageNum++
        currentPageExpenses = [exp]
        currentUsedHeight = subsequentPageOverhead + rowHeight

        if (isLastExpense) {
          currentUsedHeight += totalsHeight
        }
      }
    }

    if (currentPageExpenses.length > 0) {
      computedPages.push({
        pageNumber: currentPageNum,
        expenses: currentPageExpenses,
        showTotals: true
      })
    }

    if (computedPages.length === 0) {
      computedPages.push({
        pageNumber: 1,
        expenses: [],
        showTotals: true
      })
    }

    setPages(computedPages)
  }, [expenses, formData.name, formData.date, formData.location, formData.title, formData.expenseTitle])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    // Enforce text-only constraint for name, location, and title/designation
    let cleanValue = value
    if (name === 'name' || name === 'title' || name === 'location') {
      cleanValue = value.replace(/[0-9]/g, '')
    }
    setFormData(prev => ({ ...prev, [name]: cleanValue }))
  }

  const handleAddExpense = () => {
    const newExpense = {
      id: Date.now(),
      date: '',
      receiptNo: expenses.length + 1,
      description: '',
      amount: '',
      currency: 'AED',
      amountAED: ''
    }
    setExpenses([...expenses, newExpense])
  }

  const handleDeleteExpense = (id) => {
    setExpenses(expenses.filter(expense => expense.id !== id))
  }

  // Conversion rates to AED
  const conversionRates = {
    AED: 1,
    USD: 3.67,
    EUR: 4.02,
    GBP: 4.68
  }

  const handleScanComplete = useCallback((scannedData) => {
    // Check if duplicate scanned receipt exists
    const scanAmount = scannedData.amount ? parseFloat(scannedData.amount).toFixed(2) : '';
    const isDuplicate = expenses.some(exp => {
      const expAmount = exp.amount ? parseFloat(exp.amount).toFixed(2) : '';
      return (
        exp.date === (scannedData.date || '') &&
        expAmount === scanAmount &&
        exp.currency === (scannedData.currency || 'AED')
      );
    });

    if (isDuplicate) {
      showToast({
        message: `Duplicate receipt detected! An expense for ${scannedData.amount || '0.00'} ${scannedData.currency || 'AED'} on ${scannedData.date || 'unknown date'} is already in the list.`,
        type: 'error'
      });
      return;
    }

    // Create a new expense entry with scanned data
    const newExpense = {
      id: Date.now(),
      date: scannedData.date || '',
      receiptNo: expenses.length + 1,
      description: scannedData.description || '',
      amount: scannedData.amount || '',
      currency: scannedData.currency || 'AED',
      amountAED: '',
      receiptImage: scannedData.receiptImage || ''
    };

    // Auto-calculate AED amount if we have amount + currency
    if (newExpense.amount && newExpense.currency) {
      const rate = conversionRates[newExpense.currency] || 1;
      newExpense.amountAED = (parseFloat(newExpense.amount) * rate).toFixed(2);
    }

    setExpenses(prev => [...prev, newExpense]);
    showToast({ message: 'Receipt scanned! Expense entry added.', type: 'success' });
  }, [expenses, conversionRates]);

  const handleExpenseChange = (id, field, value) => {
    setExpenses(expenses.map(expense => {
      if (expense.id !== id) return expense

      const updated = { ...expense, [field]: value }

      // Auto-calculate amountAED when amount or currency changes
      if (field === 'amount' || field === 'currency') {
        const amount = parseFloat(field === 'amount' ? value : expense.amount) || 0
        const currency = field === 'currency' ? value : expense.currency
        const rate = conversionRates[currency] || 1
        updated.amountAED = amount > 0 ? (amount * rate).toFixed(2) : ''
      }

      return updated
    }))
  }

  const calculateTotal = () => {
    return expenses.reduce((sum, expense) => {
      const amount = parseFloat(expense.amountAED) || 0
      return sum + amount
    }, 0).toFixed(2)
  }

  const showToast = (toastData) => {
    setToast(toastData)
  }

  const validateForm = () => {
    // Check all form fields are filled
    if (!formData.name.trim()) {
      showToast({ message: 'Please enter the employee name', type: 'error' })
      return false
    }
    if (!formData.date) {
      showToast({ message: 'Please select a date', type: 'error' })
      return false
    }
    if (!formData.location.trim()) {
      showToast({ message: 'Please enter the location', type: 'error' })
      return false
    }
    if (!formData.title.trim()) {
      showToast({ message: 'Please enter the title/position', type: 'error' })
      return false
    }
    if (!formData.expenseTitle.trim()) {
      showToast({ message: 'Please enter the expense title', type: 'error' })
      return false
    }

    // Check that text fields do not contain numbers or digits
    if (/\d/.test(formData.name)) {
      showToast({ message: 'Employee Name cannot contain numbers or digits', type: 'error' })
      return false
    }
    if (/\d/.test(formData.location)) {
      showToast({ message: 'Location cannot contain numbers or digits', type: 'error' })
      return false
    }
    if (/\d/.test(formData.title)) {
      showToast({ message: 'Title / Position cannot contain numbers or digits', type: 'error' })
      return false
    }

    // Check at least 1 expense row exists
    if (expenses.length === 0) {
      showToast({ message: 'Please add at least one expense entry', type: 'error' })
      return false
    }

    // Check all expense rows are filled
    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i]
      if (!exp.date || !exp.description.trim() || !exp.amount || !exp.amountAED) {
        showToast({ message: `Expense row #${i + 1} has empty fields. Please fill all columns.`, type: 'error' })
        return false
      }
    }

    // Check for duplicate expense rows
    const seen = new Set();
    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      const amountStr = exp.amount ? parseFloat(exp.amount).toFixed(2) : '';
      const key = `${exp.date}|${exp.description.toLowerCase().trim()}|${amountStr}|${exp.currency}`;
      if (seen.has(key)) {
        showToast({
          message: `Duplicate expense rows detected! Row #${i + 1} is identical to an earlier entry (Date: ${exp.date}, Amount: ${exp.amount} ${exp.currency}). Please make entries unique or delete duplicates.`,
          type: 'error'
        });
        return false;
      }
      seen.add(key);
    }

    return true
  }

  const handleSubmit = () => {
    if (validateForm()) {
      showToast({ message: 'Expense form submitted successfully!', type: 'success' })
    }
  }

  const handleExport = async () => {
    if (!validateForm()) return

    setIsExporting(true)
    showToast({ message: 'Generating perfect multi-page PDF...', type: 'success' })

    await new Promise(resolve => setTimeout(resolve, 300))

    try {
      const exportContainer = exportRef.current
      if (!exportContainer) {
        showToast({ message: 'Could not generate PDF. Please try again.', type: 'error' })
        setIsExporting(false)
        return
      }

      const pageElements = exportContainer.querySelectorAll('[data-pdf-page]')
      if (pageElements.length === 0) {
        showToast({ message: 'Could not locate pages for export.', type: 'error' })
        setIsExporting(false)
        return
      }

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < pageElements.length; i++) {
        const element = pageElements[i]
        
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        })
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0)
        
        if (i > 0) {
          pdf.addPage()
        }
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
      }

      const pdfFileName = `${formatVoucherCode(new Date())}.pdf`;
      pdf.save(pdfFileName);
      showToast({ message: `Exported ${pdfFileName} successfully!`, type: 'success' });
    } catch (error) {
      console.error('PDF generation failed:', error);
      showToast({ message: 'Failed to generate PDF. Please try again.', type: 'error' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 md:px-8 lg:px-12">
      {/* Hidden offscreen measuring block */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: '0', pointerEvents: 'none', display: 'block' }}>
        <div ref={measureRef} style={{ width: '1200px', padding: '60px 80px', boxSizing: 'border-box', background: '#ffffff' }}>
          {/* Page 1 Header */}
          <div id="measure-header-p1" className="mb-8 text-center border-b-2 border-gray-300 pb-6">
            <img src="/image.png" alt="Company Logo" className="mx-auto object-contain mb-4" style={{ width: '480px', maxHeight: '288px' }} />
            <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 mt-4">Expense Reimbursement</h2>
          </div>

          {/* Form Header Info */}
          <div id="measure-info-p1" className="mb-8 bg-gray-50 p-6 rounded-xl border-l-4 border-blue-600">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Name</label>
                  <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.name}</p>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Location</label>
                  <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.location}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Date</label>
                  <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.date}</p>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Title</label>
                  <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.title}</p>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Expense Title</label>
              <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.expenseTitle}</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr id="measure-table-header" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <th className="border-2 border-gray-300 px-4 py-4 text-left font-black text-lg md:text-xl" style={{ width: '18%' }}>Date</th>
                  <th className="border-2 border-gray-300 px-4 py-4 text-left font-black text-lg md:text-xl" style={{ width: '15%' }}>Receipt No</th>
                  <th className="border-2 border-gray-300 px-4 py-4 text-left font-black text-lg md:text-xl" style={{ width: '33%' }}>Description</th>
                  <th className="border-2 border-gray-300 px-4 py-4 text-center font-black text-lg md:text-xl" style={{ width: '12%' }}>Amount</th>
                  <th className="border-2 border-gray-300 px-4 py-4 text-center font-black text-lg md:text-xl" style={{ width: '10%' }}>Currency</th>
                  <th className="border-2 border-gray-300 px-4 py-4 text-right font-black text-lg md:text-xl" style={{ width: '12%' }}>Amount AED</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense, index) => (
                  <tr key={expense.id} id={`measure-row-${expense.id}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-bold text-gray-900">{expense.date}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-black text-gray-900">{expense.receiptNo}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-bold text-gray-900" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{expense.description}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-bold text-center text-gray-900">{expense.amount}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-black text-center text-gray-900">{expense.currency}</td>
                    <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-black text-right text-blue-700">{expense.amountAED}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div id="measure-totals" className="flex flex-col sm:flex-row justify-between items-end gap-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-2xl border-2 border-blue-200 mt-6">
            <div className="text-right w-full sm:w-auto shrink-0">
              <p className="text-xs font-bold mb-2 tracking-widest text-gray-500 uppercase">TOTAL</p>
              <p className="text-4xl md:text-5xl font-black text-blue-700 tracking-tight">{calculateTotal()}</p>
              <p className="text-xs font-bold mt-2 tracking-widest">AED</p>
            </div>
          </div>

          {/* Subsequent Header */}
          <div id="measure-header-sub" className="mb-8 flex justify-between items-center border-b-2 border-gray-200 pb-4">
            <span className="text-2xl font-black tracking-widest text-blue-950">MANLIFT</span>
            <span className="text-lg text-gray-500 font-extrabold uppercase">Expense Reimbursement</span>
          </div>
        </div>
      </div>

      {/* Hidden offscreen export block */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: '1', display: 'block' }}>
        <div ref={exportRef} style={{ width: '1200px' }}>
          <PDFDocument formData={formData} expenses={expenses} total={calculateTotal()} pages={pages} isExport={true} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Control Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all flex items-center gap-2 font-medium shadow-sm text-sm"
            >
              <Home size={16} />
              Home
            </button>
            <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>
            <button
              onClick={() => setViewMode('form')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                viewMode === 'form'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Preview
            </button>
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded border border-blue-200 ml-1">
              {formatVoucherCode(id || Date.now())}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 font-medium shadow-lg"
            >
              <Send size={18} />
              Submit
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-medium ${
                isExporting
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Download size={18} />
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Form View */}
        {viewMode === 'form' && (
          <div className="space-y-6 animate-fade-in">
            <Header />

            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Expense Details</h2>
              <ExpenseForm formData={formData} onFormChange={handleFormChange} />
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Expenses</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowScanner(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all font-medium"
                  >
                    <ScanLine size={20} />
                    Scan Receipt
                  </button>
                  <button
                    onClick={handleAddExpense}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
                  >
                    <Plus size={20} />
                    Add Expense
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <ExpenseTable
                  expenses={expenses}
                  onExpenseChange={handleExpenseChange}
                  onDeleteExpense={handleDeleteExpense}
                />
              </div>

              <div className="mt-6 pt-6 border-t-2 border-gray-200">
                <div className="flex justify-between items-end">
                  <div className="flex-1" />
                  <div className="text-right ml-4">
                    <p className="text-gray-600 font-medium mb-2">TOTAL</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {calculateTotal()} AED
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview View */}
        {viewMode === 'preview' && (
          <div className="animate-fade-in flex flex-col items-center overflow-x-hidden w-full">
            <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 px-6 py-3 rounded-lg text-sm font-semibold w-full text-center">
              📄 Document preview is formatted into separate page sheets. What you see is exactly what is exported in the PDF!
            </div>
            
            <div
              className="origin-top transition-all duration-300"
              style={{ transform: `scale(${previewScale})` }}
            >
              <PDFDocument formData={formData} expenses={expenses} total={calculateTotal()} pages={pages} />
            </div>
          </div>
        )}
      </div>

      {/* Receipt Scanner Modal */}
      {showScanner && (
        <ReceiptScanner
          onScanComplete={handleScanComplete}
          onClose={() => setShowScanner(false)}
        />
      )}

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

function PDFDocument({ formData, expenses, total, pages, isExport = false }) {
  if (!pages || pages.length === 0) return null;

  const receiptExpenses = expenses.filter(exp => exp.receiptImage);
  const totalPages = pages.length + receiptExpenses.length;

  return (
    <div className={`flex flex-col gap-8 ${isExport ? '' : 'items-center bg-slate-200 py-8 rounded-3xl'}`}>
      {pages.map((page, index) => (
        <div
          key={index}
          data-pdf-page="true"
          className="bg-white shadow-2xl relative"
          style={{
            width: '1200px',
            height: '1700px',
            minHeight: '1700px',
            padding: '60px 80px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box'
          }}
        >
          {/* Top Section */}
          <div>
            {/* Header (Logo + Title) */}
            {page.pageNumber === 1 ? (
              <div className="mb-8 text-center border-b-2 border-gray-300 pb-6">
                <img src="/image.png" alt="Company Logo" className="mx-auto object-contain mb-4" style={{ width: '480px', maxHeight: '288px' }} />
                <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 mt-4">Expense Reimbursement</h2>
              </div>
            ) : (
              <div className="mb-8 flex justify-between items-center border-b-2 border-gray-200 pb-4">
                <span className="text-2xl font-black tracking-widest text-blue-950">MANLIFT</span>
                <span className="text-lg text-gray-500 font-extrabold uppercase">Expense Reimbursement</span>
              </div>
            )}

            {/* Form Header Info (only on Page 1) */}
            {page.pageNumber === 1 && (
              <div className="mb-8 bg-gray-50 p-6 rounded-xl border-l-4 border-blue-600">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Name</label>
                      <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Location</label>
                      <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.location}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Date</label>
                      <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.date}</p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Title</label>
                      <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.title}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Expense Title</label>
                  <p className="text-xl md:text-2xl font-extrabold text-gray-950 mt-0.5">{formData.expenseTitle}</p>
                </div>
              </div>
            )}

            {/* Expenses Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <th className="border-2 border-gray-300 px-4 py-4 text-left font-black text-lg md:text-xl" style={{ width: '18%' }}>Date</th>
                    <th className="border-2 border-gray-300 px-4 py-4 text-left font-black text-lg md:text-xl" style={{ width: '15%' }}>Receipt No</th>
                    <th className="border-2 border-gray-300 px-4 py-4 text-left font-black text-lg md:text-xl" style={{ width: '33%' }}>Description</th>
                    <th className="border-2 border-gray-300 px-4 py-4 text-center font-black text-lg md:text-xl" style={{ width: '12%' }}>Amount</th>
                    <th className="border-2 border-gray-300 px-4 py-4 text-center font-black text-lg md:text-xl" style={{ width: '10%' }}>Currency</th>
                    <th className="border-2 border-gray-300 px-4 py-4 text-right font-black text-lg md:text-xl" style={{ width: '12%' }}>Amount AED</th>
                  </tr>
                </thead>
                <tbody>
                  {page.expenses.map((expense, index) => (
                    <tr key={expense.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-bold text-gray-900">{expense.date}</td>
                      <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-black text-gray-900">{expense.receiptNo}</td>
                      <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-bold text-gray-900" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{expense.description}</td>
                      <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-bold text-center text-gray-900">{expense.amount}</td>
                      <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-black text-center text-gray-900">{expense.currency}</td>
                      <td className="border-2 border-gray-300 px-4 py-4 text-base md:text-lg font-black text-right text-blue-700">{expense.amountAED}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Section (Totals & Footer) */}
          <div>
            {page.showTotals && (
              <div className="flex flex-col sm:flex-row justify-between items-end gap-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-2xl border-2 border-blue-200 mb-6">
                <div className="text-right w-full sm:w-auto shrink-0">
                  <p className="text-xs font-bold mb-2 tracking-widest text-gray-500 uppercase">TOTAL</p>
                  <p className="text-4xl md:text-5xl font-black text-blue-700 tracking-tight">{total}</p>
                  <p className="text-xs font-bold mt-2 tracking-widest">AED</p>
                </div>
              </div>
            )}

            {/* Page Footer */}
            <div className="flex justify-between items-center text-base font-bold text-gray-500 border-t-2 border-gray-200 pt-4">
              <p className="tracking-wider">MANLIFT GROUP</p>
              <p className="uppercase tracking-widest">Page {page.pageNumber} of {totalPages}</p>
              <p className="tracking-widest">CONFIDENTIAL</p>
            </div>
          </div>
        </div>
      ))}

      {/* Scanned Receipt Pages */}
      {receiptExpenses.map((expense, index) => (
        <div
          key={`receipt-page-${expense.id}`}
          data-pdf-page="true"
          className="bg-white shadow-2xl relative p-12 flex flex-col justify-between"
          style={{
            width: '1200px',
            height: '1700px',
            minHeight: '1700px',
            boxSizing: 'border-box'
          }}
        >
          <div>
            <div className="mb-8 flex justify-between items-center border-b-2 border-gray-200 pb-4">
              <span className="text-2xl font-black tracking-widest text-blue-950">MANLIFT</span>
              <span className="text-lg text-gray-500 font-extrabold uppercase">Scanned Receipt Page</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Receipt No: {expense.receiptNo} — {expense.description || 'Scanned Bill'}
            </h3>
            <div className="flex justify-center items-center border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50" style={{ height: '1300px' }}>
              <img
                src={expense.receiptImage}
                alt={`Receipt #${expense.receiptNo}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-base font-bold text-gray-500 border-t-2 border-gray-200 pt-4">
            <p className="tracking-wider">MANLIFT GROUP</p>
            <p className="uppercase tracking-widest">Page {pages.length + index + 1} of {totalPages}</p>
            <p className="tracking-widest">CONFIDENTIAL</p>
          </div>
        </div>
      ))}
    </div>
  );
}
