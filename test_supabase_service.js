import { mapDbVoucherToApp, mapAppToDbVoucher, mapAppToDbExpenses, voucherService } from './src/services/voucherService.js'

console.log('--- Testing Data Mappings ---')

const sampleVoucher = {
  id: 12345,
  voucherCode: 'exp_voucher_260930-120000',
  isFavourite: true,
  formData: {
    name: 'John Doe',
    date: '  2026-09-30  ',
    location: 'Dubai Office',
    title: 'Project Lead',
    expenseTitle: 'Client Lunch'
  },
  expenses: [
    {
      id: 1,
      receiptNo: 101,
      date: '  2026-09-30  ',
      description: 'Business Lunch',
      amount: '150.00',
      currency: '  AED  ',
      amountAED: '150.00',
      receiptImage: 'https://example.com/receipt.jpg'
    },
    {
      id: 2,
      receiptNo: 0, // Critical edge case: receipt #0 should not become null!
      date: '',
      description: 'Zero receipt test',
      amount: '0',
      currency: 'AED',
      amountAED: '0',
      receiptImage: ''
    }
  ]
}

const dbRecord = mapAppToDbVoucher(sampleVoucher)
console.log('mapAppToDbVoucher output:', dbRecord)
if (dbRecord.voucher_code !== 'exp_voucher_260930-120000') throw new Error('voucher_code mismatch')
if (dbRecord.employee_name !== 'John Doe') throw new Error('employee_name mismatch')
if (dbRecord.voucher_date !== '2026-09-30') throw new Error('voucher_date was not trimmed')
if (dbRecord.is_favourite !== true) throw new Error('is_favourite mismatch')

const dbExpenses = mapAppToDbExpenses(sampleVoucher.expenses, 999)
console.log('mapAppToDbExpenses output:', dbExpenses)
if (dbExpenses[0].voucher_id !== 999) throw new Error('voucher_id mismatch')
if (dbExpenses[0].amount !== 150) throw new Error('amount mismatch')
if (dbExpenses[0].receipt_no !== 101) throw new Error('receipt_no mismatch')
if (dbExpenses[0].currency !== 'AED') throw new Error('currency was not trimmed')
if (dbExpenses[1].receipt_no !== 0) throw new Error('receipt_no 0 was wrongly converted to null')
if (dbExpenses[1].expense_date !== null) throw new Error('empty date was not converted to null')
if (dbExpenses[1].amount !== 0) throw new Error('amount 0 mismatch')

// Test stable sorting of child expenses in mapDbVoucherToApp
const dbVoucherWithUnorderedExpenses = {
  id: 999,
  voucher_code: 'exp_voucher_260930-120000',
  employee_name: 'John Doe',
  voucher_date: '2026-09-30',
  location: 'Dubai Office',
  title: 'Project Lead',
  expense_title: 'Client Lunch',
  is_favourite: true,
  expenses: [
    { id: 503, receipt_no: 3, description: 'Item 3' },
    { id: 501, receipt_no: 1, description: 'Item 1' },
    { id: 502, receipt_no: 2, description: 'Item 2' }
  ]
}

const appMapped = mapDbVoucherToApp(dbVoucherWithUnorderedExpenses)
console.log('mapDbVoucherToApp sorted output receipt numbers:', appMapped.expenses.map(e => e.receiptNo))
if (appMapped.expenses[0].receiptNo !== 1 || appMapped.expenses[1].receiptNo !== 2 || appMapped.expenses[2].receiptNo !== 3) {
  throw new Error('Expenses were not stably sorted by receipt_no!')
}

// Setup mock localStorage
const store = new Map()
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
}

console.log('--- Testing Fallback / Unconfigured Supabase Behavior ---')
console.log('isCloudEnabled():', voucherService.isCloudEnabled())
if (voucherService.isCloudEnabled() !== false) {
  console.log('Note: isCloudEnabled returned true (credentials present)')
} else {
  console.log('Verified: isCloudEnabled returned false cleanly without throwing.')
}

console.log('--- Testing CRUD Lifecycle in Local Fallback Mode ---')
// 1. Create
const created = await voucherService.createVoucher({
  voucherCode: 'exp_voucher_260930-999999',
  isFavourite: true,
  formData: {
    name: 'Jane Smith',
    date: '2026-09-30',
    location: 'Abu Dhabi',
    title: 'Operations Director',
    expenseTitle: 'Site Inspection'
  },
  expenses: [
    {
      id: 1,
      receiptNo: 1,
      date: '2026-09-30',
      description: 'Fuel',
      amount: '120.00',
      currency: 'AED',
      amountAED: '120.00'
    }
  ]
})
console.log('Created voucher:', created.voucherCode, 'id:', created.id, 'isFavourite:', created.isFavourite)
if (!created.voucherCode.includes('exp_voucher_')) throw new Error('Failed to create voucher code')
if (created.isFavourite !== true) throw new Error('isFavourite was not preserved on create')

// 2. Read All
const all = await voucherService.getAllVouchers()
console.log('getAllVouchers count:', all.data.length, 'source:', all.source)
if (all.data.length !== 1) throw new Error('Expected 1 voucher in storage')
if (all.source !== 'local') throw new Error('Expected source: local')

// 3. Read Single
const single = await voucherService.getVoucherById(created.id)
console.log('getVoucherById retrieved:', single?.voucherCode)
if (single?.voucherCode !== 'exp_voucher_260930-999999') throw new Error('getVoucherById failed')

// 3b. Read Synchronous Local Voucher By ID
const syncLocal = voucherService.getLocalVoucherById(created.id)
console.log('getLocalVoucherById retrieved:', syncLocal?.voucherCode)
if (syncLocal?.voucherCode !== 'exp_voucher_260930-999999') throw new Error('getLocalVoucherById failed')

// 4. Update without isFavourite (must preserve isFavourite: true)
await voucherService.updateVoucher(created.id, {
  voucherCode: single.voucherCode,
  formData: { ...single.formData, name: 'Jane Smith-Updated' },
  expenses: single.expenses
  // Note: isFavourite is intentionally omitted to verify preservation
}, { immediate: true })

const updated = await voucherService.getVoucherById(created.id)
console.log('Updated voucher employee name:', updated?.formData?.name, 'isFavourite:', updated?.isFavourite)
if (updated?.formData?.name !== 'Jane Smith-Updated') throw new Error('updateVoucher failed to update name')
if (updated?.isFavourite !== true) throw new Error('updateVoucher wiped out isFavourite when omitted!')

// 5. Toggle Favourite
const favStatus = await voucherService.toggleFavourite(created.id, true)
console.log('Toggled favourite to:', favStatus)
if (favStatus !== false) throw new Error('toggleFavourite failed')

// 6. Test uploadReceiptImage string/URL handling
const remoteUrl = 'https://example.com/receipt.jpg'
const returnedUrl = await voucherService.uploadReceiptImage(remoteUrl, 'test_code')
if (returnedUrl !== remoteUrl) throw new Error('uploadReceiptImage failed to return remote URL')

const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const returnedDataUrl = await voucherService.uploadReceiptImage(dataUrl, 'test_code')
if (!returnedDataUrl.startsWith('data:image/')) throw new Error('uploadReceiptImage fallback failed for data URL')

// 7. Delete
await voucherService.deleteVoucher(created.id)
const afterDelete = await voucherService.getAllVouchers()
console.log('Voucher count after deletion:', afterDelete.data.length)
if (afterDelete.data.length !== 0) throw new Error('deleteVoucher failed')

console.log('All mapper, lifecycle, and fallback tests passed 100% successfully!')
