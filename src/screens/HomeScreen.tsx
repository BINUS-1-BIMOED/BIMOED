import { useState, useEffect } from 'react'

interface HomeScreenProps {
  onNavigate: (screen: string) => void
}

const ActionIcon = ({ type }: { type: string }) => {
  const icons: Record<string, React.ReactNode> = {
    route: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>,
    report: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    safe: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    contacts: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  }
  return <>{icons[type]}</>
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
    if (level >= 80) return 'var(--danger)'
    if (level >= 60) return 'var(--warning)'
    if (level >= 40) return '#FBBF24'
    return 'var(--success)'
  }

  const getRiskLabel = (level: number) => {
    if (level >= 80) return 'Critical'
    if (level >= 60) return 'High'
    if (level >= 40) return 'Moderate'
    return 'Low'
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
    { id: 1, title: 'Deli River Overflowing', location: 'Medan Helvetia', time: '12 min', severity: 'critical' },
    { id: 2, title: 'Extreme Rainfall', location: 'Medan Denai', time: '28 min', severity: 'high' },
    { id: 3, title: 'Landslide Detected', location: 'Medan Tuntungan', time: '45 min', severity: 'high' },
  ]

  const actions = [
    { label: 'Evacuation Route', type: 'route', screen: 'route' },
    { label: 'Report Incident', type: 'report', screen: 'report' },
    { label: 'Safe Zone', type: 'safe', screen: 'safe' },
    { label: 'Emergency Contacts', type: 'contacts', screen: 'contacts' },
  ]

  return (
    <div className="page">
      <div className="page-header animate-fade-in">
        <div>
          <p className="page-eyebrow">Active location</p>
          <h1 className="page-title">Medan, North Sumatra</h1>
        </div>
        <button className="icon-btn" onClick={() => onNavigate('alert')} aria-label="Alerts">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="icon-btn-badge">3</span>
        </button>
      </div>

      <div
        className="risk-hero card animate-fade-in"
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${color} 8%, var(--bg-card)), var(--bg-card))`,
          borderColor: `color-mix(in srgb, ${color} 20%, var(--border))`,
          animationDelay: '0.05s'
        }}
        onClick={() => onNavigate('map')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="risk-hero-label">Flood risk</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
              <span className="risk-hero-value" style={{ color }}>{Math.round(riskLevel)}</span>
              <span className="risk-hero-unit" style={{ color }}>%</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span className={`risk-badge ${getRiskClass(riskLevel)}`}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: color,
                animation: riskLevel >= 60 ? 'pulse-dot 1.5s ease infinite' : 'none'
              }} />
              {getRiskLabel(riskLevel)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Updated {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div style={{ margin: '16px 0' }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${riskLevel}%`, background: color }}/>
          </div>
        </div>

        <div className="risk-stats">
          {[
            { label: 'Rainfall', value: '142mm' },
            { label: 'Water level', value: `${waterLevel}m` },
            { label: 'Danger zones', value: '3 areas' },
          ].map(stat => (
            <div key={stat.label} className="risk-stat">
              <div className="risk-stat-value">{stat.value}</div>
              <div className="risk-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card animate-fade-in" style={{ marginBottom: '20px', animationDelay: '0.1s' }}>
        <div className="section-header">
          <span className="section-title">12-hour rainfall</span>
          <span className="chip-live">Live</span>
        </div>
        <div className="sparkline">
          {rainfallData.map((val, i) => {
            const h = (val / maxRain) * 100
            const isLast = i === rainfallData.length - 1
            return (
              <div
                key={i}
                className={`sparkline-bar ${isLast ? 'active' : ''}`}
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>12h ago</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Now · {rainfallData[rainfallData.length - 1]}mm</span>
        </div>
      </div>

      <div className="animate-fade-in" style={{ marginBottom: '20px', animationDelay: '0.15s' }}>
        <div className="section-header">
          <span className="section-title">Active alerts</span>
          <button className="section-link" onClick={() => onNavigate('alert')}>View all</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.map(alert => (
            <div
              key={alert.id}
              className="list-item list-item-interactive list-item-accent"
              style={{ '--accent': alert.severity === 'critical' ? 'var(--danger)' : 'var(--warning)' } as React.CSSProperties}
              onClick={() => onNavigate('alert')}
            >
              <div className="list-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  {alert.severity === 'critical'
                    ? <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
                    : <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></>
                  }
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{alert.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{alert.location}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className={`risk-badge ${alert.severity}`} style={{ fontSize: '9px', padding: '3px 7px' }}>
                  {alert.severity === 'critical' ? 'Critical' : 'High'}
                </span>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{alert.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="section-header">
          <span className="section-title">Quick actions</span>
        </div>
        <div className="action-grid">
          {actions.map(action => (
            <button key={action.label} className="action-btn" onClick={() => onNavigate(action.screen)}>
              <div className="action-btn-icon">
                <ActionIcon type={action.type} />
              </div>
              <span className="action-btn-label">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
