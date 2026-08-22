import { setCache, getCache } from '../utils/storage'
import type {
  Alert,
  EvacuationRoute,
  ReportPayload,
  ReportResponse,
  ReportValidation,
  RiskData,
  RiskHistoryPoint,
  SafeZone,
  SyncBundle,
  SOSPayload,
  SOSResponse,
} from './types'

// In dev, use Vite proxy (same origin) — avoids CORS and port mismatches
const API_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || 'http://localhost:8000')
const API_PREFIX = '/api/v1'

// Track online status
let _isOnline = navigator.onLine
window.addEventListener('online', () => { _isOnline = true })
window.addEventListener('offline', () => { _isOnline = false })

export function isOnline(): boolean {
  return _isOnline
}

// Cap how long we wait on a slow/unresponsive backend before giving up and
// falling back to the last known-good data — keeps screens from hanging.
const REQUEST_TIMEOUT_MS = 10_000

interface RequestOptions extends RequestInit {
  // Some POST endpoints (e.g. route computation) are reads in spirit — they don't
  // mutate server state, so their last successful result is safe to cache and to
  // fall back to. Opt them in explicitly rather than caching every POST by default.
  cacheable?: boolean
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { cacheable, ...fetchInit } = init ?? {}
  const bodyKey = typeof fetchInit.body === 'string' ? `:${fetchInit.body}` : ''
  const cacheKey = `api:${fetchInit.method || 'GET'}:${path}${bodyKey}`
  const isMutation = !cacheable && !!fetchInit.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchInit.method)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${API_BASE}${API_PREFIX}${path}`, {
      headers: { Accept: 'application/json', ...fetchInit.headers },
      signal: controller.signal,
      ...fetchInit,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText)
      throw new Error(detail || `Request failed (${res.status})`)
    }
    const data = (await res.json()) as T

    // Cache successful GET responses for offline use
    if (!isMutation) {
      setCache(cacheKey, data, 5 * 60 * 1000).catch(() => {}) // 5 min TTL
    }

    return data
  } catch (err) {
    // Any failure to fetch fresh data — offline, timeout, network error, or a
    // backend error response — falls back to the last known-good response
    // instead of leaving the screen stuck loading or empty. Mutations
    // (submitting a report/SOS, etc.) always surface the real error instead,
    // since there's no sane "last known data" to fall back to for those.
    if (!isMutation) {
      const cached = await getCache<T>(cacheKey)
      if (cached) {
        console.log(`[Fallback] Returning last known data for ${path}${cached.fresh ? ' (fresh)' : ' (stale)'}`)
        return cached.data
      }
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

// Reads whatever was last persisted for a GET path, without touching the
// network — lets a screen paint last-known data the instant it mounts,
// instead of a blank/placeholder state while the real fetch is in flight.
export async function peekCached<T>(path: string): Promise<T | null> {
  const cached = await getCache<T>(`api:GET:${path}`)
  return cached ? cached.data : null
}

export function getRisk(lat: number, lng: number): Promise<RiskData> {
  return request(`/risk?lat=${lat}&lng=${lng}`)
}

export interface BackendWeatherData {
  temp: number
  condition: string
  humidity: number
  wind_speed: number
  precipitation: number
  river_discharge: number
  icon: string
  source: string
  forecast: {
    hour: number
    temp: number
    condition: string
    icon: string
    precipitation: number
  }[]
}

export function getBackendWeather(lat: number, lng: number): Promise<BackendWeatherData> {
  return request(`/risk/weather?lat=${lat}&lng=${lng}`)
}

export function getRiskHistory(lat: number, lng: number, hours = 12): Promise<{ points: RiskHistoryPoint[] }> {
  return request(`/risk/history?lat=${lat}&lng=${lng}&hours=${hours}`)
}

export function getAlerts(lat: number, lng: number, radiusKm = 15): Promise<Alert[]> {
  return request(`/alerts?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`)
}

export function getSafeZones(lat: number, lng: number): Promise<SafeZone[]> {
  return request(`/safe-zones?lat=${lat}&lng=${lng}`)
}

export function getNearbyReports(lat: number, lng: number, radiusKm = 5): Promise<ReportResponse[]> {
  return request(`/reports/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`)
}

export function submitReport(payload: ReportPayload): Promise<ReportResponse> {
  return request('/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function submitReportWithPhoto(
  payload: ReportPayload,
  photo: File,
): Promise<ReportResponse> {
  const form = new FormData()
  form.append('category', payload.category)
  form.append('severity', payload.severity)
  form.append('lat', String(payload.lat))
  form.append('lng', String(payload.lng))
  form.append('description', payload.description)
  if (payload.user_id) form.append('user_id', payload.user_id)
  form.append('photo', photo)
  return request('/reports/upload', { method: 'POST', body: form })
}

export function getReportValidation(reportId: number): Promise<ReportValidation> {
  return request(`/reports/${reportId}/validation`)
}

export function getEvacuationRoute(
  originLat: number,
  originLng: number,
  destLat?: number,
  destLng?: number,
): Promise<EvacuationRoute> {
  const body: Record<string, number> = { origin_lat: originLat, origin_lng: originLng }
  if (destLat != null && destLng != null) {
    body.destination_lat = destLat
    body.destination_lng = destLng
  }
  return request('/routes/evacuation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cacheable: true,
  })
}

export function getSyncBundle(lat: number, lng: number, region = 'medan'): Promise<SyncBundle> {
  return request(`/sync/bundle?region=${region}&lat=${lat}&lng=${lng}`)
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}

export function submitSOS(payload: SOSPayload): Promise<SOSResponse> {
  return request('/sos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function getNearSOSAlerts(lat: number, lng: number, radiusKm = 15): Promise<SOSResponse[]> {
  return request(`/sos?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`)
}

export function resolveSOS(sosId: number): Promise<SOSResponse> {
  return request(`/sos/${sosId}/resolve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface GoogleWeatherData {
  temp: number
  condition: string
  humidity: number
  windSpeed: number
  icon: string
}

