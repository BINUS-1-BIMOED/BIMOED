import { useState, useEffect } from 'react'

interface HomeScreenProps {
  onNavigate: (screen: string) => void
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [riskLevel, setRiskLevel] = useState(78)
  const [rainfallData] = useState([42, 58, 35, 67, 89, 78, 95, 88, 72, 65, 80, 92])
  const [waterLevel] = useState(2.4)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setRiskLevel(prev => {
        const delta = (Math.random() - 0.4) * 3
        return Math.max(60, Math.min(95, prev + delta))
      })
      setLastUpdate(new Date())
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const getRiskColor = (level: number) => {
    if (level >= 80) return '#FF3B3B'
    if (level >= 60) return '#FF8C00'
    if (level >= 40) return '#FFCE00'
    return '#00C48C'
  }

  const getRiskLabel = (level: number) => {
    if (level >= 80) return 'KRITIS'
    if (level >= 60) return 'TINGGI'
    if (level >= 40) return 'SEDANG'
    return 'RENDAH'
  }

  const getRiskClass = (level: number) => {
    if (level >= 80) return 'critical'
    if (level >= 60) return 'high'
    if (level >= 40) return 'moderate'
    return 'low'
  }

  const color = getRiskColor(riskLevel)
  const maxRain = Math.max(...rainfallData)

  const alerts = [
    { id: 1, title: 'Sungai Deli Meluap', location: 'Medan Helvetia', time: '12 mnt', severity: 'critical', icon: '🌊' },
    { id: 2, title: 'Curah Hujan Ekstrem', location: 'Medan Denai', time: '28 mnt', severity: 'high', icon: '⛈️' },
    { id: 3, title: 'Longsor Terdeteksi', location: 'Medan Tuntungan', time: '45 mnt', severity: 'high', icon: '⚠️' },
  ]

  return (
    <div className="screen" style={{ padding: '16px' }}>
      {/* Header */}
      <div className="animate-fade-in" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Lokasi Aktif</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" fill="none" stroke="var(--primary)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Medan, Sumatera Utara</span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('alert')}
            style={{
              position: 'relative',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              width: '44px', height: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text)'
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              width: '16px', height: '16px',
              background: 'var(--danger)',
              borderRadius: '50%',
              fontSize: '9px', fontWeight: 800, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--bg)'
            }}>3</span>
          </button>
        </div>
      </div>

      {/* Main Risk Card */}
      <div
        className="animate-fade-in"
        style={{
          background: `linear-gradient(135deg, ${color}18, ${color}08)`,
          border: `1px solid ${color}30`,
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '16px',
          position: 'relative',
          overflow: 'hidden',
          animationDelay: '0.05s'
        }}
        onClick={() => onNavigate('map')}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '160px', height: '160px',
          background: `${color}20`,
          borderRadius: '50%',
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Risiko Banjir Saat Ini</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '56px', fontWeight: 800, color: color, fontFamily: 'var(--font-display)', lineHeight: 1, letterSpacing: '-2px' }}>{Math.round(riskLevel)}</span>
              <span style={{ fontSize: '20px', fontWeight: 600, color: color, opacity: 0.7 }}>%</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <span className={`risk-badge ${getRiskClass(riskLevel)}`}>
              <span style={{
                width: '6px', height: '6px',
                borderRadius: '50%',
                background: color,
                animation: riskLevel >= 60 ? 'pulse-dot 1.5s ease infinite' : 'none'
              }} />
              {getRiskLabel(riskLevel)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {lastUpdate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Risk gauge bar */}
        <div style={{ marginBottom: '16px' }}>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${riskLevel}%`,
                background: `linear-gradient(90deg, ${color}80, ${color})`
              }}
            />
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { label: 'Curah Hujan', value: '142mm', icon: '🌧' },
            { label: 'Ketinggian Air', value: `${waterLevel}m`, icon: '📊' },
            { label: 'Zona Bahaya', value: '3 Area', icon: '⚠️' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '12px',
                padding: '10px 8px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '16px', marginBottom: '4px' }}>{stat.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{stat.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tap hint */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '14px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ketuk untuk lihat peta</span>
          <svg width="12" height="12" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      {/* Rainfall Sparkline Card */}
      <div className="card animate-fade-in" style={{ marginBottom: '16px', animationDelay: '0.1s' }}>
        <div className="section-header">
          <span className="section-title">📈 Curah Hujan 12 Jam</span>
          <span className="chip" style={{ fontSize: '11px', padding: '3px 10px' }}>Live</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '52px' }}>
          {rainfallData.map((val, i) => {
            const h = (val / maxRain) * 100
            const isLast = i === rainfallData.length - 1
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: isLast
                    ? 'var(--primary)'
                    : `linear-gradient(180deg, rgba(0,102,255,${0.3 + i * 0.05}), rgba(0,102,255,0.15))`,
                  borderRadius: '4px 4px 2px 2px',
                  transition: 'height 0.5s ease',
                  position: 'relative'
                }}
              >
                {isLast && (
                  <div style={{
                    position: 'absolute', top: '-20px', left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--primary)',
                    color: 'white',
                    fontSize: '9px', fontWeight: 700,
                    padding: '2px 5px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap'
                  }}>{val}mm</div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>12 jam lalu</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sekarang</span>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <div className="section-header">
          <span className="section-title">🚨 Peringatan Aktif</span>
          <button className="section-link" onClick={() => onNavigate('alert')}>Lihat Semua</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alerts.map((alert, i) => (
            <div
              key={alert.id}
              className="card"
              style={{
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: '14px',
                cursor: 'pointer',
                border: alert.severity === 'critical' ? '1px solid rgba(255,59,59,0.2)' : '1px solid var(--border)',
                animationDelay: `${0.15 + i * 0.05}s`
              }}
              onClick={() => onNavigate('alert')}
            >
              <div style={{
                width: '42px', height: '42px',
                borderRadius: '12px',
                background: alert.severity === 'critical' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0
              }}>{alert.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>{alert.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📍 {alert.location}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className={`risk-badge ${alert.severity}`} style={{ fontSize: '10px', padding: '3px 8px', marginBottom: '4px', display: 'inline-flex' }}>
                  {alert.severity === 'critical' ? 'Kritis' : 'Tinggi'}
                </span>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{alert.time} lalu</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-in" style={{ marginTop: '20px', marginBottom: '8px', animationDelay: '0.3s' }}>
        <div className="section-header">
          <span className="section-title">Aksi Cepat</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Rute Evakuasi', icon: '🗺️', color: '#0066FF', screen: 'route' },
            { label: 'Lapor Kejadian', icon: '📢', color: '#FF8C00', screen: 'report' },
            { label: 'Zona Aman', icon: '🏥', color: '#00C48C', screen: 'safe' },
            { label: 'Kontak Darurat', icon: '📞', color: '#FF3B3B', screen: 'contacts' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.screen)}
              style={{
                background: `${action.color}14`,
                border: `1px solid ${action.color}25`,
                borderRadius: '16px',
                padding: '16px',
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '22px' }}>{action.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: action.color, fontFamily: 'var(--font-display)' }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
