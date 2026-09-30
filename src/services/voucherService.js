import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { formatVoucherCode } from '../utils/voucherUtils.js'

export const VOUCHERS_KEY = 'smart-petty-cash-vouchers'
export const LEGACY_SAVE_KEY = 'smart-petty-cash-data'
export const MIGRATION_DONE_KEY = 'smart-petty-cash-migrated-to-supabase'

// In-memory debounced save map for Supabase syncing
const pendingSyncTimeouts = new Map()

/**
 * -----------------------------------------------------------------------------
 * LocalStorage Fallback Helpers
 * -----------------------------------------------------------------------------
 */

export function getLocalVouchers() {
  try {
    if (typeof localStorage === 'undefined') return []
    const saved = localStorage.getItem(VOUCHERS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return parsed.map(v => ({
          ...v,
          voucherCode: v.voucherCode || formatVoucherCode(v.id || v.formData?.date || Date.now()),
          isFavourite: !!v.isFavourite,
          formData: v.formData || {
            name: '',
            date: new Date().toISOString().split('T')[0],
            location: '',
            title: '',
            expenseTitle: ''
          },
          expenses: v.expenses || []
        }))
      }
    }

    // Check legacy single-voucher format
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
        return initialList
      }
    }
  } catch (err) {
    console.error('Failed to read from localStorage:', err)
  }
  return []
}

export function saveLocalVouchers(vouchers) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOUCHERS_KEY, JSON.stringify(vouchers))
    }
  } catch (err) {
    console.error('Failed to save to localStorage:', err)
  }
}

export function getLocalVoucherById(id) {
  const vouchers = getLocalVouchers()
  return vouchers.find(v => (
    v.id === parseInt(id) ||
    String(v.id) === String(id) ||
    v.voucherCode === String(id)
  )) || null
}

/**
 * -----------------------------------------------------------------------------
 * Data Mappers (PostgreSQL Schema <-> React State Model)
 * -----------------------------------------------------------------------------
 */

export function mapDbVoucherToApp(v) {
  return {
    id: v.id,
    voucherCode: v.voucher_code,
    isFavourite: Boolean(v.is_favourite),
    formData: {
      name: v.employee_name || '',
      date: v.voucher_date || '',
      location: v.location || '',
      title: v.title || '',
      expenseTitle: v.expense_title || ''
    },
    expenses: (v.expenses || [])
      .slice()
      .sort((a, b) => {
        const noA = a.receipt_no != null ? Number(a.receipt_no) : Infinity
        const noB = b.receipt_no != null ? Number(b.receipt_no) : Infinity
        if (noA !== noB) return noA - noB
        return (Number(a.id) || 0) - (Number(b.id) || 0)
      })
      .map(e => ({
        id: e.id,
        receiptNo: e.receipt_no != null ? e.receipt_no : '',
        date: e.expense_date || '',
        description: e.description || '',
        amount: e.amount != null ? String(e.amount) : '',
        currency: e.currency || 'AED',
        amountAED: e.amount_aed != null ? String(e.amount_aed) : '',
        receiptImage: e.receipt_image_url || ''
      }))
  }
}

export function mapAppToDbVoucher(voucher) {
  const code = voucher.voucherCode || formatVoucherCode(voucher.id || Date.now())
  const rawDate = voucher.formData?.date
  return {
    voucher_code: code,
    employee_name: voucher.formData?.name || '',
    voucher_date: (rawDate && typeof rawDate === 'string' && rawDate.trim()) ? rawDate.trim() : null,
    location: voucher.formData?.location || '',
    title: voucher.formData?.title || '',
    expense_title: voucher.formData?.expenseTitle || '',
    is_favourite: Boolean(voucher.isFavourite)
  }
}

