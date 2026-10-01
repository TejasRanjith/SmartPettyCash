import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { formatVoucherCode } from '../utils/voucherUtils.js'

export const VOUCHERS_KEY = 'smart-petty-cash-vouchers'
export const LEGACY_SAVE_KEY = 'smart-petty-cash-data'
export const MIGRATION_DONE_KEY = 'smart-petty-cash-migrated-to-supabase'

// In-memory debounced save map for Supabase syncing
const pendingSyncTimeouts = new Map()

/**
 * -----------------------------------------------------------------------------
 * LocalStorage Fallback Helpers with User Isolation Support
 * -----------------------------------------------------------------------------
 */

let lastGeneratedId = 0
export function generateUniqueVoucherId() {
  let now = Date.now()
  if (now <= lastGeneratedId) {
    now = lastGeneratedId + 1
  }
  lastGeneratedId = now
  return now
}

export function getLocalVouchers(userId = null) {
  try {
    if (typeof localStorage === 'undefined') return []
    const saved = localStorage.getItem(VOUCHERS_KEY)
    let parsedList = []

    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        parsedList = parsed.map(v => ({
          ...v,
          userId: v.userId || v.user_id || null,
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
    } else {
      // Check legacy single-voucher format
      const legacy = localStorage.getItem(LEGACY_SAVE_KEY)
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy)
        if (parsedLegacy.formData || parsedLegacy.expenses?.length > 0) {
          const timestamp = Date.now()
          const initialVoucher = {
            id: timestamp,
            userId: userId || null,
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
          parsedList = [initialVoucher]
          localStorage.setItem(VOUCHERS_KEY, JSON.stringify(parsedList))
        }
      }
    }

    // Filter by userId if requested (ensuring User A cannot view User B's vouchers)
    if (userId) {
      return parsedList.filter(v => !v.userId || v.userId === userId)
    }

    return parsedList
  } catch (err) {
    console.error('Failed to read from localStorage:', err)
    return []
  }
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

export function getLocalVoucherById(id, userId = null) {
  // Read all vouchers without filtering first to locate the record
  const allVouchers = getLocalVouchers(null)
  const found = allVouchers.find(v => (
    v.id === parseInt(id) ||
    String(v.id) === String(id) ||
    v.voucherCode === String(id)
  ))

  if (!found) return null

  // If userId is provided, ensure user ownership
  if (userId && found.userId && found.userId !== userId) {
    // Access Denied: Voucher belongs to another user
    return null
  }

  return found
}

/**
 * -----------------------------------------------------------------------------
 * Data Mappers (PostgreSQL Schema <-> React State Model)
 * -----------------------------------------------------------------------------
 */

export function mapDbVoucherToApp(v) {
  return {
    id: v.id,
    userId: v.user_id || null,
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
  const uid = voucher.userId || voucher.user_id || null

  const record = {
    voucher_code: code,
    employee_name: voucher.formData?.name || '',
    voucher_date: (rawDate && typeof rawDate === 'string' && rawDate.trim()) ? rawDate.trim() : null,
    location: voucher.formData?.location || '',
    title: voucher.formData?.title || '',
    expense_title: voucher.formData?.expenseTitle || '',
    is_favourite: Boolean(voucher.isFavourite)
  }

  if (uid) {
    record.user_id = uid
  }

  return record
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
 * Unified Service API with User-Based Access Control
 * -----------------------------------------------------------------------------
 */

export const voucherService = {
  /**
   * Synchronous local storage accessors
   */
  getLocalVouchers(userId = null) {
    return getLocalVouchers(userId)
  },

  saveLocalVouchers(vouchers) {
    return saveLocalVouchers(vouchers)
  },

  getLocalVoucherById(id, userId = null) {
    return getLocalVoucherById(id, userId)
  },

  /**
   * Check if Supabase cloud is configured and ready
   */
  isCloudEnabled() {
    return isSupabaseConfigured && Boolean(supabase)
  },

  /**
   * Fetch all vouchers for a given user.
   * Enforces that users only view their own vouchers.
   */
  async getAllVouchers(userId = null) {
    if (this.isCloudEnabled()) {
      try {
        let query = supabase
          .from('vouchers')
          .select(`*, expenses (*)`)
          .order('created_at', { ascending: false })

        // In Supabase, if userId is passed, filter explicitly.
        // Even without this, Supabase RLS enforces auth.uid() = user_id automatically.
        if (userId) {
          query = query.eq('user_id', userId)
        }

        const { data, error } = await query

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

    const localData = getLocalVouchers(userId)
    return { data: localData, source: 'local' }
  },

  /**
   * Get single voucher by id or voucherCode with ownership verification
   */
  async getVoucherById(id, userId = null) {
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

        if (userId) {
          query = query.eq('user_id', userId)
        }

        const { data, error } = await query.maybeSingle()
        if (!error && data) {
          if (userId && data.user_id && data.user_id !== userId) {
            // Block access if voucher belongs to another user
            return null
          }
          return mapDbVoucherToApp(data)
        }
      } catch (err) {
        console.warn('Supabase getVoucherById error, falling back to localStorage:', err)
      }
    }

    return getLocalVoucherById(id, userId)
  },

  /**
   * Create a new voucher for the logged-in user.
   * Auto-populates employee details from user profile if not provided.
   */
  async createVoucher(voucherData = {}, userContext = null) {
    const timestamp = voucherData.id || generateUniqueVoucherId()
    const code = voucherData.voucherCode || formatVoucherCode(timestamp)
    const effectiveUserId = userContext?.id || voucherData.userId || null
    const profile = userContext?.profile || {}

    const newVoucher = {
      id: timestamp,
      userId: effectiveUserId,
      voucherCode: code,
      isFavourite: Boolean(voucherData.isFavourite),
      formData: {
        name: voucherData.formData?.name || profile.fullName || '',
        date: voucherData.formData?.date || new Date().toISOString().split('T')[0],
        location: voucherData.formData?.location || profile.location || '',
        title: voucherData.formData?.title || profile.title || '',
        expenseTitle: voucherData.formData?.expenseTitle || ''
      },
      expenses: voucherData.expenses || []
    }

    // Always update local storage first
    const currentLocal = getLocalVouchers(null)
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
          const updatedLocal = getLocalVouchers(null).map(v => 
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
   * Update voucher and sync expenses with ownership verification
   */
  async updateVoucher(id, voucherData, { immediate = false } = {}, userId = null) {
    if (!id) return

    // 1. Immediately update LocalStorage
    const vouchers = getLocalVouchers(null)
    const targetCode = voucherData.voucherCode || formatVoucherCode(id)
    const existing = vouchers.find(v => 
      v.id === parseInt(id) || String(v.id) === String(id) || v.voucherCode === targetCode
    )

    // Ownership check: if voucher belongs to another user, reject update
    if (existing?.userId && userId && existing.userId !== userId) {
      console.warn('Unauthorized update attempt on voucher:', id)
      return null
    }

    const isFavouriteVal = voucherData.isFavourite !== undefined 
      ? Boolean(voucherData.isFavourite) 
      : Boolean(existing?.isFavourite)

    const effectiveUserId = existing?.userId || userId || voucherData.userId || null

    const updatedItem = {
      ...voucherData,
      id: isNaN(Number(id)) ? id : Number(id),
      userId: effectiveUserId,
      voucherCode: targetCode,
      isFavourite: isFavouriteVal
    }

    let updatedList
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
          let query = supabase.from('vouchers').select('id, user_id, voucher_code, is_favourite')
          if (String(id).startsWith('exp_voucher_')) {
            query = query.eq('voucher_code', id)
          } else if (!isNaN(Number(id))) {
            query = query.or(`id.eq.${id},voucher_code.eq.${targetCode}`)
          } else {
            query = query.eq('voucher_code', targetCode)
          }

          if (userId) {
            query = query.eq('user_id', userId)
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
            if (effectiveUserId) {
              updatePayload.user_id = effectiveUserId
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
            const newPayload = mapAppToDbVoucher({ 
              ...voucherData, 
              userId: effectiveUserId, 
              voucherCode: targetCode, 
              isFavourite: isFavouriteVal 
            })
            const { data: createdRecord } = await supabase
              .from('vouchers')
              .insert([newPayload])
              .select('id')
              .single()

            if (createdRecord?.id) {
              // Update local cache so local id matches Supabase row id
              const localList = getLocalVouchers(null).map(v => 
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
   * Toggle favourite flag on a voucher with ownership check
   */
  async toggleFavourite(voucherId, currentStatus, userId = null) {
    const newStatus = !currentStatus

    // Update local storage
    const vouchers = getLocalVouchers(null).map(v => {
      const match = (v.id === voucherId || String(v.id) === String(voucherId) || v.voucherCode === voucherId)
      if (match) {
        if (userId && v.userId && v.userId !== userId) return v // Unauthorized
        return { ...v, isFavourite: newStatus }
      }
      return v
    })
    saveLocalVouchers(vouchers)

    if (this.isCloudEnabled()) {
      try {
        let query = supabase.from('vouchers').update({ is_favourite: newStatus })
        if (!isNaN(Number(voucherId))) {
          query = query.or(`id.eq.${voucherId},voucher_code.eq.${voucherId}`)
        } else {
          query = query.eq('voucher_code', voucherId)
        }
        if (userId) {
          query = query.eq('user_id', userId)
        }
        await query
      } catch (err) {
        console.warn('Failed to toggle favourite in Supabase:', err)
      }
    }

    return newStatus
  },

  /**
   * Delete voucher by ID or voucherCode with ownership verification
   */
  async deleteVoucher(voucherId, userId = null) {
    const current = getLocalVouchers(null)
    const target = current.find(v => (
      v.id === voucherId || String(v.id) === String(voucherId) || v.voucherCode === voucherId
    ))

    if (target?.userId && userId && target.userId !== userId) {
      console.warn('Unauthorized delete attempt for voucher:', voucherId)
      return false
    }

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
        if (userId) {
          query = query.eq('user_id', userId)
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
  async uploadReceiptImage(fileOrBlob, voucherCode = 'general') {
    if (!fileOrBlob) return ''

    // If it's already a remote cloud URL, return as-is
    if (typeof fileOrBlob === 'string' && (fileOrBlob.startsWith('http://') || fileOrBlob.startsWith('https://'))) {
      return fileOrBlob
    }

    if (this.isCloudEnabled()) {
      try {
        let uploadBlob = fileOrBlob
        let fileExt = 'jpg'

        // Convert base64 data URL to Blob if necessary
        if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:')) {
          const match = fileOrBlob.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
          if (match) {
            const mimeType = match[1]
            fileExt = mimeType.split('/')[1] || 'jpg'
            const byteCharacters = atob(match[2])
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            uploadBlob = new Blob([byteArray], { type: mimeType })
          }
        } else if (fileOrBlob.name) {
          fileExt = fileOrBlob.name.split('.').pop() || 'jpg'
        }

        const safeCode = (voucherCode || 'voucher').replace(/[^a-zA-Z0-9_-]/g, '_')
        const timestamp = Date.now()
        const randomPart = Math.random().toString(36).substring(2, 7)
        const filePath = `${safeCode}/${timestamp}_${randomPart}.${fileExt}`

        const { data, error } = await supabase.storage
          .from('receipts')
          .upload(filePath, uploadBlob, {
            cacheControl: '3600',
            upsert: false
          })

        if (!error && data?.path) {
          const { data: publicUrlData } = supabase.storage
            .from('receipts')
            .getPublicUrl(data.path)

          if (publicUrlData?.publicUrl) {
            return publicUrlData.publicUrl
          }
        } else if (error) {
          console.warn('Supabase storage upload error:', error.message)
        }
      } catch (err) {
        console.warn('Receipt upload to Supabase storage failed, falling back to base64:', err)
      }
    }

    // Fallback: If it's a File or Blob, convert to Base64 data URL
    if (typeof fileOrBlob !== 'string') {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = () => resolve('')
        reader.readAsDataURL(fileOrBlob)
      })
    }

    return fileOrBlob
  },

  /**
   * One-time or manual migration from LocalStorage to Supabase Cloud for a specific user
   */
  async migrateLocalStorageToSupabase(targetUserId = null) {
    if (!this.isCloudEnabled()) {
      return { success: false, message: 'Supabase cloud is not configured' }
    }

    try {
      const localVouchers = getLocalVouchers(targetUserId)
      if (!localVouchers || localVouchers.length === 0) {
        return { success: true, migratedCount: 0, message: 'No local vouchers found to migrate' }
      }

      // Check existing vouchers in Supabase
      const { data: existingDbVouchers } = await supabase
        .from('vouchers')
        .select('voucher_code')

      const existingCodeSet = new Set((existingDbVouchers || []).map(v => v.voucher_code))
      let migratedCount = 0

      for (const v of localVouchers) {
        if (!existingCodeSet.has(v.voucherCode)) {
          // 1. Insert Voucher
          const rawDate = v.formData?.date
          const { data: insertedVoucher, error: vError } = await supabase
            .from('vouchers')
            .insert([{
              voucher_code: v.voucherCode,
              user_id: targetUserId || v.userId || null,
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
            const updatedLocal = getLocalVouchers(null).map(locV => 
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
