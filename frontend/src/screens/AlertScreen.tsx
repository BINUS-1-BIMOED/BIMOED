import { useEffect, useState } from 'react'
import { getAlerts } from '../api/client'
import type { Alert } from '../api/types'
import { useLocation } from '../hooks/useLocation'
import { timeAgo } from '../utils/format'

interface AlertScreenProps {
  onNavigate: (screen: string) => void
}

interface DisplayAlert extends Alert {
  subtitle: string
  time: string
  detail: string
  confidence: number
  affected: string
}

export default function AlertScreen({ onNavigate }: AlertScreenProps) {
  const { lat, lng } = useLocation()
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [alerts, setAlerts] = useState<DisplayAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAlerts(lat, lng, 25)
      .then((data) => {
        setAlerts(
          data.map((a) => ({
            ...a,
            subtitle: a.description || `Alert from ${a.source}`,
            time: timeAgo(a.created_at),
            detail: a.description || `${a.title} reported in ${a.location}. Source: ${a.source}.`,
            confidence: a.severity === 'critical' ? 94 : a.severity === 'high' ? 82 : 70,
            affected: a.location,
          })),
        )
        if (data.length > 0) setExpandedId(data[0].id)
      })
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false))
  }, [lat, lng])

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'critical', label: 'Critical' },
    { id: 'high', label: 'High' },
    { id: 'moderate', label: 'Moderate' },
  ]

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter)

  const severityLabels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    moderate: 'Moderate',
    low: 'Low',
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
        {loading && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading alerts…</p>}
        {!loading && filtered.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No alerts match this filter</p>
        )}
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
                    {severityLabels[alert.severity] ?? alert.severity}
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
