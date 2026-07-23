import { useState, useEffect, useCallback } from 'react'
import { getRisk, getRiskHistory, getAlerts, getBackendWeather, isOnline } from '../api/client'
import type { BackendWeatherData } from '../api/client'
import type { Alert } from '../api/types'
import { useLocation } from '../hooks/useLocation'
import { timeAgo } from '../utils/format'

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
  const { lat, lng, label } = useLocation()
  const [riskLevel, setRiskLevel] = useState(0)
  const [riskLabel, setRiskLabel] = useState('Loading')
  const [rainfallData, setRainfallData] = useState<number[]>([])
  const [rainfallTotal, setRainfallTotal] = useState(0)
  const [waterLevel, setWaterLevel] = useState(0)
  const [dangerZones, setDangerZones] = useState(0)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  // offline state currently only used to control apiError messaging
  const [offline, setOffline] = useState(!isOnline())
  const [usingCachedData, setUsingCachedData] = useState(false)

  void offline
  void usingCachedData


  const [weatherData, setWeatherData] = useState<BackendWeatherData | null>(null)
  const [weatherSource, setWeatherSource] = useState<string>('open_meteo')

  const loadData = useCallback(async () => {
    try {
      setApiError(null)
      setUsingCachedData(false)
      const [risk, history, alertList, weather] = await Promise.all([
        getRisk(lat, lng),
        getRiskHistory(lat, lng),
        getAlerts(lat, lng),
        getBackendWeather(lat, lng),
      ])
      setRiskLevel(risk.score)
      setRiskLabel(risk.label)
      setRainfallTotal(risk.rainfall_mm)
      setWaterLevel(risk.water_level_m)
      setRainfallData(history.points.map((p) => p.rainfall_mm))
      setDangerZones(alertList.filter((a) => a.severity === 'high' || a.severity === 'critical').length)
      setAlerts(alertList.slice(0, 3))
      setLastUpdate(new Date(risk.computed_at))
      setWeatherData(weather)
      setWeatherSource(weather.source)
      setLoading(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (!isOnline()) {
        setUsingCachedData(true)
        setApiError('You are offline — showing last available data')
      } else {
        setApiError(`Backend unavailable — run: cd backend/app && bash start.sh (${msg})`)
      }
      setLoading(false)
    }
  }, [lat, lng])

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => {
      setOffline(false)
      setApiError(null)
      loadData()
    }
    const goOffline = () => setOffline(true)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [loadData])


  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [loadData])

  const getRiskColor = (level: number) => {
    if (level >= 80) return 'var(--danger)'
    if (level >= 60) return 'var(--warning)'
    if (level >= 40) return '#FBBF24'
    return 'var(--success)'
  }

  const getRiskClass = (level: number) => {
    if (level >= 80) return 'critical'
    if (level >= 60) return 'high'
    if (level >= 40) return 'moderate'
    return 'low'
  }

  const color = getRiskColor(riskLevel)
  const maxRain = Math.max(...rainfallData, 1)

  const actions = [
    { label: 'Evacuation Route', type: 'route', screen: 'route' },
    { label: 'Report Incident', type: 'report', screen: 'report' },
    { label: 'Safe Zone', type: 'safe', screen: 'safe' },
    { label: 'Emergency Contacts', type: 'contacts', screen: 'contacts' },
  ]

  const getWeatherCondition = () => weatherData?.condition ?? 'Loading…'

  const getTemperature = () => weatherData?.temp ?? 0

  const getWeatherIcon = () => weatherData?.icon ?? '☁️'

  const forecastList = weatherData?.forecast ?? []


  return (
    <div className="page">
      <div className="page-header animate-fade-in">
        <div>
          <p className="page-eyebrow">Active location</p>
          <h1 className="page-title">{label}</h1>
        </div>
        <button className="icon-btn" onClick={() => onNavigate('alert')} aria-label="Alerts">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {alerts.length > 0 && <span className="icon-btn-badge">{alerts.length}</span>}
        </button>
      </div>

      {apiError && (
        <div className="card" style={{ marginBottom: '12px', borderColor: 'var(--warning)', padding: '10px 14px' }}>
          <p style={{ fontSize: '12px', color: 'var(--warning)' }}>{apiError}</p>
        </div>
      )}

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
              <span className="risk-hero-value" style={{ color }}>{loading ? '—' : Math.round(riskLevel)}</span>
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
              {loading ? '…' : riskLabel}
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
            { label: 'Rainfall', value: `${rainfallTotal.toFixed(1)}mm` },
            { label: 'Water level', value: `${waterLevel.toFixed(1)}m` },
            { label: 'Danger zones', value: `${dangerZones} areas` },
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
          {(rainfallData.length ? rainfallData : Array(12).fill(0)).map((val, i) => {
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
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Now · {rainfallData.length ? rainfallData[rainfallData.length - 1].toFixed(1) : '0'}mm
          </span>
        </div>
      </div>

      <div className="card weather-card animate-fade-in" style={{ marginBottom: '20px', animationDelay: '0.12s' }}>
        <div className="section-header">
          <span className="section-title">Weather</span>
          <span className="chip-live">{weatherSource === 'open_meteo' ? 'Open-Meteo' : 'Live'}</span>
        </div>
        <div className="weather-current">
          <div className="weather-icon-large">{loading ? '…' : getWeatherIcon()}</div>
          <div className="weather-info">
            <div className="weather-temp">{loading ? '—' : Math.round(getTemperature())}°</div>
            <div className="weather-condition">{loading ? 'Loading…' : getWeatherCondition()}</div>
            <div className="weather-detail">
              {weatherData
                ? `Humidity: ${weatherData.humidity}% | Wind: ${weatherData.wind_speed} km/h | Rain: ${weatherData.precipitation}mm`
                : 'Fetching live weather…'}
            </div>
          </div>
        </div>
        <div className="weather-divider"></div>
        <div className="weather-hourly">
          {(forecastList.length ? forecastList : Array.from({ length: 6 }, (_, i) => ({ hour: i, temp: 0, icon: '…' }))).map((item, idx) => (
            <div key={idx} className="weather-hour">
              <div className="weather-time">{item.hour.toString().padStart(2, '0')}:00</div>
              <div className="weather-icon">{item.icon}</div>
              <div className="weather-temp-small">{Math.round(item.temp)}°</div>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-fade-in" style={{ marginBottom: '20px', animationDelay: '0.15s' }}>
        <div className="section-header">
          <span className="section-title">Active alerts</span>
          <button className="section-link" onClick={() => onNavigate('alert')}>View all</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.length === 0 && !loading && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>No active alerts nearby</p>
          )}
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
                  {alert.severity === 'critical' ? 'Critical' : alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                </span>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{timeAgo(alert.created_at)}</div>
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
