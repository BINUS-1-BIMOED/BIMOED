import { useState, useEffect, Suspense, lazy } from 'react'
import { getAlerts, isOnline } from './api/client'
import { useLocation } from './hooks/useLocation'
import HomeScreen from './screens/HomeScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import SOSModal from './components/SOSModal'
import './index.css'

// Loaded on first navigation instead of upfront — MapScreen alone pulls in
// leaflet/react-leaflet, which is the single heaviest chunk in the app.
const MapScreen = lazy(() => import('./screens/MapScreen'))
const AlertScreen = lazy(() => import('./screens/AlertScreen'))
const ReportScreen = lazy(() => import('./screens/ReportScreen'))
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'))

const ScreenFallback = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="spinner" aria-label="Loading" />
  </div>
)

type Screen = 'home' | 'map' | 'alert' | 'report' | 'safe' | 'route' | 'contacts' | 'profile'
type Theme = 'light' | 'dark'

const NAV_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  },
  {
    id: 'map',
    label: 'Map',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        <line x1="8" y1="2" x2="8" y2="18"/>
        <line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
    )
  },
  {
    id: 'alert',
    label: 'Alerts',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    badge: true
  },
  {
    id: 'report',
    label: 'Report',
    icon: (_active: boolean) => (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    fab: true
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )
  },
]

export default function App() {
  const { lat, lng } = useLocation()
  const [onboarded, setOnboarded] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')
  const [alertBadge, setAlertBadge] = useState(0)
  const [sosModalOpen, setSosModalOpen] = useState(false)
  const [appOffline, setAppOffline] = useState(!isOnline())
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('escood-theme')
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  useEffect(() => {
    const goOnline = () => setAppOffline(false)
    const goOffline = () => setAppOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('escood-theme', theme)
  }, [theme])

  useEffect(() => {
    getAlerts(lat, lng)
      .then((alerts) => setAlertBadge(alerts.filter((a) => a.severity === 'high' || a.severity === 'critical').length))
      .catch(() => setAlertBadge(0))
  }, [lat, lng])

  const navigate = (s: string) => {
    const valid: Screen[] = ['home', 'map', 'alert', 'report', 'safe', 'route', 'contacts', 'profile']
    if (valid.includes(s as Screen)) {
      setScreen(s as Screen)
    }
  }

  const isMapScreen = ['map', 'route', 'safe'].includes(screen)
  const activeNav = isMapScreen ? 'map'
    : screen === 'contacts' ? 'profile'
    : screen

  const renderScreen = () => {
    if (isMapScreen) {
      const mode = screen === 'route' ? 'route' : screen === 'safe' ? 'safe' : 'risk'
      return (
        <Suspense fallback={<ScreenFallback />}>
          <MapScreen onNavigate={navigate} initialMode={mode} />
        </Suspense>
      )
    }
    switch (screen) {
      case 'home': return <HomeScreen onNavigate={navigate}/>
      case 'alert': return <Suspense fallback={<ScreenFallback />}><AlertScreen onNavigate={navigate}/></Suspense>
      case 'report': return <Suspense fallback={<ScreenFallback />}><ReportScreen onNavigate={navigate}/></Suspense>
      case 'profile':
      case 'contacts': return (
        <Suspense fallback={<ScreenFallback />}>
          <ProfileScreen onNavigate={navigate} theme={theme} onThemeChange={setTheme}/>
        </Suspense>
      )
      default: return <HomeScreen onNavigate={navigate}/>
    }
  }

  return (
    <div
      className="phone-shell"
      data-theme={theme}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >

      {!onboarded ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <OnboardingScreen onComplete={() => setOnboarded(true)}/>
        </div>
      ) : (
        <>
          {appOffline && (
            <div style={{
              background: '#F59E0B', color: '#1a1a2e', textAlign: 'center',
              padding: '4px 12px', fontSize: '11px', fontWeight: 600,
              flexShrink: 0, letterSpacing: '0.03em'
            }}>
              ⚠️ You are offline — showing cached data
            </div>
          )}

          {isMapScreen ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {renderScreen()}
            </div>
          ) : (
            <div className="screen" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {renderScreen()}
            </div>
          )}

          <div className="bottom-nav-wrap" style={{ flexShrink: 0 }}>
            <nav className="bottom-nav">
              {NAV_ITEMS.map(item => {
                const isActive = activeNav === item.id
                const isFab = item.fab
                return (
                  <button
                    key={item.id}
                    className={`nav-item ${isFab ? 'fab' : ''} ${isActive && !isFab ? 'active' : ''}`}
                    onClick={() => navigate(item.id)}
                  >
                    <div style={{ position: 'relative' }}>
                      {item.icon(isActive)}
                      {'badge' in item && item.badge && alertBadge > 0 && !isActive && (
                        <span className="nav-badge">{alertBadge}</span>
                      )}
                    </div>
                    {!isFab && <span className="nav-label">{item.label}</span>}
                  </button>
                )
              })}
            </nav>
            <button
              className="sos-button"
              onClick={() => setSosModalOpen(true)}
              aria-label="SOS Emergency Alert"
              title="Send emergency SOS alert"
            >
              <span className="sos-text">SOS</span>
            </button>
          </div>

          <SOSModal
            isOpen={sosModalOpen}
            onClose={() => setSosModalOpen(false)}
            onSuccess={() => {
              setScreen('home')
            }}
          />
        </>
      )}
    </div>
  )
}