export function mapAppToDbExpenses(expenses = [], voucherId) {
  return expenses.map(e => {
    const parsedNo = parseInt(e.receiptNo, 10)
    const rawDate = e.date
    const parsedAmount = parseFloat(e.amount)
    const parsedAmountAed = parseFloat(e.amountAED)

    return {
      voucher_id: voucherId,
      receipt_no: isNaN(parsedNo) ? null : parsedNo,
      expense_date: (rawDate && typeof rawDate === 'string' && rawDate.trim()) ? rawDate.trim() : null,
      description: e.description || '',
      amount: isNaN(parsedAmount) ? 0 : parsedAmount,
      currency: (e.currency && typeof e.currency === 'string' && e.currency.trim()) ? e.currency.trim() : 'AED',
      amount_aed: isNaN(parsedAmountAed) ? 0 : parsedAmountAed,
      receipt_image_url: e.receiptImage || null
    }
  })
}

/**
 * -----------------------------------------------------------------------------
 * Unified Service API
 * -----------------------------------------------------------------------------
 */

export const voucherService = {
  /**
   * Check if Supabase cloud is configured and ready
   */
  isCloudEnabled() {
    return isSupabaseConfigured && Boolean(supabase)
  },

  /**
   * Fetch all vouchers (with child expenses)
   * Tries Supabase first; on any failure or if unconfigured, falls back to localStorage.
   */
  async getAllVouchers() {
    if (this.isCloudEnabled()) {
      try {
        const { data, error } = await supabase
          .from('vouchers')
          .select(`*, expenses (*)`)
          .order('created_at', { ascending: false })

        if (!error && Array.isArray(data)) {
          const appVouchers = data.map(mapDbVoucherToApp)
          
          // Mirror to localStorage as cache / offline backup
          saveLocalVouchers(appVouchers)
          return { data: appVouchers, source: 'supabase' }
        } else if (error) {
          console.warn('Supabase query error, falling back to localStorage:', error.message)
        }
      } catch (err) {
        console.warn('Supabase connection failed, using localStorage fallback:', err)
      }
    }

    const localData = getLocalVouchers()
    return { data: localData, source: 'local' }
  },

  /**
   * Get single voucher by id or voucherCode
   */
  async getVoucherById(id) {
    if (!id) return null

    if (this.isCloudEnabled()) {
      try {
        let query = supabase.from('vouchers').select(`*, expenses (*)`)
        
        if (String(id).startsWith('exp_voucher_')) {
          query = query.eq('voucher_code', id)
        } else if (!isNaN(Number(id))) {
          query = query.or(`id.eq.${id},voucher_code.eq.${id}`)
        } else {
          query = query.eq('voucher_code', id)
        }

        const { data, error } = await query.maybeSingle()
        if (!error && data) {
          return mapDbVoucherToApp(data)
        }
      } catch (err) {
        console.warn('Supabase getVoucherById error, falling back to localStorage:', err)
      }
    }

    return getLocalVoucherById(id)
  },

  /**
   * Create a new voucher
   */
  async createVoucher(voucherData) {
    const timestamp = Date.now()
    const code = voucherData.voucherCode || formatVoucherCode(timestamp)
    
    const newVoucher = {
      id: timestamp,
      voucherCode: code,
      isFavourite: Boolean(voucherData.isFavourite),
      formData: voucherData.formData || {
        name: '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        title: '',
        expenseTitle: ''
      },
      expenses: voucherData.expenses || []
    }

    // Always update local storage first
    const currentLocal = getLocalVouchers()
    saveLocalVouchers([newVoucher, ...currentLocal])

    if (this.isCloudEnabled()) {
      try {
        const payload = mapAppToDbVoucher(newVoucher)
        const { data: dbVoucher, error: voucherError } = await supabase
          .from('vouchers')
          .insert([payload])
          .select()
          .single()

        if (!voucherError && dbVoucher) {
          newVoucher.id = dbVoucher.id // Update with DB primary key
          
          if (newVoucher.expenses.length > 0) {
            const expenseRows = mapAppToDbExpenses(newVoucher.expenses, dbVoucher.id)
            const { data: dbExpenses } = await supabase
              .from('expenses')
              .insert(expenseRows)
              .select()

            if (dbExpenses) {
              newVoucher.expenses = dbExpenses.map(e => ({
                id: e.id,
                receiptNo: e.receipt_no != null ? e.receipt_no : '',
                date: e.expense_date || '',
                description: e.description || '',
                amount: e.amount != null ? String(e.amount) : '',
                currency: e.currency || 'AED',
                amountAED: e.amount_aed != null ? String(e.amount_aed) : '',
                receiptImage: e.receipt_image_url || ''
              }))
            }
          }

          // Update local cache with assigned DB id
          const updatedLocal = getLocalVouchers().map(v => 
            v.voucherCode === code ? newVoucher : v
          )
          saveLocalVouchers(updatedLocal)
        } else if (voucherError) {
          console.warn('Failed to insert voucher to Supabase:', voucherError.message)
        }
      } catch (err) {
        console.warn('Supabase createVoucher error:', err)
      }
    }

    return newVoucher
  },

  /**
   * Update voucher and sync expenses.
   * Debounces Supabase update calls to avoid excessive database writes while typing.
   */
  async updateVoucher(id, voucherData, { immediate = false } = {}) {
    if (!id) return

    // 1. Immediately update LocalStorage
    const vouchers = getLocalVouchers()
    const targetCode = voucherData.voucherCode || formatVoucherCode(id)
    const existing = vouchers.find(v => 
      v.id === parseInt(id) || String(v.id) === String(id) || v.voucherCode === targetCode
    )

    const isFavouriteVal = voucherData.isFavourite !== undefined 
      ? Boolean(voucherData.isFavourite) 
      : Boolean(existing?.isFavourite)

    let updatedList
    const updatedItem = {
      ...voucherData,
      id: isNaN(Number(id)) ? id : Number(id),
      voucherCode: targetCode,
      isFavourite: isFavouriteVal
    }

    if (existing) {
      updatedList = vouchers.map(v => 
        (v.id === parseInt(id) || String(v.id) === String(id) || v.voucherCode === targetCode)
          ? { ...v, ...updatedItem }
          : v
      )
    } else {
      updatedList = [...vouchers, updatedItem]
    }
    saveLocalVouchers(updatedList)

    // 2. Sync to Supabase if available
    if (this.isCloudEnabled()) {
      const syncTask = async () => {
        try {
          // Find the Supabase record ID first
          let query = supabase.from('vouchers').select('id, voucher_code, is_favourite')
          if (String(id).startsWith('exp_voucher_')) {
            query = query.eq('voucher_code', id)
          } else if (!isNaN(Number(id))) {
            query = query.or(`id.eq.${id},voucher_code.eq.${targetCode}`)
          } else {
            query = query.eq('voucher_code', targetCode)
          }

          const { data: existingDbRecord } = await query.maybeSingle()

          let dbVoucherId = existingDbRecord?.id

          if (dbVoucherId) {
            // Update voucher record
            const updatePayload = {
              voucher_code: targetCode,
              employee_name: voucherData.formData?.name || '',
              voucher_date: (voucherData.formData?.date && typeof voucherData.formData.date === 'string' && voucherData.formData.date.trim()) ? voucherData.formData.date.trim() : null,
              location: voucherData.formData?.location || '',
              title: voucherData.formData?.title || '',
              expense_title: voucherData.formData?.expenseTitle || '',
              updated_at: new Date().toISOString()
            }
            if (voucherData.isFavourite !== undefined) {
              updatePayload.is_favourite = Boolean(voucherData.isFavourite)
            }

            await supabase
              .from('vouchers')
              .update(updatePayload)
              .eq('id', dbVoucherId)

            // Sync expenses: delete obsolete & re-insert current items
            await supabase.from('expenses').delete().eq('voucher_id', dbVoucherId)
            
            if (voucherData.expenses?.length > 0) {
              const expenseRows = mapAppToDbExpenses(voucherData.expenses, dbVoucherId)
              await supabase.from('expenses').insert(expenseRows)
            }
          } else {
            // Create if not yet present in Supabase
            const newPayload = mapAppToDbVoucher({ ...voucherData, voucherCode: targetCode, isFavourite: isFavouriteVal })
            const { data: createdRecord } = await supabase
              .from('vouchers')
              .insert([newPayload])
              .select('id')
              .single()

            if (createdRecord?.id) {
              // Update local cache so local id matches Supabase row id
              const localList = getLocalVouchers().map(v => 
                v.voucherCode === targetCode ? { ...v, id: createdRecord.id } : v
              )
              saveLocalVouchers(localList)

              if (voucherData.expenses?.length > 0) {
                const expenseRows = mapAppToDbExpenses(voucherData.expenses, createdRecord.id)
                await supabase.from('expenses').insert(expenseRows)
              }
            }
          }
        } catch (err) {
          console.warn('Background sync to Supabase failed:', err)
        }
      }

      if (immediate) {
        if (pendingSyncTimeouts.has(id)) {
          clearTimeout(pendingSyncTimeouts.get(id))
          pendingSyncTimeouts.delete(id)
        }
        await syncTask()
      } else {
        // Debounce by 600ms
        if (pendingSyncTimeouts.has(id)) {
          clearTimeout(pendingSyncTimeouts.get(id))
        }
        const timer = setTimeout(() => {
          pendingSyncTimeouts.delete(id)
          syncTask()
        }, 600)
        pendingSyncTimeouts.set(id, timer)
      }
    }

    return updatedItem
  },

  /**
   * Toggle favourite flag on a voucher
   */
  async toggleFavourite(voucherId, currentStatus) {
    const newStatus = !currentStatus

    // Update local storage
    const vouchers = getLocalVouchers().map(v => 
      (v.id === voucherId || String(v.id) === String(voucherId) || v.voucherCode === voucherId)
        ? { ...v, isFavourite: newStatus }
        : v
    )
    saveLocalVouchers(vouchers)

    if (this.isCloudEnabled()) {
      try {
        let query = supabase.from('vouchers').update({ is_favourite: newStatus })
        if (!isNaN(Number(voucherId))) {
          query = query.or(`id.eq.${voucherId},voucher_code.eq.${voucherId}`)
        } else {
          query = query.eq('voucher_code', voucherId)
        }
        await query
      } catch (err) {
        console.warn('Failed to toggle favourite in Supabase:', err)
      }
    }

    return newStatus
  },

  /**
   * Delete voucher by ID or voucherCode
   */
  async deleteVoucher(voucherId) {
    // Delete from local storage
    const current = getLocalVouchers()
    const updated = current.filter(v => (
      v.id !== voucherId &&
      String(v.id) !== String(voucherId) &&
      v.voucherCode !== voucherId
    ))
    saveLocalVouchers(updated)

    if (this.isCloudEnabled()) {
      try {
        let query = supabase.from('vouchers').delete()
        if (!isNaN(Number(voucherId))) {
          query = query.or(`id.eq.${voucherId},voucher_code.eq.${voucherId}`)
        } else {
          query = query.eq('voucher_code', voucherId)
        }
        await query
      } catch (err) {
        console.warn('Failed to delete voucher from Supabase:', err)
      }
    }

    return true
  },

  /**
   * Upload receipt image to Supabase Storage bucket 'receipts'.
   * Supports File, Blob, and Base64 data URLs.
   * Falls back to Base64 data URL if storage is unavailable or unconfigured.
   */
  async uploadReceiptImage(fileOrDataUrl, voucherCode = 'general') {
    if (!fileOrDataUrl) return null

    if (this.isCloudEnabled()) {
      try {
        let file = fileOrDataUrl
        let fileExt = 'jpg'
        let contentType = 'image/jpeg'

        if (typeof fileOrDataUrl === 'string') {
          if (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://')) {
            return fileOrDataUrl
          }
          if (fileOrDataUrl.startsWith('data:')) {
            const match = fileOrDataUrl.match(/^data:([^;]+);base64,(.*)$/)
            if (match) {
              contentType = match[1]
              fileExt = contentType.split('/')[1] || 'jpg'
              const binaryStr = typeof atob !== 'undefined' 
                ? atob(match[2]) 
                : Buffer.from(match[2], 'base64').toString('binary')
              const byteNumbers = new Uint8Array(binaryStr.length)
              for (let i = 0; i < binaryStr.length; i++) {
                byteNumbers[i] = binaryStr.charCodeAt(i)
              }
              file = new Blob([byteNumbers], { type: contentType })
            }
          }
        } else if (fileOrDataUrl?.name) {
          fileExt = fileOrDataUrl.name.split('.').pop() || 'jpg'
          contentType = fileOrDataUrl.type || 'image/jpeg'
        }

        const cleanCode = (voucherCode || 'voucher').replace(/[^a-zA-Z0-9_-]/g, '_')
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
        const filePath = `${cleanCode}/${fileName}`

        const { data, error } = await supabase.storage
          .from('receipts')
          .upload(filePath, file, {
            contentType,
            upsert: true
          })

        if (!error && data) {
          const { data: publicUrlData } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath)

          if (publicUrlData?.publicUrl) {
            return publicUrlData.publicUrl
          }
        } else if (error) {
          console.warn('Supabase storage upload error, falling back to Base64:', error.message)
        }
      } catch (err) {
        console.warn('Supabase storage upload exception, falling back to Base64:', err)
      }
    }

    // Fallback: If it's already a string (URL or Base64), return it directly
    if (typeof fileOrDataUrl === 'string') {
      return fileOrDataUrl
    }

    // Fallback: Read file/blob as Base64 Data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Failed to read image file'))
      reader.readAsDataURL(fileOrDataUrl)
    })
  },

  /**
   * One-time or on-demand migration of localStorage vouchers into Supabase
   */
  async migrateLocalStorageToSupabase() {
    if (!this.isCloudEnabled()) {
      return { success: false, migratedCount: 0, message: 'Supabase is not configured' }
    }

    try {
      const localVouchers = getLocalVouchers()
      if (!localVouchers || localVouchers.length === 0) {
        return { success: true, migratedCount: 0, message: 'No local vouchers to migrate' }
      }

      // Fetch existing voucher codes in Supabase to avoid duplicates
      const { data: existingCloudVouchers, error: checkError } = await supabase
        .from('vouchers')
        .select('voucher_code')

      if (checkError) {
        throw new Error(checkError.message)
      }

      const existingCodeSet = new Set((existingCloudVouchers || []).map(v => v.voucher_code))
      let migratedCount = 0

      for (const v of localVouchers) {
        if (!existingCodeSet.has(v.voucherCode)) {
          // 1. Insert voucher
          const rawDate = v.formData?.date
          const { data: insertedVoucher, error: vError } = await supabase
            .from('vouchers')
            .insert([{
              voucher_code: v.voucherCode,
              employee_name: v.formData?.name || '',
              voucher_date: (rawDate && typeof rawDate === 'string' && rawDate.trim()) ? rawDate.trim() : null,
              location: v.formData?.location || '',
              title: v.formData?.title || '',
              expense_title: v.formData?.expenseTitle || '',
              is_favourite: Boolean(v.isFavourite)
            }])
            .select()
            .single()

          if (!vError && insertedVoucher) {
            let processedExpenses = v.expenses || []

            if (processedExpenses.length > 0) {
              // Upload any base64 receipt images to Supabase Storage
              processedExpenses = await Promise.all(
                processedExpenses.map(async (exp) => {
                  if (exp.receiptImage && typeof exp.receiptImage === 'string' && exp.receiptImage.startsWith('data:')) {
                    try {
                      const uploadedUrl = await this.uploadReceiptImage(exp.receiptImage, v.voucherCode)
                      return { ...exp, receiptImage: uploadedUrl }
                    } catch (e) {
                      return exp
                    }
                  }
                  return exp
                })
              )

              // 2. Insert line items
              const expensesPayload = mapAppToDbExpenses(processedExpenses, insertedVoucher.id)
              await supabase.from('expenses').insert(expensesPayload)
            }

            // Sync updated ID & receipt image URLs to local cache
            const updatedLocal = getLocalVouchers().map(locV => 
              locV.voucherCode === v.voucherCode ? { ...locV, id: insertedVoucher.id, expenses: processedExpenses } : locV
            )
            saveLocalVouchers(updatedLocal)

            migratedCount++
            existingCodeSet.add(v.voucherCode)
          }
        }
      }

      // Record migration status
      localStorage.setItem(MIGRATION_DONE_KEY, new Date().toISOString())
      
      return {
        success: true,
        migratedCount,
        message: `Successfully synced ${migratedCount} local voucher(s) to Supabase cloud`
      }
    } catch (err) {
      console.error('Migration to Supabase failed:', err)
      return { success: false, migratedCount: 0, message: err.message }
    }
  }
}
