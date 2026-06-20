// Offline storage utility using IndexedDB for persistent offline data
// Stores API responses locally so the app works without internet

const DB_NAME = 'bimoed-offline'
const DB_VERSION = 1
const STORE_NAME = 'api-cache'
const POSITION_STORE = 'last-position'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
      if (!db.objectStoreNames.contains(POSITION_STORE)) {
        db.createObjectStore(POSITION_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export type CacheEntry<T = unknown> = {
  key: string
  data: T
  timestamp: number
  ttl: number // milliseconds
}

export async function setCache<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ key, data, timestamp: Date.now(), ttl: ttlMs } as CacheEntry<T>)
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.warn('IndexedDB write failed, falling back to localStorage:', e)
    try {
      localStorage.setItem(`bimoed-cache-${key}`, JSON.stringify({ data, timestamp: Date.now(), ttl: ttlMs }))
    } catch {}
  }
}

export async function getCache<T>(key: string): Promise<{ data: T; fresh: boolean } | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<T> | undefined
        if (!entry) {
          // Fallback to localStorage
          resolve(getLocalStorageCache<T>(key))
          return
        }
        const fresh = (Date.now() - entry.timestamp) < entry.ttl
        resolve({ data: entry.data, fresh })
      }
      req.onerror = () => resolve(getLocalStorageCache<T>(key))
    })
  } catch {
    return getLocalStorageCache<T>(key)
  }
}

function getLocalStorageCache<T>(key: string): { data: T; fresh: boolean } | null {
  try {
    const raw = localStorage.getItem(`bimoed-cache-${key}`)
    if (!raw) return null
    const entry = JSON.parse(raw)
    const fresh = (Date.now() - entry.timestamp) < entry.ttl
    return { data: entry.data as T, fresh }
  } catch {
    return null
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    // Also clear localStorage fallback
    const keys = Object.keys(localStorage).filter(k => k.startsWith('bimoed-cache-'))
    keys.forEach(k => localStorage.removeItem(k))
  } catch {}
}

// --- Last Position Persistence ---

export interface PersistedPosition {
  id: string
  lat: number
  lng: number
  timestamp: number
}

export async function saveLastPosition(lat: number, lng: number): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(POSITION_STORE, 'readwrite')
    tx.objectStore(POSITION_STORE).put({
      id: 'user',
      lat,
      lng,
      timestamp: Date.now(),
    } as PersistedPosition)
    // Also save to localStorage as fallback
    localStorage.setItem('bimoed-last-position', JSON.stringify({ lat, lng }))
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    // localStorage fallback
    try {
      localStorage.setItem('bimoed-last-position', JSON.stringify({ lat, lng }))
    } catch {}
  }
}

export async function getLastPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(POSITION_STORE, 'readonly')
    const req = tx.objectStore(POSITION_STORE).get('user')
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const entry = req.result as PersistedPosition | undefined
        if (entry) resolve({ lat: entry.lat, lng: entry.lng })
        else resolve(getLocalStoragePosition())
      }
      req.onerror = () => resolve(getLocalStoragePosition())
    })
  } catch {
    return getLocalStoragePosition()
  }
}

function getLocalStoragePosition(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem('bimoed-last-position')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}