export interface GoogleForecastHour {
  hour: number
  temp: number
  condition: string
  icon: string
}

export async function getGoogleWeather(lat: number, lng: number): Promise<{
  current: GoogleWeatherData;
  forecast: GoogleForecastHour[];
}> {
  const key = import.meta.env.VITE_GOOGLE_WEATHER_KEY
  if (!key) {
    throw new Error('Google Weather API key not configured')
  }
  const currentUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${key}&location.latitude=${lat}&location.longitude=${lng}`
  const forecastUrl = `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${key}&location.latitude=${lat}&location.longitude=${lng}`

  const cacheKey = `weather:google:${lat.toFixed(2)}:${lng.toFixed(2)}`

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl),
      fetch(forecastUrl),
    ])

    if (!currentRes.ok || !forecastRes.ok) {
      throw new Error('Failed to fetch weather data from Google Maps API')
    }

    const currentData = await currentRes.json()
    const forecastData = await forecastRes.json()

    const mapTypeToEmoji = (type: string): string => {
      const t = type?.toUpperCase() || ''
      if (t.includes('CLEAR') || t.includes('SUNNY')) return '☀️'
      if (t.includes('THUNDERSTORM')) return '⛈️'
      if (t.includes('RAIN') || t.includes('SHOWER') || t.includes('DRIZZLE')) return '🌧️'
      if (t.includes('SNOW') || t.includes('HAIL')) return '❄️'
      if (t.includes('WINDY') || t.includes('BREEZY')) return '💨'
      if (t.includes('FOG') || t.includes('HAZE') || t.includes('MIST') || t.includes('SMOKE')) return '🌫️'
      return '☁️'
    }

    const current = {
      temp: currentData.temperature?.degrees ?? 25,
      condition: currentData.weatherCondition?.description?.text ?? 'Cloudy',
      humidity: currentData.relativeHumidity ?? 80,
      windSpeed: currentData.wind?.speed?.value ?? 0,
      icon: mapTypeToEmoji(currentData.weatherCondition?.type),
    }

    const forecast = (forecastData.forecastHours ?? []).slice(0, 6).map((item: any) => ({
      hour: item.displayDateTime?.hours ?? 0,
      temp: item.temperature?.degrees ?? 25,
      condition: item.weatherCondition?.description?.text ?? 'Cloudy',
      icon: mapTypeToEmoji(item.weatherCondition?.type),
    }))

    const result = { current, forecast }
    setCache(cacheKey, result, 15 * 60 * 1000).catch(() => {}) // 15 min TTL
    return result
  } catch (err) {
    // Return cached weather if offline
    const cached = await getCache<{ current: GoogleWeatherData; forecast: GoogleForecastHour[] }>(cacheKey)
    if (cached) {
      console.log('[Offline] Returning cached weather data')
      return cached.data
    }
    throw err
  }
}