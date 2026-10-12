import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAlerts, getGlobalDisasters, getMapsKey, getNearbyReports, getSyncBundle, peekCached, isOnline } from '../api/client'

import type { Alert, EvacuationRoute, GlobalDisasterEvent, ReportResponse, RiskGridPoint, SafeZone, SyncBundle } from '../api/types'
import { useLocation } from '../hooks/useLocation'
import { useNavigation } from '../hooks/useNavigation'
import { scoreToRiskClass, timeAgo } from '../utils/format'
import { formatDistance, formatDuration, haversineKm } from '../utils/geo'

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

const REPORT_EMOJI: Record<string, string> = {
  flood: '🌊',
  landslide: '⛰️',
  blockage: '🚧',
  evacuation: '🏃',
  safe_zone: '🛡️',
  other: '⚠️',
}

// Global disaster types the backend's /disasters endpoint can return — flood/wildfire/
// cyclone/volcano/drought come from GDACS; earthquake merges GDACS with P2P Earthquake
// Information's real-time Japan feed. "all" asks the backend for everything at once.
const DISASTER_TYPES: { id: string; label: string;}[] = [
  { id: 'all', label: 'All disasters'},
  { id: 'flood', label: 'Flood'},
  { id: 'earthquake', label: 'Earthquake'},
  { id: 'wildfire', label: 'Wildfire'},
  { id: 'cyclone', label: 'Cyclone / Storm'},
  { id: 'volcano', label: 'Volcano'},
  { id: 'drought', label: 'Drought'},
]

const DISASTER_EMOJI: Record<string, string> = {
  flood: '🌊',
  earthquake: '🫨',
  wildfire: '🔥',
  cyclone: '🌀',
  volcano: '🌋',
  drought: '☀️',
}

const DISASTER_ALERT_COLORS: Record<string, string> = {
  Red: '#EA4335',
  Orange: '#FB8C00',
  Green: '#34A853',
}

// ---- Google Maps 3D (Photorealistic 3D Tiles / "Map3DElement") ----
// Loaded dynamically with a key the backend hands back at runtime (kept in the
// backend's .env, not baked into this build). See backend/app/routers/config.py.
// There's no official type package for this (alpha) library yet, so its surface
// is typed as GAny below rather than sprinkling `any` throughout this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GAny = any

declare global {
  interface Window {
    google?: {
      maps: {
        importLibrary: (name: string) => Promise<GAny>
      }
    }
  }
}

let googleMapsLoadPromise: Promise<Window['google']> | null = null

