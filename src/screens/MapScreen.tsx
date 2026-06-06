import { useState } from 'react'

interface MapScreenProps {
  onNavigate: (screen: string) => void
}

export default function MapScreen({ onNavigate }: MapScreenProps) {
  const [activeLayer, setActiveLayer] = useState('risk')
  const [selectedZone, setSelectedZone] = useState<number | null>(null)
  const [routeActive, setRouteActive] = useState(false)

  const zones = [
    { id: 1, x: 30, y: 35, risk: 'critical', label: 'Medan Helvetia', size: 52 },
    { id: 2, x: 55, y: 55, risk: 'high', label: 'Medan Kota', size: 44 },
    { id: 3, x: 72, y: 28, risk: 'moderate', label: 'Medan Tembung', size: 38 },
    { id: 4, x: 20, y: 65, risk: 'critical', label: 'Medan Denai', size: 46 },
    { id: 5, x: 48, y: 22, risk: 'high', label: 'Medan Sunggal', size: 40 },
  ]

  const safeZones = [
    { id: 1, x: 80, y: 70, label: 'GOR Pancing', capacity: '500 people' },
    { id: 2, x: 15, y: 20, label: 'Adam Malik Hospital', capacity: '200 people' },
    { id: 3, x: 65, y: 80, label: 'Merdeka Square', capacity: '1,200 people' },
  ]

  const riskColors: Record<string, string> = {
    critical: '#F87171',
    high: '#FBBF24',
    moderate: '#FBBF24',
    low: '#34D399',
  }

  const layers = [
    { id: 'risk', label: 'Risk' },
    { id: 'route', label: 'Route' },
    { id: 'safe', label: 'Safe zones' },
  ]

  const riskLabels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    moderate: 'Moderate',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="map-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="back-btn" onClick={() => onNavigate('home')} aria-label="Back">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="map-search">
            <svg width="14" height="14" fill="none" stroke="var(--text-muted)" strokeWidth="1.75" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span>Search location...</span>
          </div>
        </div>
        <div className="layer-tabs">
          {layers.map(layer => (
            <button
              key={layer.id}
              className={`layer-tab ${activeLayer === layer.id ? 'active' : ''}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', background: 'var(--map-bg)', overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: 11 }).map((_, i) => (
            <g key={i}>
              <line x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="rgba(128,128,128,0.1)" strokeWidth="0.3"/>
              <line x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="rgba(128,128,128,0.1)" strokeWidth="0.3"/>
            </g>
          ))}

          <path d="M 0 50 Q 30 48 50 50 Q 70 52 100 50" stroke="rgba(128,128,128,0.15)" strokeWidth="1.2" fill="none"/>
          <path d="M 50 0 Q 48 30 50 50 Q 52 70 50 100" stroke="rgba(128,128,128,0.15)" strokeWidth="1.2" fill="none"/>
          <ellipse cx="42" cy="52" rx="8" ry="4" fill="rgba(79,142,247,0.12)" stroke="rgba(79,142,247,0.2)" strokeWidth="0.3"/>

          {(activeLayer === 'risk' || activeLayer === 'route') && zones.map(zone => (
            <g key={zone.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedZone(zone.id === selectedZone ? null : zone.id)}>
              <circle
                cx={zone.x} cy={zone.y}
                r={zone.size / 10}
                fill={riskColors[zone.risk] + (selectedZone === zone.id ? '35' : '18')}
                stroke={riskColors[zone.risk]}
                strokeWidth="0.35"
              />
              <circle cx={zone.x} cy={zone.y} r="1.2" fill={riskColors[zone.risk]}/>
            </g>
          ))}

          {(activeLayer === 'route' || routeActive) && (
            <g>
              <path d="M 50 50 Q 60 45 70 40 Q 75 50 80 70" stroke="var(--primary)" strokeWidth="1" fill="none" strokeDasharray="2 1.5"/>
              <circle cx="50" cy="50" r="1.2" fill="var(--primary)"/>
              <circle r="0.9" fill="white" opacity="0.9">
                <animateMotion dur="3s" repeatCount="indefinite" path="M 50 50 Q 60 45 70 40 Q 75 50 80 70"/>
              </circle>
            </g>
          )}

          {(activeLayer === 'safe' || activeLayer === 'route') && safeZones.map(sz => (
            <g key={sz.id}>
              <circle cx={sz.x} cy={sz.y} r="3.5" fill="rgba(52,211,153,0.12)" stroke="var(--success)" strokeWidth="0.4"/>
            </g>
          ))}

          <g>
            <circle cx="50" cy="50" r="4" fill="rgba(79,142,247,0.12)" stroke="rgba(79,142,247,0.25)" strokeWidth="0.4">
              <animate attributeName="r" values="2.5;5;2.5" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="50" cy="50" r="1.5" fill="var(--primary)" stroke="white" strokeWidth="0.5"/>
          </g>
        </svg>

        {activeLayer === 'risk' && (
          <div style={{
            position: 'absolute', top: '12px', left: '12px',
            background: 'var(--bg-glass)', backdropFilter: 'blur(16px)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
          }}>
            {Object.entries(riskLabels).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: key !== 'moderate' ? '4px' : 0 }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: riskColors[key] }}/>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {selectedZone && (() => {
          const zone = zones.find(z => z.id === selectedZone)!
          return (
            <div className="animate-fade-in" style={{
              position: 'absolute', bottom: '12px', left: '12px', right: '12px',
              background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className={`risk-badge ${zone.risk}`} style={{ marginBottom: '6px', display: 'inline-flex' }}>
                    {riskLabels[zone.risk]}
                  </span>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{zone.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Water level: 0.8 – 2.3m</div>
                </div>
                <button className="btn-text" onClick={() => setSelectedZone(null)} style={{ fontSize: '18px', padding: '0 4px' }}>×</button>
              </div>
              <button
                className="btn-primary"
                style={{ marginTop: '12px', padding: '11px' }}
                onClick={() => { setRouteActive(true); setActiveLayer('route'); setSelectedZone(null) }}
              >
                Navigate evacuation route
              </button>
            </div>
          )
        })()}

        {routeActive && !selectedZone && (
          <div className="animate-fade-in" style={{
            position: 'absolute', bottom: '12px', left: '12px', right: '12px',
            background: 'var(--primary)', borderRadius: 'var(--radius-lg)',
            padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>Heading to safe zone</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>GOR Pancing — 2.4 km</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>Est. 8 min walk</div>
            </div>
            <button
              onClick={() => setRouteActive(false)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '7px 12px', color: 'white', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {activeLayer === 'safe' && (
        <div style={{ padding: '12px var(--page-pad)', background: 'var(--bg)', borderTop: '1px solid var(--border)', maxHeight: '180px', overflowY: 'auto' }}>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>Nearest safe zones</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {safeZones.map(sz => (
              <div key={sz.id} className="list-item" style={{ padding: '10px 12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{sz.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sz.capacity}</div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ padding: '5px 10px', fontSize: '11px' }}
                  onClick={() => { setActiveLayer('route'); setRouteActive(true) }}
                >
                  Navigate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
