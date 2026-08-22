import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getAlerts, getNearbyReports, getSyncBundle, peekCached, isOnline } from '../api/client'

import type { Alert, EvacuationRoute, ReportResponse, RiskGridPoint, SafeZone, SyncBundle } from '../api/types'
import { MapController, MapResizeFix } from '../components/MapController'
import { useLocation } from '../hooks/useLocation'
import { useNavigation } from '../hooks/useNavigation'
import { scoreToRiskClass, timeAgo } from '../utils/format'
import { formatDistance, formatDuration, haversineKm, bearing } from '../utils/geo'

// How often the map polls the backend for live conditions (alerts, reports, risk).
const LIVE_REFRESH_MS = 60_000

interface MapScreenProps {
  onNavigate: (screen: string) => void
  initialMode?: 'risk' | 'route' | 'safe'
}

const RISK_COLORS: Record<string, string> = {
  critical: '#EA4335',
  high: '#FBBC04',
  moderate: '#F9AB00',
  low: '#34A853',
}

const RISK_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
}

const ROUTE_COLOR = '#4285F4'
const DANGER_ZONE_COLOR = '#EA4335'

// ---- Custom icons ----

const userIcon = L.divIcon({
  className: 'gmaps-user-marker',
  html: `
    <div class="gmaps-user-marker-wrap">
      <div class="gmaps-user-arrow">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#4285F4" stroke="white" stroke-width="2">
          <path d="M12 2L12 22M12 2L6 10M12 2L18 10" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="gmaps-user-dot"></div>
      <div class="gmaps-user-pulse"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const userIconNavigating = L.divIcon({
  className: 'gmaps-user-marker navigating',
  html: `
    <div class="gmaps-user-marker-wrap">
      <div class="gmaps-user-arrow navigating-arrow">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#1A73E8" stroke="white" stroke-width="2">
          <path d="M12 2L12 22M12 2L6 10M12 2L18 10" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="gmaps-user-dot navigating-dot"></div>
      <div class="gmaps-user-pulse navigating-pulse"></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const safeZoneIcon = L.divIcon({
  className: 'gmaps-safe-marker',
  html: '<div class="gmaps-safe-pin"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 28],
})

const destinationIcon = L.divIcon({
  className: 'gmaps-dest-marker',
  html: `
    <div class="gmaps-dest-pin">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#EA4335" stroke="white" stroke-width="1.5">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="3" fill="white"/>
      </svg>
      <div class="gmaps-dest-pulse"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 28],
})

const rainyIcon = L.divIcon({
  className: 'gmaps-rainy-marker',
  html: '<div class="gmaps-rainy-dot"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

// ---- Live incident markers (real SOS/alert events reported or detected, not model output) ----
const ALERT_COLORS: Record<string, string> = {
  critical: '#EA4335',
  high: '#FB8C00',
  moderate: '#F9AB00',
  low: '#FBBC04',
}

function createAlertIcon(severity: string): L.DivIcon {
  const color = ALERT_COLORS[severity] || ALERT_COLORS.high
  return L.divIcon({
    className: 'gmaps-alert-marker',
    html: `
      <div class="gmaps-alert-pulse" style="background:${color}"></div>
      <div class="gmaps-alert-pin" style="background:${color}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

// ---- Community-reported incident markers (citizen reports, not computed risk) ----
const REPORT_EMOJI: Record<string, string> = {
  flood: '🌊',
  landslide: '⛰️',
  blockage: '🚧',
  evacuation: '🏃',
  safe_zone: '🛡️',
  other: '⚠️',
}

function createReportIcon(category: string, verified: boolean): L.DivIcon {
  const emoji = REPORT_EMOJI[category] || REPORT_EMOJI.other
  return L.divIcon({
    className: 'gmaps-report-marker',
    html: `<div class="gmaps-report-pin ${verified ? 'verified' : ''}">${emoji}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

/** Organic blob polygon around a point — softer than square grid circles */
function organicBlobRing(lat: number, lng: number, radiusM: number, seed: number, segments = 14): [number, number][] {
  const points: [number, number][] = []
  const latRad = (lat * Math.PI) / 180
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    const wobble = 0.62 + 0.38 * Math.sin(seed * 2.17 + i * 1.41)
    const r = radiusM * wobble
    const dLat = (r / 111320) * Math.cos(angle)
    const dLng = (r / (111320 * Math.cos(latRad))) * Math.sin(angle)
    points.push([lat + dLat, lng + dLng])
  }
  return points
}

// ---- Google Maps-like route arrow icon ----
function createRouteArrowIcon(heading: number): L.DivIcon {
  return L.divIcon({
    className: 'gmaps-route-arrow-marker',
    html: `
      <div class="gmaps-route-arrow" style="transform: rotate(${heading}deg)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#4285F4">
          <path d="M12 2L5 12h4v8h6v-8h4L12 2z"/>
        </svg>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

// ---- Step/marker icon for turn points ----
const stepMarkerIcon = L.divIcon({
  className: 'gmaps-step-marker',
  html: `
    <div class="gmaps-step-dot">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    </div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

/** Places directional arrows along a Polyline so the route shows travel direction (like Google Maps) */
function RouteArrows({ geometry }: { geometry: [number, number][] }) {
  if (geometry.length < 2) return null

  const markers: React.ReactNode[] = []
  // Place an arrow every ~300m along the route, plus one near the start
  const arrowInterval = 0.3 // km
  let accumulated = 0
  let lastArrowDist = -arrowInterval // ensure first arrow is placed near start

  for (let i = 0; i < geometry.length - 1; i++) {
    const [lat1, lng1] = geometry[i]
    const [lat2, lng2] = geometry[i + 1]
    const segLen = haversineKm(lat1, lng1, lat2, lng2)
    const brng = bearing(lat1, lng1, lat2, lng2)

    if (segLen < 0.001) continue

    // Place arrows along this segment
    let placed = 0
    while (placed * arrowInterval < segLen) {
      const frac = Math.min(1, ((placed * arrowInterval) / segLen))
      // Only place if we've accumulated enough distance since last arrow
      if (accumulated + frac * segLen - lastArrowDist >= arrowInterval * 0.8) {
        const midLat = lat1 + (lat2 - lat1) * frac
        const midLng = lng1 + (lng2 - lng1) * frac
        markers.push(
          <Marker
            key={`arrow-${i}-${placed}`}
            position={[midLat, midLng]}
            icon={createRouteArrowIcon(brng)}
            zIndexOffset={500}
            interactive={false}
          />
        )
        lastArrowDist = accumulated + frac * segLen
      }
      placed++
    }
    accumulated += segLen
  }

  return <>{markers}</>
}

function useMapTheme() {
  const [dark, setDark] = useState(
    () => document.querySelector('.phone-shell')?.getAttribute('data-theme') === 'dark',
  )

  useEffect(() => {
    const shell = document.querySelector('.phone-shell')
    if (!shell) return
    const obs = new MutationObserver(() => {
      setDark(shell.getAttribute('data-theme') === 'dark')
    })
    obs.observe(shell, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return dark
}

/** Small "Live" badge showing how recently risk/alert data was pulled from the backend. */
function LiveSyncBadge({ lastSync }: { lastSync: number }) {
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    const tick = () => setSecondsAgo(Math.max(0, Math.round((Date.now() - lastSync) / 1000)))
    tick()
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [lastSync])

  const label = secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.round(secondsAgo / 60)}m ago`

  return (
    <div className="gmaps-live-badge">
      <span className="gmaps-live-dot" />
      Live · updated {label}
    </div>
  )
}

export default function MapScreen({ onNavigate, initialMode = 'risk' }: MapScreenProps) {
  const location = useLocation(true) // high accuracy for navigation
  const { lat, lng, heading, label: locationLabel } = location
  const dark = useMapTheme()
  const [activeLayer, setActiveLayer] = useState(initialMode)
  const [selectedZone, setSelectedZone] = useState<RiskGridPoint | null>(null)
  const [selectedSafe, setSelectedSafe] = useState<SafeZone | null>(null)
  const [routeActive, setRouteActive] = useState(false)
  const [riskGrid, setRiskGrid] = useState<RiskGridPoint[]>([])
  const [safeZones, setSafeZones] = useState<SafeZone[]>([])
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([])
  const [liveReports, setLiveReports] = useState<ReportResponse[]>([])
  const [lastLiveSync, setLastLiveSync] = useState<number | null>(null)
  const [route, setRoute] = useState<EvacuationRoute | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [mapZoom, setMapZoom] = useState(15)
  const [followMode, setFollowMode] = useState(true) // auto-follow user
  const [showDangerZones, setShowDangerZones] = useState(true)

  // Navigation hook for turn-by-turn
  const navigation = useNavigation()

  // Track when navigation is active to use its route
  const isNavigating = navigation.active && navigation.route !== null

  const center: [number, number] = useMemo(() => [lat, lng], [lat, lng])

  // Only show current-hour forecast points on map (not +2h/+4h duplicates)
  const displayRiskGrid = useMemo(
    () => riskGrid.filter((z) => (z.hour_offset ?? 0) === 0),
    [riskGrid],
  )

  const rainZones = useMemo(
    () => displayRiskGrid.filter((z) => (z.rainfall_mm ?? 0) >= 0.5),
    [displayRiskGrid],
  )

  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

  const [offlineMap, setOfflineMap] = useState(false)

  void offlineMap

  // Keep latest position available to the polling interval without resubscribing it.
  const positionRef = useRef({ lat, lng })
  useEffect(() => {
    positionRef.current = { lat, lng }
  }, [lat, lng])

  // Pull current risk grid, safe zones, and real reported/detected incidents (SOS + AI alerts + community reports).
  const loadLiveData = useCallback((originLat: number, originLng: number) => {
    setOfflineMap(!isOnline())
    Promise.all([
      getSyncBundle(originLat, originLng),
      getAlerts(originLat, originLng),
      getNearbyReports(originLat, originLng, 8).catch(() => []),
    ])
      .then(([bundle, alerts, reports]) => {
        setRiskGrid(bundle.risk_grid)
        setSafeZones(bundle.safe_zones)
        setLiveAlerts(alerts)
        setLiveReports(reports.filter((r) => r.validation_status !== 'flagged'))
        setLastLiveSync(Date.now())
        setOfflineMap(false)
      })
      .catch(() => {
        if (!isOnline()) {
          setOfflineMap(true)
        }
      })
  }, [])

  // Paint the last saved risk grid/safe zones/alerts/reports immediately on
  // mount instead of an empty map while the live fetch is still in flight.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [bundle, alerts, reports] = await Promise.all([
        peekCached<SyncBundle>(`/sync/bundle?region=medan&lat=${lat}&lng=${lng}`),
        peekCached<Alert[]>(`/alerts?lat=${lat}&lng=${lng}&radius_km=15`),
        peekCached<ReportResponse[]>(`/reports/nearby?lat=${lat}&lng=${lng}&radius_km=8`),
      ])
      if (cancelled) return
      if (bundle) {
        setRiskGrid(bundle.risk_grid)
        setSafeZones(bundle.safe_zones)
      }
      if (alerts) setLiveAlerts(alerts)
      if (reports) setLiveReports(reports.filter((r) => r.validation_status !== 'flagged'))
    })()
    return () => { cancelled = true }
  }, [lat, lng])

  // Refresh whenever the user's position changes meaningfully.
  useEffect(() => {
    loadLiveData(lat, lng)
  }, [lat, lng, loadLiveData])

  // Also poll on a fixed cadence so conditions update even while stationary — this is what
  // makes the map "live" instead of a one-time snapshot from when the screen opened.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isOnline()) return
      loadLiveData(positionRef.current.lat, positionRef.current.lng)
    }, LIVE_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [loadLiveData])

  // Update navigation position in real-time
  useEffect(() => {
    if (navigation.active) {
      navigation.updatePosition(lat, lng, heading)
    }
  }, [lat, lng, heading, navigation.active])

  // Auto re-route when deviation detected
  useEffect(() => {
    if (navigation.deviationDetected && !navigation.rerouting) {
      const timer = setTimeout(() => {
        navigation.requestReroute(lat, lng)
      }, 2000) // wait 2s before rerouting to avoid false positives
      return () => clearTimeout(timer)
    }
  }, [navigation.deviationDetected, navigation.rerouting, lat, lng])

  const startRoute = useCallback(async (dest?: SafeZone) => {
    setLoadingRoute(true)
    setRouteActive(true)
    setActiveLayer('route')
    setSelectedZone(null)
    setFollowMode(true)

    try {
      // Use the navigation hook for turn-by-turn
      await navigation.startNavigation(lat, lng, dest)
      setRoute(navigation.route)
      if (navigation.route) {
        setSelectedSafe(navigation.route.destination)
      }
    } catch {
      setRoute(null)
    } finally {
      setLoadingRoute(false)
    }
  }, [lat, lng, navigation])

  // When navigation changes, sync the displayed route
  useEffect(() => {
    if (navigation.route) {
      setRoute(navigation.route)
      setSelectedSafe(navigation.route.destination)
    }
  }, [navigation.route])

  useEffect(() => {
    if (initialMode === 'route') startRoute()
  }, [initialMode, startRoute])

  // Get the active route geometry
  const activeRoute = navigation.route ?? route
  const routePositions = activeRoute?.geometry.map((pt) => [pt[0], pt[1]] as [number, number]) ?? []

  // ---- Flood Danger Zones (high risk areas to avoid) ----
  const dangerZones = useMemo(() => {
    return displayRiskGrid.filter((z) => z.score >= 65)
  }, [displayRiskGrid])

  // ---- Compute safe corridor (route segments that avoid flood) ----
  const safeRouteSegments = useMemo(() => {
    if (!activeRoute) return []
    const segments: { positions: [number, number][]; safe: boolean }[] = []

    for (let i = 0; i < activeRoute.geometry.length - 1; i++) {
      const pt1 = activeRoute.geometry[i]
      const pt2 = activeRoute.geometry[i + 1]

      // Check if this segment passes near a danger zone
      let nearDanger = false
      for (const dz of dangerZones) {
        const midLat = (pt1[0] + pt2[0]) / 2
        const midLng = (pt1[1] + pt2[1]) / 2
        const dist = haversineKm(midLat, midLng, dz.lat, dz.lng)
        if (dist < 0.3) {
          nearDanger = true
          break
        }
      }

      segments.push({
        positions: [[pt1[0], pt1[1]], [pt2[0], pt2[1]]] as [number, number][],
        safe: !nearDanger,
      })
    }

    return segments
  }, [activeRoute, dangerZones])

  // ---- Step/maneuver markers for turn-by-turn instructions (Google Maps style) ----
  const stepMarkers = useMemo(() => {
    if (!activeRoute?.steps || activeRoute.steps.length < 2) return []
    // Place a marker at the start of each step (turn point), skip first (it's the origin)
    const markers: { position: [number, number]; instruction: string; distance: number }[] = []
    let cumulativeDist = 0

    for (let i = 1; i < activeRoute.steps.length; i++) {
      const step = activeRoute.steps[i]
      // Estimate position: walk along geometry by cumulative distance
      const targetDist = cumulativeDist + step.distance_m / 1000
      let walked = 0
      for (let j = 0; j < activeRoute.geometry.length - 1; j++) {
        const [lat1, lng1] = activeRoute.geometry[j]
        const [lat2, lng2] = activeRoute.geometry[j + 1]
        const segLen = haversineKm(lat1, lng1, lat2, lng2)
        if (walked + segLen >= targetDist || j === activeRoute.geometry.length - 2) {
          const frac = segLen > 0 ? (targetDist - walked) / segLen : 0
          const pos: [number, number] = [
            lat1 + (lat2 - lat1) * Math.min(1, Math.max(0, frac)),
            lng1 + (lng2 - lng1) * Math.min(1, Math.max(0, frac)),
          ]
          markers.push({ position: pos, instruction: step.instruction, distance: step.distance_m })
          break
        }
        walked += segLen
      }
      cumulativeDist += step.distance_m / 1000
    }

    return markers
  }, [activeRoute])

  const layers = [
    { id: 'risk' as const, label: 'Flood risk' },
    { id: 'route' as const, label: 'Navigate' },
    { id: 'safe' as const, label: 'Safe zones' },
  ]

  // ---- Map follow mode - toggle when user manually pans ----


  const recenterToUser = useCallback(() => {
    setFollowMode(true)
    setMapZoom(16)
  }, [])

  // Set zoom to 16 when navigating for a better view
  useEffect(() => {
    if (isNavigating && mapZoom < 15) {
      setMapZoom(15)
    }
  }, [isNavigating])

  // ---- Destination coordinates for the final marker ----
  const destinationPos: [number, number] | null = activeRoute?.destination
    ? [activeRoute.destination.lat, activeRoute.destination.lng]
    : null

  return (
    <div className="gmaps-screen">
      <MapContainer
        center={center}
        zoom={mapZoom}
        className="gmaps-leaflet"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={tileUrl} maxZoom={19} />
        <MapController center={center} zoom={mapZoom} />
        <MapResizeFix />

        {/* ---- User Marker with heading rotation ---- */}
        <Marker
          position={center}
          icon={isNavigating ? userIconNavigating : userIcon}
          zIndexOffset={1000}
        />

        {/* ---- Flood risk — organic blob overlays from real weather data ---- */}
        {(activeLayer === 'risk' || activeLayer === 'route') &&
          displayRiskGrid.map((zone, idx) => {
            const risk = scoreToRiskClass(zone.score)
            const color = RISK_COLORS[risk]
            const radiusM = 140 + zone.score * 3 + (zone.rainfall_mm ?? 0) * 25
            const isHighRisk = zone.score >= 65
            const blob = organicBlobRing(zone.lat, zone.lng, radiusM, idx + zone.score)

            return (
              <Polygon
                key={`risk-${idx}`}
                positions={blob}
                pathOptions={{
                  color: 'transparent',
                  fillColor: color,
                  fillOpacity: isNavigating && isHighRisk ? 0.32 : selectedZone === zone ? 0.34 : 0.2,
                  weight: 0,
                  className: 'map-risk-blob',
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedZone(zone)
                    setSelectedSafe(null)
                  },
                }}
              >
                {isHighRisk && (
                  <Popup>
                    <div style={{ fontSize: '12px', fontWeight: 500 }}>
                      ⚠️ {RISK_LABELS[risk]} Flood Risk — {zone.score}%
                      <br />
                      <span style={{ color: '#5f6368', fontSize: '11px' }}>
                        Rain: {zone.rainfall_mm?.toFixed(1) ?? '0'}mm · Elevation {zone.elevation_m?.toFixed(1) ?? '—'}m
                      </span>
                    </div>
                  </Popup>
                )}
              </Polygon>
            )
          })}

        {/* ---- Rain zones — soft blue natural blobs ---- */}
        {(activeLayer === 'risk' || activeLayer === 'route') &&
          rainZones.map((zone, idx) => {
            const rainRadius = 100 + (zone.rainfall_mm ?? 0) * 45
            const blob = organicBlobRing(zone.lat, zone.lng, rainRadius, idx * 3.7 + (zone.rainfall_mm ?? 0))
            return (
              <Polygon
                key={`rain-${idx}`}
                positions={blob}
                pathOptions={{
                  color: 'transparent',
                  fillColor: '#3B82F6',
                  fillOpacity: 0.12 + Math.min(0.25, (zone.rainfall_mm ?? 0) / 20),
                  weight: 0,
                  className: 'map-rain-blob',
                }}
                interactive={false}
              />
            )
          })}

        {/* ---- Rain intensity markers at center of heavy rain ---- */}
        {(activeLayer === 'risk' || activeLayer === 'route') &&
          rainZones
            .filter((zone) => (zone.rainfall_mm ?? 0) >= 2)
            .map((zone, idx) => (
              <Marker
                key={`rainy-${idx}`}
                position={[zone.lat, zone.lng]}
                icon={rainyIcon}
                title={`Rain ${zone.rainfall_mm?.toFixed(1)}mm · Risk ${zone.score}%`}
              />
            ))}

        {/* ---- Live alerts — real SOS emergencies & AI-detected high-risk events, not computed heuristics ---- */}
        {liveAlerts.map((alert) => (
          <Marker
            key={`alert-${alert.id}`}
            position={[alert.lat, alert.lng]}
            icon={createAlertIcon(alert.severity)}
            zIndexOffset={800}
          >
            <Popup>
              <div style={{ fontSize: '12px', fontWeight: 500 }}>
                🚨 {alert.title}
                <br />
                <span style={{ color: '#5f6368', fontSize: '11px' }}>
                  {alert.description}
                  <br />
                  {alert.location} · {timeAgo(alert.created_at)}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ---- Community-reported incidents — real citizen reports, filtered to non-flagged ---- */}
        {(activeLayer === 'risk' || activeLayer === 'route') &&
          liveReports.map((report) => (
            <Marker
              key={`report-${report.id}`}
              position={[report.lat, report.lng]}
              icon={createReportIcon(report.category, report.validation_status === 'verified')}
              zIndexOffset={400}
            >
              <Popup>
                <div style={{ fontSize: '12px', fontWeight: 500 }}>
                  {REPORT_EMOJI[report.category] ?? '⚠️'} {report.category} report
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: '10px',
                      fontWeight: 600,
                      color: report.validation_status === 'verified' ? '#34A853' : '#F9AB00',
                    }}
                  >
                    {report.validation_status === 'verified' ? 'Verified' : 'Unverified'}
                  </span>
                  <br />
                  <span style={{ color: '#5f6368', fontSize: '11px' }}>
                    {report.description || 'No description'}
                    <br />
                    {timeAgo(report.created_at)}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* ---- Safe Zones / Evacuation Centers ---- */}
        {(activeLayer === 'safe' || activeLayer === 'route' || routeActive) &&
          safeZones.map((sz) => {
            const isDestination = activeRoute?.destination?.id === sz.id
            return (
              <Marker
                key={sz.id}
                position={[sz.lat, sz.lng]}
                icon={isDestination ? destinationIcon : safeZoneIcon}
                zIndexOffset={isDestination ? 900 : 0}
                eventHandlers={{
                  click: () => {
                    if (!isNavigating) {
                      setSelectedSafe(sz)
                      setSelectedZone(null)
                    }
                  },
                }}
              >
                {isDestination && (
                  <Popup>
                    <div style={{ fontSize: '12px', fontWeight: 500 }}>
                      📍 {sz.name}
                      <br />
                      <span style={{ color: '#5f6368', fontSize: '11px' }}>
                        Your destination
                      </span>
                    </div>
                  </Popup>
                )}
              </Marker>
            )
          })}

        {/* ---- Google Maps-style Route with thick blue line, direction arrows & step markers ---- */}
        {(activeLayer === 'route' || routeActive) && routePositions.length > 0 && (
          <>
            {/* Route shadow (dark outline for contrast) */}
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: '#1a5bbf',
                weight: 11,
                opacity: 0.4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />

            {/* Main thick blue route line (Google Maps style) */}
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: ROUTE_COLOR,
                weight: 7,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />

            {/* Direction arrows along the route (Google Maps style) */}
            <RouteArrows geometry={activeRoute?.geometry ?? []} />

            {/* Step maneuver markers at turn points */}
            {stepMarkers.map((sm, idx) => (
              <Marker
                key={`step-${idx}`}
                position={sm.position}
                icon={stepMarkerIcon}
                zIndexOffset={600}
                interactive={false}
              >
                <Popup>
                  <div style={{ fontSize: '12px', fontWeight: 500, maxWidth: '200px' }}>
                    {sm.instruction}
                    <br />
                    <span style={{ color: '#5f6368', fontSize: '11px' }}>
                      {formatDistance(sm.distance)}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Destination marker pin */}
            {destinationPos && (
              <Marker
                position={destinationPos}
                icon={destinationIcon}
                zIndexOffset={900}
                interactive={false}
              >
                <Popup>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>
                    📍 {activeRoute?.destination.name ?? 'Destination'}
                    <br />
                    <span style={{ color: '#5f6368', fontSize: '11px' }}>
                      {activeRoute?.distance_km} km · ~{Math.round(activeRoute?.duration_min ?? 0)} min
                    </span>
                  </div>
                </Popup>
              </Marker>
            )}
          </>
        )}

        {/* ---- Legacy color-coded safe/danger segments (used when flood zones are visible) ---- */}
        {(activeLayer === 'route' || routeActive) && safeRouteSegments.length > 0 && activeLayer === 'risk' && (
          <>
            {/* Danger/avoidance segments */}
            {safeRouteSegments
              .filter((seg) => !seg.safe)
              .map((seg, idx) => (
                <Polyline
                  key={`danger-seg-${idx}`}
                  positions={seg.positions}
                  pathOptions={{
                    color: DANGER_ZONE_COLOR,
                    weight: 7,
                    opacity: 0.7,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: '6 8',
                  }}
                />
              ))}
          </>
        )}
      </MapContainer>

      {/* ---- Top Bar ---- */}
      <div className="gmaps-top-bar">
        <button className="gmaps-round-btn" onClick={() => onNavigate('home')} aria-label="Back">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="gmaps-search-pill">
          <svg width="18" height="18" fill="none" stroke="#5f6368" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" readOnly value={locationLabel} className="gmaps-search-input" />
        </div>
      </div>

      {/* ---- Live sync indicator ---- */}
      {!isNavigating && lastLiveSync != null && (
        <LiveSyncBadge lastSync={lastLiveSync} />
      )}

      {/* ---- Layer Chips ---- */}
      {!isNavigating && (
        <div className="gmaps-layer-chips">
          {layers.map((layer) => (
            <button
              key={layer.id}
              className={`gmaps-chip ${activeLayer === layer.id ? 'active' : ''}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              {layer.label}
            </button>
          ))}
        </div>
      )}

      {/* ---- Legend ---- */}
      {activeLayer === 'risk' && !isNavigating && (
        <div className="gmaps-legend">
          {Object.entries(RISK_LABELS).map(([key, label]) => (
            <div key={key} className="gmaps-legend-row">
              <span className="gmaps-legend-dot" style={{ background: RISK_COLORS[key] }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- FAB Controls ---- */}
      <div className="gmaps-fabs">
        <button className="gmaps-fab" onClick={() => setMapZoom((z) => Math.min(19, z + 1))} aria-label="Zoom in">+</button>
        <button className="gmaps-fab" onClick={() => setMapZoom((z) => Math.max(10, z - 1))} aria-label="Zoom out">−</button>
        <button
          className={`gmaps-fab gmaps-fab-primary ${followMode ? 'active-location' : ''}`}
          onClick={recenterToUser}
          aria-label="My location"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
        </button>
        {isNavigating && (
          <button
            className="gmaps-fab gmaps-fab-toggle"
            onClick={() => setShowDangerZones(!showDangerZones)}
            aria-label="Toggle danger zones"
            style={{ background: showDangerZones ? '#EA4335' : '#5f6368' }}
          >
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4M12 2l-4 4M12 2l4 4M12 22l-4-4M12 22l4-4"/>
            </svg>
          </button>
        )}
      </div>

      {/* ---- Deviation Warning Banner ---- */}
      {navigation.deviationDetected && !navigation.rerouting && (
        <div className="gmaps-deviation-warning animate-fade-in">
          <div className="gmaps-deviation-icon">
            <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="gmaps-deviation-text">
            <strong>Route deviation detected</strong>
            <span>Recalculating safer route…</span>
          </div>
        </div>
      )}

      {/* ---- Re-routing Indicator ---- */}
      {navigation.rerouting && (
        <div className="gmaps-rerouting-indicator animate-fade-in">
          <div className="gmaps-rerouting-spinner" />
          <span>Finding safer route around flood zones…</span>
        </div>
      )}

      {/* ---- Stale Route Indicator: last known route shown while retrying in the background ---- */}
      {navigation.stale && !navigation.rerouting && (
        <div className="gmaps-rerouting-indicator animate-fade-in">
          <div className="gmaps-rerouting-spinner" />
          <span>Showing last known route — reconnecting…</span>
        </div>
      )}

      {/* ---- Turn-by-Turn Navigation Banner (active navigation) ---- */}
      {isNavigating && !navigation.deviationDetected && (
        <div className="gmaps-navigation-banner animate-fade-in">
          <div className="gmaps-nav-progress-bar">
            <div
              className="gmaps-nav-progress-fill"
              style={{ width: `${navigation.progressPercent}%` }}
            />
          </div>
          <div className="gmaps-nav-top-row">
            <div className="gmaps-nav-instruction-icon">
              <svg width="24" height="24" fill="none" stroke="#1A73E8" strokeWidth="2" viewBox="0 0 24 24">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
            </div>
            <div className="gmaps-nav-instruction-text">
              <p className="gmaps-nav-step">{navigation.nextInstruction}</p>
              <p className="gmaps-nav-step-dist">
                {formatDistance(navigation.nextInstructionDistance)} remaining
              </p>
            </div>
            <button className="gmaps-nav-more-btn" onClick={navigation.stopNavigation} aria-label="Stop navigation">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          </div>

          <div className="gmaps-nav-bottom-row">
            <div className="gmaps-nav-info-block">
              <span className="gmaps-nav-info-value">{formatDistance(navigation.distanceRemainingKm * 1000)}</span>
              <span className="gmaps-nav-info-label">Distance</span>
            </div>
            <div className="gmaps-nav-info-block">
              <span className="gmaps-nav-info-value">{formatDuration(navigation.durationRemainingMin)}</span>
              <span className="gmaps-nav-info-label">ETA</span>
            </div>
            <div className="gmaps-nav-info-block">
              <span className="gmaps-nav-info-value">{Math.round(navigation.progressPercent)}%</span>
              <span className="gmaps-nav-info-label">Progress</span>
            </div>
          </div>
        </div>
      )}

      {/* ---- Bottom Sheets ---- */}
      {selectedZone && !isNavigating && (
        <div className="gmaps-bottom-sheet animate-fade-in">
          <div className="gmaps-sheet-handle" />
          <div className="gmaps-sheet-header">
            <div>
              <span className={`risk-badge ${scoreToRiskClass(selectedZone.score)}`}>
                {RISK_LABELS[scoreToRiskClass(selectedZone.score)]}
              </span>
              <h3 className="gmaps-sheet-title">Flood risk {selectedZone.score}%</h3>
              <p className="gmaps-sheet-sub">
                Elevation {selectedZone.elevation_m?.toFixed(1) ?? '—'}m
                {(selectedZone.rainfall_mm ?? 0) > 0 ? ` · Rain ${selectedZone.rainfall_mm?.toFixed(1)}mm` : ''}
                {' · '}Tap route to evacuate
              </p>
              {selectedZone.score >= 65 && (
                <p className="gmaps-sheet-warning">⚠️ High risk area — choose a safe route</p>
              )}
            </div>
            <button className="gmaps-sheet-close" onClick={() => setSelectedZone(null)}>×</button>
          </div>
          <button className="btn-primary gmaps-sheet-action" onClick={() => startRoute()} disabled={loadingRoute}>
            {loadingRoute ? 'Finding safest route…' : 'Navigate to safe zone'}
          </button>
        </div>
      )}

      {selectedSafe && !routeActive && !isNavigating && (
        <div className="gmaps-bottom-sheet animate-fade-in">
          <div className="gmaps-sheet-handle" />
          <div className="gmaps-sheet-header">
            <div>
              <span className="risk-badge low">Safe zone</span>
              <h3 className="gmaps-sheet-title">{selectedSafe.name}</h3>
              <p className="gmaps-sheet-sub">
                {selectedSafe.capacity} capacity · {selectedSafe.distance_km?.toFixed(1) ?? '?'} km away
              </p>
              <p className="gmaps-sheet-sub">{selectedSafe.address}</p>
            </div>
            <button className="gmaps-sheet-close" onClick={() => setSelectedSafe(null)}>×</button>
          </div>
          <button className="btn-primary gmaps-sheet-action" onClick={() => startRoute(selectedSafe)} disabled={loadingRoute}>
            {loadingRoute ? 'Finding safest route…' : 'Start navigation'}
          </button>
        </div>
      )}

      {/* ---- Route Active Banner (legacy, non-navigation) ---- */}
      {routeActive && route && !isNavigating && (
        <div className="gmaps-route-banner animate-fade-in">
          <div className="gmaps-route-icon">
            <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          </div>
          <div className="gmaps-route-info">
            <p className="gmaps-route-label">{loadingRoute ? 'Calculating…' : 'Evacuation route'}</p>
            <p className="gmaps-route-dest">{route.destination.name}</p>
            <p className="gmaps-route-meta">
              {route.distance_km} km · ~{Math.round(route.duration_min)} min
              {route.risk_penalty_applied ? ' · avoiding flood/rain zones' : ''}
              {route.route_strategy ? ` · ${route.route_strategy}` : ''}
            </p>
          </div>
          <button
            className="gmaps-route-stop"
            onClick={() => { setRouteActive(false); setRoute(null); setSelectedSafe(null); navigation.stopNavigation() }}
          >
            End
          </button>
        </div>
      )}

      {/* ---- Safe Zone List ---- */}
      {activeLayer === 'safe' && !selectedSafe && !selectedZone && !isNavigating && (
        <div className="gmaps-safe-list animate-fade-in">
          <p className="gmaps-safe-list-title">Nearest evacuation centers</p>
          {safeZones.map((sz) => (
            <button key={sz.id} className="gmaps-safe-list-item" onClick={() => setSelectedSafe(sz)}>
              <div className="gmaps-safe-list-icon">🛡️</div>
              <div className="gmaps-safe-list-text">
                <strong>{sz.name}</strong>
                <span>{sz.distance_km?.toFixed(1)} km · {sz.capacity} capacity</span>
              </div>
              <span className="gmaps-safe-list-arrow">›</span>
            </button>
          ))}
        </div>
      )}

      <div className="gmaps-attribution">© OpenStreetMap · © CARTO</div>
    </div>
  )
}