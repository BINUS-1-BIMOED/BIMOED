import { useState, useEffect } from 'react'
import HomeScreen from './screens/HomeScreen'
import MapScreen from './screens/MapScreen'
import AlertScreen from './screens/AlertScreen'
import ReportScreen from './screens/ReportScreen'
import ProfileScreen from './screens/ProfileScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import './index.css'

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
    badge: 3
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
  const [onboarded, setOnboarded] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('escood-theme')
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  useEffect(() => {
    localStorage.setItem('escood-theme', theme)
  }, [theme])

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
    if (isMapScreen) return <MapScreen onNavigate={navigate}/>
    switch (screen) {
      case 'home': return <HomeScreen onNavigate={navigate}/>
      case 'alert': return <AlertScreen onNavigate={navigate}/>
      case 'report': return <ReportScreen onNavigate={navigate}/>
      case 'profile':
      case 'contacts': return <ProfileScreen onNavigate={navigate} theme={theme} onThemeChange={setTheme}/>
      default: return <HomeScreen onNavigate={navigate}/>
    }
  }

  return (
    <div 
      className="phone-shell" 
      data-theme={theme}
      style={{ 
        height: '100dvh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        margin: 0,
        borderRadius: 0,
        border: 'none',
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
                      {'badge' in item && item.badge && !isActive && (
                        <span className="nav-badge">{item.badge}</span>
                      )}
                    </div>
                    {!isFab && <span className="nav-label">{item.label}</span>}
                  </button>
                )
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
