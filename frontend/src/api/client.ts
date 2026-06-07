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
} from './types'

// In dev, use Vite proxy (same origin) — avoids CORS and port mismatches
const API_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || 'http://localhost:8000')
const API_PREFIX = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${API_PREFIX}${path}`, {
    headers: { Accept: 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export function getRisk(lat: number, lng: number): Promise<RiskData> {
  return request(`/risk?lat=${lat}&lng=${lng}`)
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
