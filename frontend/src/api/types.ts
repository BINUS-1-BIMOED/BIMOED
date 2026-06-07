export type Severity = 'low' | 'moderate' | 'high' | 'critical'
export type ReportCategory = 'flood' | 'landslide' | 'blockage' | 'evacuation' | 'safe_zone' | 'other'
export type ValidationStatus = 'pending' | 'verified' | 'flagged'

export interface RiskData {
  score: number
  label: string
  rainfall_mm: number
  water_level_m: number
  river_discharge: number
  elevation_m: number
  computed_at: string
}

export interface RiskHistoryPoint {
  hour: number
  rainfall_mm: number
}

export interface Alert {
  id: number
  title: string
  location: string
  lat: number
  lng: number
  severity: string
  source: string
  description: string
  created_at: string
}

export interface SafeZone {
  id: number
  name: string
  lat: number
  lng: number
  capacity: number
  address: string
  distance_km?: number | null
}

export interface ReportPayload {
  category: ReportCategory
  severity: Severity
  lat: number
  lng: number
  description: string
  user_id?: string | null
}

export interface ReportResponse extends ReportPayload {
  id: number
  photo_url: string | null
  validation_status: ValidationStatus
  confidence: number
  created_at: string
}

export interface ReportValidation {
  report_id: number
  validation_status: ValidationStatus
  confidence: number
  reasons: string[]
}

export interface EvacuationRoute {
  destination: SafeZone
  distance_km: number
  duration_min: number
  geometry: [number, number][]
  steps: { instruction: string; distance_m: number; duration_s: number }[]
  risk_penalty_applied: boolean
}

export interface RiskGridPoint {
  lat: number
  lng: number
  score: number
  elevation_m?: number
}

export interface SyncBundle {
  region: string
  safe_zones: SafeZone[]
  recent_alerts: Alert[]
  risk_grid: RiskGridPoint[]
  dem_tiles: { id: string; bounds: number[]; resolution_m: number }[]
  last_sync: string
}
