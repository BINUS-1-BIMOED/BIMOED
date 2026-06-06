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
    { id: 1, x: 80, y: 70, label: 'GOR Pancing', capacity: '500 jiwa', icon: '🏟️' },
    { id: 2, x: 15, y: 20, label: 'RSUP Adam Malik', capacity: '200 jiwa', icon: '🏥' },
    { id: 3, x: 65, y: 80, label: 'Lapangan Merdeka', capacity: '1200 jiwa', icon: '⛺' },
  ]

  const riskColors: Record<string, string> = {
    critical: '#FF3B3B',
    high: '#FF8C00',
    moderate: '#FFCE00',
    low: '#00C48C',
  }

  const layers = [
    { id: 'risk', label: 'Risiko' },
    { id: 'route', label: 'Rute' },
    { id: 'safe', label: 'Zona Aman' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Map header */}
      <div style={{ padding: '12px 16px 8px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => onNavigate('home')}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', flexShrink: 0 }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cari lokasi atau zona aman...</span>
          </div>
        </div>
        {/* Layer tabs */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          {layers.map(layer => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '100px',
                border: 'none',
                background: activeLayer === layer.id ? 'var(--primary)' : 'var(--bg-elevated)',
                color: activeLayer === layer.id ? 'white' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', background: '#0D1420', overflow: 'hidden' }}>
        {/* Simulated map grid */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Grid lines */}
          {Array.from({ length: 11 }).map((_, i) => (
            <g key={i}>
              <line x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="0.3"/>
              <line x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="rgba(255,255,255,0.03)" strokeWidth="0.3"/>
            </g>
          ))}

          {/* Roads */}
          <path d="M 0 50 Q 30 48 50 50 Q 70 52 100 50" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none"/>
          <path d="M 50 0 Q 48 30 50 50 Q 52 70 50 100" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none"/>
          <path d="M 0 30 Q 25 28 45 35 Q 65 40 100 38" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" fill="none"/>
          <path d="M 20 0 Q 22 40 25 65 Q 28 85 30 100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" fill="none"/>
          <path d="M 70 0 Q 72 30 75 55 Q 78 75 80 100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" fill="none"/>

          {/* Water body */}
          <ellipse cx="42" cy="52" rx="8" ry="4" fill="rgba(0,102,255,0.15)" stroke="rgba(0,102,255,0.25)" strokeWidth="0.3"/>
          <path d="M 40 48 Q 48 45 55 50 Q 60 55 55 60 Q 48 65 40 60 Q 35 55 40 48" fill="rgba(0,102,255,0.1)" stroke="rgba(0,102,255,0.2)" strokeWidth="0.3"/>

          {/* Risk zones */}
          {(activeLayer === 'risk' || activeLayer === 'route') && zones.map(zone => (
            <g key={zone.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedZone(zone.id === selectedZone ? null : zone.id)}>
              <circle
                cx={zone.x} cy={zone.y}
                r={zone.size / 10}
                fill={riskColors[zone.risk] + (selectedZone === zone.id ? '40' : '20')}
                stroke={riskColors[zone.risk]}
                strokeWidth="0.4"
                strokeDasharray={zone.risk === 'critical' ? '1.5 0.8' : 'none'}
              />
              <circle cx={zone.x} cy={zone.y} r="1.4" fill={riskColors[zone.risk]}/>
            </g>
          ))}

          {/* Evacuation route */}
          {(activeLayer === 'route' || routeActive) && (
            <g>
              <path
                d="M 50 50 Q 60 45 70 40 Q 75 50 80 70"
                stroke="#0066FF"
                strokeWidth="1.2"
                fill="none"
                strokeDasharray="2.5 1.5"
                style={{ animation: 'none' }}
              />
              <circle cx="50" cy="50" r="1.5" fill="#0066FF"/>
              <polygon points="80,68 78,74 82,74" fill="#0066FF"/>
              {/* Animated dot along route */}
              <circle r="1.2" fill="white" opacity="0.9">
                <animateMotion
                  dur="3s"
                  repeatCount="indefinite"
                  path="M 50 50 Q 60 45 70 40 Q 75 50 80 70"
                />
              </circle>
            </g>
          )}

          {/* Safe zones */}
          {(activeLayer === 'safe' || activeLayer === 'route') && safeZones.map(sz => (
            <g key={sz.id}>
              <circle cx={sz.x} cy={sz.y} r="4" fill="rgba(0,196,140,0.15)" stroke="#00C48C" strokeWidth="0.5"/>
              <text x={sz.x} y={sz.y + 1} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '4px' }}>✚</text>
            </g>
          ))}

          {/* User location */}
          <g>
            <circle cx="50" cy="50" r="5" fill="rgba(0,102,255,0.15)" stroke="rgba(0,102,255,0.3)" strokeWidth="0.5">
              <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="50" cy="50" r="2" fill="#0066FF" stroke="white" strokeWidth="0.6"/>
          </g>
        </svg>

        {/* Compass */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: '50%',
          width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px'
        }}>🧭</div>

        {/* Legend */}
        {activeLayer === 'risk' && (
          <div style={{
            position: 'absolute', top: '12px', left: '12px',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '10px 12px',
          }}>
            {[
              { label: 'Kritis', color: '#FF3B3B' },
              { label: 'Tinggi', color: '#FF8C00' },
              { label: 'Sedang', color: '#FFCE00' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color, flexShrink: 0 }}/>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{l.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Selected zone panel */}
        {selectedZone && (() => {
          const zone = zones.find(z => z.id === selectedZone)!
          return (
            <div
              className="animate-fade-in"
              style={{
                position: 'absolute', bottom: '12px', left: '12px', right: '12px',
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${riskColors[zone.risk]}40`,
                borderRadius: '16px',
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className={`risk-badge ${zone.risk}`} style={{ marginBottom: '6px', display: 'inline-flex' }}>
                    {zone.risk === 'critical' ? '🔴 Kritis' : zone.risk === 'high' ? '🟠 Tinggi' : '🟡 Sedang'}
                  </span>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{zone.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Estimasi ketinggian air: 0.8 – 2.3m</div>
                </div>
                <button onClick={() => setSelectedZone(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>×</button>
              </div>
              <button
                className="btn-primary"
                style={{ marginTop: '12px', padding: '12px' }}
                onClick={() => { setRouteActive(true); setActiveLayer('route'); setSelectedZone(null) }}
              >
                🗺️ Navigasi Rute Evakuasi
              </button>
            </div>
          )
        })()}

        {/* Route active banner */}
        {routeActive && !selectedZone && (
          <div
            className="animate-fade-in"
            style={{
              position: 'absolute', bottom: '12px', left: '12px', right: '12px',
              background: 'rgba(0,102,255,0.9)',
              backdropFilter: 'blur(16px)',
              borderRadius: '16px',
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>Menuju Zona Aman</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'white', fontFamily: 'var(--font-display)' }}>GOR Pancing — 2.4 km</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>Est. 8 menit berjalan</div>
            </div>
            <button
              onClick={() => setRouteActive(false)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px', padding: '8px 14px', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Safe zones list */}
      {activeLayer === 'safe' && (
        <div style={{ padding: '14px 16px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', maxHeight: '200px', overflowY: 'auto' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Zona Aman Terdekat</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {safeZones.map(sz => (
              <div key={sz.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '22px' }}>{sz.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{sz.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kapasitas: {sz.capacity}</div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                  onClick={() => { setActiveLayer('route'); setRouteActive(true) }}
                >
                  Arahkan
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
