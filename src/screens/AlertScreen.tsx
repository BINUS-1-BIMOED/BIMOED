import { useState } from 'react'

interface AlertScreenProps {
  onNavigate: (screen: string) => void
}

export default function AlertScreen({ onNavigate }: AlertScreenProps) {
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<number | null>(1)

  const alerts = [
    {
      id: 1,
      title: 'Critical flood — Deli River',
      subtitle: 'Water level reached 2.8m, exceeding Alert Level III',
      location: 'Medan Helvetia',
      time: '12 min ago',
      severity: 'critical',
      detail: 'The Deli River reached 2.8m at 2:30 PM. BNPB recommends immediate evacuation for residents within a 500m radius. 3 evacuation points opened at GOR Pancing, Merdeka Square, and Adam Malik Hospital.',
      source: 'BNPB + IoT Sensor #DL-12',
      confidence: 94,
      affected: '~1,200 households',
    },
    {
      id: 2,
      title: 'Extreme rainfall warning',
      subtitle: 'BMKG: Potential rainfall >100mm in 3 hours',
      location: 'All of Medan City',
      time: '28 min ago',
      severity: 'high',
      detail: 'BMKG issued an extreme rainfall warning with an estimated 100–150mm in 3 hours. Flash flooding is possible in low-lying areas.',
      source: 'BMKG Official Feed',
      confidence: 88,
      affected: 'Entire city',
    },
    {
      id: 3,
      title: 'Landslide risk',
      subtitle: 'Water-saturated soil on eastern slopes',
      location: 'Medan Tuntungan',
      time: '45 min ago',
      severity: 'high',
      detail: 'Soil movement sensors detected increased pressure on slopes in Tuntungan District. Residents on slopes are urged to remain vigilant.',
      source: 'Geophysics Sensor + Community',
      confidence: 76,
      affected: '~340 households',
    },
    {
      id: 4,
      title: 'Road flooded',
      subtitle: 'Gatot Subroto Street impassable',
      location: 'Medan Petisah',
      time: '1 hour ago',
      severity: 'moderate',
      detail: 'Community reports show 40–60cm flooding on Gatot Subroto Street. Avoid this route for now.',
      source: 'Community Report (Verified)',
      confidence: 91,
      affected: 'Road users',
    },
    {
      id: 5,
      title: 'Tangga Dam Alert Level I',
      subtitle: 'Water flow increasing, potential release',
      location: 'Upper Asahan River',
      time: '2 hours ago',
      severity: 'high',
      detail: 'Tangga Hydroelectric Plant entered Alert Level I. A planned water release may occur within 4–6 hours.',
      source: 'PLN / Inalum Monitoring',
      confidence: 82,
      affected: 'Riverbanks',
    },
    {
      id: 6,
      title: 'Evacuation center opened',
      subtitle: 'GOR Pancing ready for 500 evacuees',
      location: 'Jl. William Iskandar',
      time: '3 hours ago',
      severity: 'info',
      detail: 'BPBD Medan City opened an evacuation center at GOR Pancing with clean water, kitchen, and medical staff.',
      source: 'BPBD Medan City',
      confidence: 100,
      affected: 'Affected residents',
    },
  ]

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'critical', label: 'Critical' },
    { id: 'high', label: 'High' },
    { id: 'moderate', label: 'Moderate' },
    { id: 'info', label: 'Info' },
  ]

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter)

  const severityLabels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    moderate: 'Moderate',
    info: 'Info',
  }

  const activeCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length

  return (
    <div>
      <div className="screen-top">
        <button className="back-btn" onClick={() => onNavigate('home')} aria-label="Back">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">{activeCount} active warnings</p>
        </div>
        <span className="chip-live">Live</span>
      </div>

      <div className="scroll-row" style={{ padding: '0 var(--page-pad) 16px' }}>
        {filters.map(f => (
          <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 var(--page-pad) 24px' }}>
        {filtered.map((alert, i) => {
          const isExpanded = expandedId === alert.id
          return (
            <div
              key={alert.id}
              className="alert-card animate-fade-in"
              style={{ animationDelay: `${i * 0.04}s` }}
              onClick={() => setExpandedId(isExpanded ? null : alert.id)}
            >
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.35 }}>{alert.title}</span>
                  <span className={`risk-badge ${alert.severity}`} style={{ fontSize: '9px', padding: '3px 7px', flexShrink: 0 }}>
                    {severityLabels[alert.severity]}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{alert.subtitle}</p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{alert.location}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{alert.time}</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-subtle)' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: '12px', marginBottom: '12px' }}>
                    {alert.detail}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                    {[
                      { label: 'Source', value: alert.source },
                      { label: 'Confidence', value: `${alert.confidence}%` },
                      { label: 'Affected', value: alert.affected },
                      { label: 'Status', value: 'Verified' },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>{m.label}</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button className="btn-ghost" style={{ width: '100%', textAlign: 'center' }}>Share</button>
                    <button
                      className="btn-primary"
                      style={{ padding: '10px', fontSize: '13px' }}
                      onClick={(e) => { e.stopPropagation(); onNavigate('map') }}
                    >
                      View on map
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