function loadGoogleMaps(apiKey: string): Promise<Window['google']> {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google)
  if (googleMapsLoadPromise) return googleMapsLoadPromise
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const callbackName = '__bimoedGoogleMaps3DInit'
    ;(window as unknown as Record<string, () => void>)[callbackName] = () => resolve(window.google)
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=maps3d&callback=${callbackName}&loading=async`
    script.async = true
    script.onerror = () => {
      googleMapsLoadPromise = null
      reject(new Error('Failed to load Google Maps script'))
    }
    document.head.appendChild(script)
  })
  return googleMapsLoadPromise
}

interface Maps3DLibrary {
  Map3DElement: new (opts: Record<string, unknown>) => GAny
  Marker3DElement: new (opts: Record<string, unknown>) => GAny
  Marker3DInteractiveElement: new (opts: Record<string, unknown>) => GAny
  Polygon3DElement: new (opts: Record<string, unknown>) => GAny
  Polyline3DElement: new (opts: Record<string, unknown>) => GAny
}

// range = camera distance from the target, in meters. Mapped from our old 0-19
// "zoom level" scale so the rest of the UI (zoom FABs) didn't need to change —
// low values are a close-up street view, high values pull back far enough to
// see the whole Earth as a globe (like Google Earth's default zoomed-out view).
function zoomToRange(zoom: number): number {
  return 90 * Math.pow(2, 19 - zoom)
}

function zoomToTilt(zoom: number, navigating: boolean): number {
  // Navigation stays flat/top-down like a normal 2D map — only free browsing gets the
  // tilted 3D perspective.
  if (navigating) return 0
  return zoom >= 15 ? 55 : 0
}

function withAlpha(hex: string, opacity: number): string {
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

/** Organic blob polygon around a point — softer than square grid circles */
function organicBlobRing(lat: number, lng: number, radiusM: number, seed: number, segments = 14): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = []
  const latRad = (lat * Math.PI) / 180
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    const wobble = 0.62 + 0.38 * Math.sin(seed * 2.17 + i * 1.41)
    const r = radiusM * wobble
    const dLat = (r / 111320) * Math.cos(angle)
    const dLng = (r / (111320 * Math.cos(latRad))) * Math.sin(angle)
    points.push({ lat: lat + dLat, lng: lng + dLng })
  }
  return points
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

/** Compact dropdown for picking which disaster type the globe shows — a single
 * pill instead of a long row of chips, since the list now covers every GDACS
 * category plus earthquakes. */
function DisasterTypeMenu({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = DISASTER_TYPES.find((t) => t.id === value) ?? DISASTER_TYPES[0]

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="gmaps-disaster-menu" ref={rootRef}>
      <button className="gmaps-disaster-menu-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{current.emoji}</span>
        <span>{current.label}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="gmaps-disaster-menu-panel">
          {DISASTER_TYPES.map((t) => (
            <button
              key={t.id}
              className={`gmaps-disaster-menu-item ${t.id === value ? 'active' : ''}`}
              onClick={() => {
                onChange(t.id)
                setOpen(false)
              }}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Keeps a set of Google 3D elements (markers/polygons/polylines) in sync with a list of
 * items, diffed by key — creates new elements, updates existing ones in place, and removes
 * ones no longer present. Mirrors how the old MapLibre marker sync worked. */
function useElement3DSync<T>(
  mapRef: React.MutableRefObject<GAny>,
  ready: boolean,
  items: T[],
  opts: {
    key: (t: T) => string
    create: (t: T) => GAny
    update?: (el: GAny, t: T) => void
    onClick?: (t: T) => void
  },
) {
  const elementsRef = useRef<Map<string, GAny>>(new Map())
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const seen = new Set<string>()
    for (const item of items) {
      const key = optsRef.current.key(item)
      seen.add(key)
      let el = elementsRef.current.get(key)
      if (!el) {
        el = optsRef.current.create(item)
        if (optsRef.current.onClick) {
          el.addEventListener('gmp-click', () => optsRef.current.onClick?.(item))
        }
        map.append(el)
        elementsRef.current.set(key, el)
      } else if (optsRef.current.update) {
        optsRef.current.update(el, item)
      }
    }
    for (const [key, el] of elementsRef.current) {
      if (!seen.has(key)) {
        el.remove()
        elementsRef.current.delete(key)
      }
    }
  }, [mapRef, ready, items])

  useEffect(
    () => () => {
      for (const el of elementsRef.current.values()) el.remove()
      elementsRef.current.clear()
    },
    [],
  )
}

export default function MapScreen({ onNavigate, initialMode = 'risk' }: MapScreenProps) {
  const location = useLocation(true) // high accuracy for navigation
  const { lat, lng, heading, label: locationLabel } = location
  void heading
  const [activeLayer, setActiveLayer] = useState(initialMode)
  const [selectedZone, setSelectedZone] = useState<RiskGridPoint | null>(null)
  const [selectedSafe, setSelectedSafe] = useState<SafeZone | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [selectedReport, setSelectedReport] = useState<ReportResponse | null>(null)
  const [routeActive, setRouteActive] = useState(false)
  const [riskGrid, setRiskGrid] = useState<RiskGridPoint[]>([])
  const [safeZones, setSafeZones] = useState<SafeZone[]>([])
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([])
  const [liveReports, setLiveReports] = useState<ReportResponse[]>([])
  const [lastLiveSync, setLastLiveSync] = useState<number | null>(null)
  const [route, setRoute] = useState<EvacuationRoute | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  // Opens pulled back far enough to read as a spinning globe (not zoomed to the user's
  // dot) — tapping "my location" or starting navigation zooms in from there.
  const [mapZoom, setMapZoom] = useState(2)
  const [showDangerZones, setShowDangerZones] = useState(true)

  // ---- Global disaster tracker (the map's primary view) — local evacuation features
  // below (flood-risk grid, routing, safe zones) stay available as a secondary mode.
  const [globalMode, setGlobalMode] = useState(true)
  const [globalDisasterType, setGlobalDisasterType] = useState('all')
  const [globalDisasters, setGlobalDisasters] = useState<GlobalDisasterEvent[]>([])
  const [selectedDisaster, setSelectedDisaster] = useState<GlobalDisasterEvent | null>(null)

  // Navigation hook for turn-by-turn
  const navigation = useNavigation()

  // Track when navigation is active to use its route
  const isNavigating = navigation.active && navigation.route !== null

  // ---- Google 3D globe setup ----
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GAny>(null)
  const libRef = useRef<Maps3DLibrary | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)
  const initialCameraRef = useRef(true)
  const displayRiskGridRef = useRef<RiskGridPoint[]>([])
  const selectZoneRef = useRef<(z: RiskGridPoint) => void>(() => {})
  useEffect(() => {
    selectZoneRef.current = (z) => {
      setSelectedZone(z)
      setSelectedSafe(null)
    }
  })

  useEffect(() => {
    let cancelled = false
    getMapsKey()
      .then((key) => {
        if (cancelled) return
        if (!key) {
          setMapsError('Google Maps API key belum diisi di backend/.env (GOOGLE_MAPS_API_KEY).')
          return
        }
        return loadGoogleMaps(key)
      })
      .then((google) => {
        if (cancelled || !google || !containerRef.current) return
        return google.maps.importLibrary('maps3d').then((lib: Maps3DLibrary) => {
          if (cancelled || !containerRef.current) return
          libRef.current = lib
          const map = new lib.Map3DElement({
            center: { lat, lng, altitude: 0 },
            range: zoomToRange(mapZoom),
            tilt: zoomToTilt(mapZoom, false),
            mode: 'HYBRID',
            defaultUIHidden: true,
          })
          map.style.width = '100%'
          map.style.height = '100%'
          map.style.display = 'block'
          containerRef.current.appendChild(map)
          mapRef.current = map
          setMapReady(true)
        })
      })
      .catch((err) => {
        if (!cancelled) setMapsError(err?.message || 'Gagal memuat Google Maps 3D')
      })
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the camera following the user's position/zoom — dragging `range` way out
  // shows the whole Earth as a globe, exactly like pulling back in Google Earth.
  // While browsing the global disaster view, skip re-centering on GPS position so the
  // world view doesn't keep drifting back to the user's spot; zoom (range/tilt) still works.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (initialCameraRef.current) {
      initialCameraRef.current = false
      return
    }
    if (!globalMode) {
      map.center = { lat, lng, altitude: 0 }
    }
    map.range = zoomToRange(mapZoom)
    map.tilt = zoomToTilt(mapZoom, isNavigating)
  }, [lat, lng, mapZoom, isNavigating, mapReady, globalMode])

  // Only show current-hour forecast points on map (not +2h/+4h duplicates)
  const displayRiskGrid = useMemo(
    () => riskGrid.filter((z) => (z.hour_offset ?? 0) === 0),
    [riskGrid],
  )
  useEffect(() => {
    displayRiskGridRef.current = displayRiskGrid
  }, [displayRiskGrid])

  const rainZones = useMemo(
    () => displayRiskGrid.filter((z) => (z.rainfall_mm ?? 0) >= 0.5),
    [displayRiskGrid],
  )

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

  // Pull current world disaster events for the globe's primary view, refreshed on the
  // same cadence as local data (GDACS itself is cached ~15min on the backend).
  useEffect(() => {
    if (!globalMode) return
    let cancelled = false
    const load = () => {
      getGlobalDisasters(globalDisasterType)
        .then((events) => {
          if (!cancelled) setGlobalDisasters(events)
        })
        .catch(() => {})
    }
    load()
    const interval = window.setInterval(load, LIVE_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [globalMode, globalDisasterType])

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
  const routePositions = useMemo(
    () => activeRoute?.geometry.map((pt) => ({ lat: pt[0], lng: pt[1] })) ?? [],
    [activeRoute],
  )

  // ---- Flood Danger Zones (high risk areas to avoid) ----
  const dangerZones = useMemo(() => {
    return displayRiskGrid.filter((z) => z.score >= 65)
  }, [displayRiskGrid])

  // ---- Compute safe corridor (route segments that avoid flood) ----
  const safeRouteSegments = useMemo(() => {
    if (!activeRoute) return []
    const segments: { id: string; positions: { lat: number; lng: number }[]; safe: boolean }[] = []

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
        id: `seg-${i}`,
        positions: [{ lat: pt1[0], lng: pt1[1] }, { lat: pt2[0], lng: pt2[1] }],
        safe: !nearDanger,
      })
    }

    return segments
  }, [activeRoute, dangerZones])

  const layers = [
    { id: 'risk' as const, label: 'Flood risk' },
    { id: 'route' as const, label: 'Navigate' },
    { id: 'safe' as const, label: 'Safe zones' },
  ]

  const recenterToUser = useCallback(() => {
    setMapZoom(16)
  }, [])

  // Set zoom to 16 when navigating for a better view
  useEffect(() => {
    if (isNavigating && mapZoom < 15) {
      setMapZoom(15)
    }
  }, [isNavigating])

  // The "toggle danger zones" FAB (navigation only) hides the flood-risk overlay to
  // declutter the view while driving; outside navigation it has no effect.
  const riskShown =
    !globalMode && (activeLayer === 'risk' || activeLayer === 'route') && (!isNavigating || showDangerZones)
  const routeShown = !globalMode && (activeLayer === 'route' || routeActive)
  const showLegacyDanger = !globalMode && routeActive && activeLayer === 'risk'

  // ---- Risk zone polygons (extruded-free flat blobs, clamped to the ground) ----
  const riskPolygonItems = useMemo(
    () =>
      riskShown
        ? displayRiskGrid.map((zone, idx) => ({ zone, idx }))
        : [],
    [riskShown, displayRiskGrid],
  )
  useElement3DSync(mapRef, mapReady, riskPolygonItems, {
    key: ({ zone, idx }) => `risk-${idx}-${zone.lat}-${zone.lng}`,
    create: ({ zone, idx }) => {
      const lib = libRef.current!
      const risk = scoreToRiskClass(zone.score)
      const radiusM = 140 + zone.score * 3 + (zone.rainfall_mm ?? 0) * 25
      const opacity = zone.score >= 65 ? 0.32 : selectedZone === zone ? 0.34 : 0.2
      return new lib.Polygon3DElement({
        path: organicBlobRing(zone.lat, zone.lng, radiusM, idx + zone.score),
        fillColor: withAlpha(RISK_COLORS[risk], opacity),
        strokeColor: withAlpha(RISK_COLORS[risk], 0),
        altitudeMode: 'CLAMP_TO_GROUND',
        drawsOccludedSegments: true,
      })
    },
    update: (el, { zone, idx }) => {
      const risk = scoreToRiskClass(zone.score)
      const opacity = zone.score >= 65 ? 0.32 : selectedZone === zone ? 0.34 : 0.2
      const radiusM = 140 + zone.score * 3 + (zone.rainfall_mm ?? 0) * 25
      el.fillColor = withAlpha(RISK_COLORS[risk], opacity)
      el.path = organicBlobRing(zone.lat, zone.lng, radiusM, idx + zone.score)
    },
  })

  // ---- Tap targets for high-risk zones — opens the bottom sheet with route CTA ----
  const highRiskMarkerItems = useMemo(
    () => (riskShown ? displayRiskGrid.filter((z) => z.score >= 65) : []),
    [riskShown, displayRiskGrid],
  )
  useElement3DSync(mapRef, mapReady, highRiskMarkerItems, {
    key: (z) => `risk-tap-${z.lat}-${z.lng}`,
    create: (z) => {
      const lib = libRef.current!
      return new lib.Marker3DInteractiveElement({
        position: { lat: z.lat, lng: z.lng },
        altitudeMode: 'CLAMP_TO_GROUND',
        label: '⚠️',
      })
    },
    onClick: (z) => selectZoneRef.current(z),
  })

  // ---- Rain zone polygons ----
  const rainPolygonItems = useMemo(
    () => (riskShown ? rainZones.map((zone, idx) => ({ zone, idx })) : []),
    [riskShown, rainZones],
  )
  useElement3DSync(mapRef, mapReady, rainPolygonItems, {
    key: ({ zone, idx }) => `rain-${idx}-${zone.lat}-${zone.lng}`,
    create: ({ zone, idx }) => {
      const lib = libRef.current!
      const rainRadius = 100 + (zone.rainfall_mm ?? 0) * 45
      const opacity = 0.12 + Math.min(0.25, (zone.rainfall_mm ?? 0) / 20)
      return new lib.Polygon3DElement({
        path: organicBlobRing(zone.lat, zone.lng, rainRadius, idx * 3.7 + (zone.rainfall_mm ?? 0)),
        fillColor: withAlpha('#3B82F6', opacity),
        strokeColor: withAlpha('#3B82F6', 0),
        altitudeMode: 'CLAMP_TO_GROUND',
      })
    },
    update: (el, { zone, idx }) => {
      const rainRadius = 100 + (zone.rainfall_mm ?? 0) * 45
      const opacity = 0.12 + Math.min(0.25, (zone.rainfall_mm ?? 0) / 20)
      el.fillColor = withAlpha('#3B82F6', opacity)
      el.path = organicBlobRing(zone.lat, zone.lng, rainRadius, idx * 3.7 + (zone.rainfall_mm ?? 0))
    },
  })

  // ---- Rain intensity markers ----
  const rainyMarkerItems = useMemo(
    () => (riskShown ? rainZones.filter((z) => (z.rainfall_mm ?? 0) >= 2) : []),
    [riskShown, rainZones],
  )
  useElement3DSync(mapRef, mapReady, rainyMarkerItems, {
    key: (z) => `rainy-${z.lat.toFixed(5)}-${z.lng.toFixed(5)}`,
    create: (z) => {
      const lib = libRef.current!
      return new lib.Marker3DElement({
        position: { lat: z.lat, lng: z.lng },
        altitudeMode: 'CLAMP_TO_GROUND',
        label: '💧',
      })
    },
  })

  // ---- Live alerts ----
  const alertMarkerItems = useMemo(() => (globalMode ? [] : liveAlerts), [globalMode, liveAlerts])
  useElement3DSync(mapRef, mapReady, alertMarkerItems, {
    key: (a) => `alert-${a.id}`,
    create: (a) => {
      const lib = libRef.current!
      return new lib.Marker3DInteractiveElement({
        position: { lat: a.lat, lng: a.lng },
        altitudeMode: 'CLAMP_TO_GROUND',
        label: '🚨',
      })
    },
    onClick: (a) => setSelectedAlert(a),
  })

  // ---- Community-reported incidents ----
  const reportMarkerItems = useMemo(() => (riskShown ? liveReports : []), [riskShown, liveReports])
  useElement3DSync(mapRef, mapReady, reportMarkerItems, {
    key: (r) => `report-${r.id}-${r.validation_status}`,
    create: (r) => {
      const lib = libRef.current!
      return new lib.Marker3DInteractiveElement({
        position: { lat: r.lat, lng: r.lng },
        altitudeMode: 'CLAMP_TO_GROUND',
        label: REPORT_EMOJI[r.category] ?? REPORT_EMOJI.other,
      })
    },
    onClick: (r) => setSelectedReport(r),
  })

  // ---- Safe zones / destination ----
  const safeZoneMarkerItems = useMemo(
    () => (!globalMode && (activeLayer === 'safe' || activeLayer === 'route' || routeActive) ? safeZones : []),
    [globalMode, activeLayer, routeActive, safeZones],
  )
  useElement3DSync(mapRef, mapReady, safeZoneMarkerItems, {
    key: (sz) => `safe-${sz.id}-${activeRoute?.destination?.id === sz.id ? 'dest' : 'plain'}`,
    create: (sz) => {
      const lib = libRef.current!
      const isDestination = activeRoute?.destination?.id === sz.id
      return new lib.Marker3DInteractiveElement({
        position: { lat: sz.lat, lng: sz.lng },
        altitudeMode: 'CLAMP_TO_GROUND',
        label: isDestination ? '📍' : '🛡️',
      })
    },
    onClick: (sz) => {
      if (!isNavigating) {
        setSelectedSafe(sz)
        setSelectedZone(null)
      }
    },
  })

  // ---- Global disaster events (world view, GDACS-backed) ----
  const globalDisasterItems = useMemo(() => (globalMode ? globalDisasters : []), [globalMode, globalDisasters])
  useElement3DSync(mapRef, mapReady, globalDisasterItems, {
    key: (d) => `disaster-${d.id}`,
    create: (d) => {
      const lib = libRef.current!
      return new lib.Marker3DInteractiveElement({
        position: { lat: d.lat, lng: d.lng },
        altitudeMode: 'CLAMP_TO_GROUND',
        label: DISASTER_EMOJI[d.type] ?? '⚠️',
      })
    },
    onClick: (d) => setSelectedDisaster(d),
  })

  // ---- User position ----
  useElement3DSync(mapRef, mapReady, useMemo(() => [{ lat, lng }], [lat, lng]), {
    key: () => 'user',
    create: (p) => {
      const lib = libRef.current!
      return new lib.Marker3DElement({
        position: { lat: p.lat, lng: p.lng },
        altitudeMode: 'CLAMP_TO_GROUND',
        label: '🧭',
      })
    },
    update: (el, p) => {
      el.position = { lat: p.lat, lng: p.lng }
    },
  })

  // ---- Route line (built-in outer stroke gives the "shadow" look in one element) ----
  const routeLineItems = useMemo(
    () => (routeShown && routePositions.length > 0 ? [{ id: 'route' }] : []),
    [routeShown, routePositions],
  )
  useElement3DSync(mapRef, mapReady, routeLineItems, {
    key: (r) => r.id,
    create: () => {
      const lib = libRef.current!
      return new lib.Polyline3DElement({
        path: routePositions,
        strokeColor: ROUTE_COLOR,
        strokeWidth: 7,
        outerColor: '#1a5bbf',
        outerWidth: 0.35,
        altitudeMode: 'CLAMP_TO_GROUND',
        drawsOccludedSegments: true,
      })
    },
    update: (el) => {
      el.path = routePositions
    },
  })

  // ---- Legacy color-coded danger segments (shown when a route is active and the user
  // switches back to the "Flood risk" tab) ----
  const dangerSegmentItems = useMemo(
    () => (showLegacyDanger ? safeRouteSegments.filter((seg) => !seg.safe) : []),
    [showLegacyDanger, safeRouteSegments],
  )
  useElement3DSync(mapRef, mapReady, dangerSegmentItems, {
    key: (seg) => seg.id,
    create: (seg) => {
      const lib = libRef.current!
      return new lib.Polyline3DElement({
        path: seg.positions,
        strokeColor: withAlpha(DANGER_ZONE_COLOR, 0.7),
        strokeWidth: 7,
        altitudeMode: 'CLAMP_TO_GROUND',
      })
    },
    update: (el, seg) => {
      el.path = seg.positions
    },
  })

  return (
    <div className="gmaps-screen">
      <div ref={containerRef} className="gmaps-leaflet" />

      {mapsError && (
        <div className="gmaps-globe-error">
          <p>⚠️ {mapsError}</p>
        </div>
      )}

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
      {!isNavigating && !globalMode && lastLiveSync != null && (
        <LiveSyncBadge lastSync={lastLiveSync} />
      )}

      {/* ---- Mode Toggle: global disaster tracker (primary) vs local evacuation tools ---- */}
      {!isNavigating && (
        <div className="gmaps-mode-chips">
          <button className={`gmaps-chip ${globalMode ? 'active' : ''}`} onClick={() => setGlobalMode(true)}>
            🌍 World
          </button>
          <button className={`gmaps-chip ${!globalMode ? 'active' : ''}`} onClick={() => setGlobalMode(false)}>
            📍 Local
          </button>
        </div>
      )}

      {/* ---- Disaster Type Menu (global mode) ---- */}
      {!isNavigating && globalMode && (
        <DisasterTypeMenu value={globalDisasterType} onChange={setGlobalDisasterType} />
      )}

      {/* ---- Layer Chips (local mode) ---- */}
      {!isNavigating && !globalMode && (
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
      {!globalMode && activeLayer === 'risk' && !isNavigating && (
        <div className="gmaps-legend">
          {Object.entries(RISK_LABELS).map(([key, label]) => (
            <div key={key} className="gmaps-legend-row">
              <span className="gmaps-legend-dot" style={{ background: RISK_COLORS[key] }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {globalMode && !isNavigating && (
        <div className="gmaps-legend">
          {Object.entries(DISASTER_ALERT_COLORS).map(([level, color]) => (
            <div key={level} className="gmaps-legend-row">
              <span className="gmaps-legend-dot" style={{ background: color }} />
              <span>{level}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- FAB Controls ---- */}
      <div className="gmaps-fabs">
        <button className="gmaps-fab" onClick={() => setMapZoom((z) => Math.min(19, z + 1))} aria-label="Zoom in">+</button>
        <button className="gmaps-fab" onClick={() => setMapZoom((z) => Math.max(0, z - 1))} aria-label="Zoom out">−</button>
        <button
          className="gmaps-fab gmaps-fab-primary active-location"
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

      {selectedAlert && (
        <div className="gmaps-bottom-sheet animate-fade-in">
          <div className="gmaps-sheet-handle" />
          <div className="gmaps-sheet-header">
            <div>
              <span className="risk-badge critical">Alert</span>
              <h3 className="gmaps-sheet-title">🚨 {selectedAlert.title}</h3>
              <p className="gmaps-sheet-sub">{selectedAlert.description}</p>
              <p className="gmaps-sheet-sub">{selectedAlert.location} · {timeAgo(selectedAlert.created_at)}</p>
            </div>
            <button className="gmaps-sheet-close" onClick={() => setSelectedAlert(null)}>×</button>
          </div>
        </div>
      )}

      {selectedReport && (
        <div className="gmaps-bottom-sheet animate-fade-in">
          <div className="gmaps-sheet-handle" />
          <div className="gmaps-sheet-header">
            <div>
              <span className={`risk-badge ${selectedReport.validation_status === 'verified' ? 'low' : 'moderate'}`}>
                {selectedReport.validation_status === 'verified' ? 'Verified' : 'Unverified'}
              </span>
              <h3 className="gmaps-sheet-title">
                {REPORT_EMOJI[selectedReport.category] ?? '⚠️'} {selectedReport.category} report
              </h3>
              <p className="gmaps-sheet-sub">{selectedReport.description || 'No description'}</p>
              <p className="gmaps-sheet-sub">{timeAgo(selectedReport.created_at)}</p>
            </div>
            <button className="gmaps-sheet-close" onClick={() => setSelectedReport(null)}>×</button>
          </div>
        </div>
      )}

      {selectedDisaster && (
        <div className="gmaps-bottom-sheet animate-fade-in">
          <div className="gmaps-sheet-handle" />
          <div className="gmaps-sheet-header">
            <div>
              <span
                className="risk-badge"
                style={{ background: DISASTER_ALERT_COLORS[selectedDisaster.alert_level ?? ''] ?? '#5f6368', color: 'white' }}
              >
                {selectedDisaster.alert_level ?? 'Unknown'}
              </span>
              <h3 className="gmaps-sheet-title">
                {DISASTER_EMOJI[selectedDisaster.type] ?? '⚠️'} {selectedDisaster.title}
              </h3>
              <p className="gmaps-sheet-sub">{selectedDisaster.country}</p>
              {selectedDisaster.severity_text && (
                <p className="gmaps-sheet-sub">{selectedDisaster.severity_text}</p>
              )}
              {selectedDisaster.from_date && (
                <p className="gmaps-sheet-sub">
                  Sejak {new Date(selectedDisaster.from_date).toLocaleDateString('id-ID')}
                </p>
              )}
            </div>
            <button className="gmaps-sheet-close" onClick={() => setSelectedDisaster(null)}>×</button>
          </div>
          {selectedDisaster.url && (
            <a
              className="btn-primary gmaps-sheet-action"
              href={selectedDisaster.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              Lihat laporan GDACS
            </a>
          )}
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

      <div className="gmaps-attribution">© Google</div>
    </div>
  )
}
