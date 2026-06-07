import { useCallback, useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getSyncBundle, getEvacuationRoute } from '../api/client'
import type { EvacuationRoute, RiskGridPoint, SafeZone } from '../api/types'
import { MapController, MapResizeFix } from '../components/MapController'
import { useLocation } from '../hooks/useLocation'
import { scoreToRiskClass } from '../utils/format'

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

const userIcon = L.divIcon({
  className: 'gmaps-user-marker',
  html: '<div class="gmaps-user-dot"><div class="gmaps-user-pulse"></div></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const safeZoneIcon = L.divIcon({
  className: 'gmaps-safe-marker',
  html: '<div class="gmaps-safe-pin"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 28],
})

export default function MapScreen({ onNavigate, initialMode = 'risk' }: MapScreenProps) {
  const { lat, lng } = useLocation()
  const dark = useMapTheme()
  const [activeLayer, setActiveLayer] = useState(initialMode)
  const [selectedZone, setSelectedZone] = useState<RiskGridPoint | null>(null)
  const [selectedSafe, setSelectedSafe] = useState<SafeZone | null>(null)
  const [routeActive, setRouteActive] = useState(false)
  const [riskGrid, setRiskGrid] = useState<RiskGridPoint[]>([])
  const [safeZones, setSafeZones] = useState<SafeZone[]>([])
  const [route, setRoute] = useState<EvacuationRoute | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [mapZoom, setMapZoom] = useState(14)

  const center: [number, number] = useMemo(() => [lat, lng], [lat, lng])

  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

  useEffect(() => {
    getSyncBundle(lat, lng)
      .then((bundle) => {
        setRiskGrid(bundle.risk_grid)
        setSafeZones(bundle.safe_zones)
      })
      .catch(() => {})
  }, [lat, lng])

  const startRoute = useCallback(async (dest?: SafeZone) => {
    setLoadingRoute(true)
    setRouteActive(true)
    setActiveLayer('route')
    setSelectedZone(null)
    try {
      const result = await getEvacuationRoute(lat, lng, dest?.lat, dest?.lng)
      setRoute(result)
      setSelectedSafe(result.destination)
    } catch {
      setRoute(null)
    } finally {
      setLoadingRoute(false)
    }
  }, [lat, lng])

  useEffect(() => {
    if (initialMode === 'route') startRoute()
  }, [initialMode, startRoute])

  const routePositions = route?.geometry.map((pt) => [pt[0], pt[1]] as [number, number]) ?? []

  const layers = [
    { id: 'risk' as const, label: 'Flood risk' },
    { id: 'route' as const, label: 'Route' },
    { id: 'safe' as const, label: 'Safe zones' },
  ]

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

        <Marker position={center} icon={userIcon} zIndexOffset={1000} />

        {(activeLayer === 'risk' || activeLayer === 'route') &&
          riskGrid.map((zone, idx) => {
            const risk = scoreToRiskClass(zone.score)
            const color = RISK_COLORS[risk]
            const radius = 180 + zone.score * 4
            return (
              <Circle
                key={`risk-${idx}`}
                center={[zone.lat, zone.lng]}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: selectedZone === zone ? 0.35 : 0.22,
                  weight: selectedZone === zone ? 3 : 1.5,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedZone(zone)
                    setSelectedSafe(null)
                  },
                }}
              />
            )
          })}

        {(activeLayer === 'safe' || activeLayer === 'route' || routeActive) &&
          safeZones.map((sz) => (
            <Marker
              key={sz.id}
              position={[sz.lat, sz.lng]}
              icon={safeZoneIcon}
              eventHandlers={{
                click: () => {
                  setSelectedSafe(sz)
                  setSelectedZone(null)
                },
              }}
            />
          ))}

        {(activeLayer === 'route' || routeActive) && routePositions.length > 0 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{ color: ROUTE_COLOR, weight: 7, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#ffffff', weight: 3, opacity: 0.6, dashArray: '8 12', lineCap: 'round' }}
            />
          </>
        )}
      </MapContainer>

      {/* Top overlay — Google Maps style */}
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
          <input type="text" readOnly value="Medan, North Sumatra" className="gmaps-search-input" />
        </div>
      </div>

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

      {activeLayer === 'risk' && (
        <div className="gmaps-legend">
          {Object.entries(RISK_LABELS).map(([key, label]) => (
            <div key={key} className="gmaps-legend-row">
              <span className="gmaps-legend-dot" style={{ background: RISK_COLORS[key] }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* FAB controls */}
      <div className="gmaps-fabs">
        <button className="gmaps-fab" onClick={() => setMapZoom((z) => Math.min(19, z + 1))} aria-label="Zoom in">+</button>
        <button className="gmaps-fab" onClick={() => setMapZoom((z) => Math.max(10, z - 1))} aria-label="Zoom out">−</button>
        <button className="gmaps-fab gmaps-fab-primary" onClick={() => setMapZoom(14)} aria-label="My location">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
        </button>
      </div>

      {/* Bottom sheets */}
      {selectedZone && (
        <div className="gmaps-bottom-sheet animate-fade-in">
          <div className="gmaps-sheet-handle" />
          <div className="gmaps-sheet-header">
            <div>
              <span className={`risk-badge ${scoreToRiskClass(selectedZone.score)}`}>
                {RISK_LABELS[scoreToRiskClass(selectedZone.score)]}
              </span>
              <h3 className="gmaps-sheet-title">Flood risk {selectedZone.score}%</h3>
              <p className="gmaps-sheet-sub">Elevation {selectedZone.elevation_m?.toFixed(1) ?? '—'}m · Tap route to evacuate</p>
            </div>
            <button className="gmaps-sheet-close" onClick={() => setSelectedZone(null)}>×</button>
          </div>
          <button className="btn-primary gmaps-sheet-action" onClick={() => startRoute()} disabled={loadingRoute}>
            {loadingRoute ? 'Calculating route…' : 'Directions to safe zone'}
          </button>
        </div>
      )}

      {selectedSafe && !routeActive && (
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
            {loadingRoute ? 'Calculating route…' : 'Start navigation'}
          </button>
        </div>
      )}

      {routeActive && route && (
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
              {route.risk_penalty_applied ? ' · avoiding flood zones' : ''}
            </p>
          </div>
          <button
            className="gmaps-route-stop"
            onClick={() => { setRouteActive(false); setRoute(null); setSelectedSafe(null) }}
          >
            End
          </button>
        </div>
      )}

      {activeLayer === 'safe' && !selectedSafe && !selectedZone && (
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
