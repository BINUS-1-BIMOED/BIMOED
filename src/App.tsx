import { useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import MapScreen from './screens/MapScreen'
import AlertScreen from './screens/AlertScreen'
import ReportScreen from './screens/ReportScreen'
import ProfileScreen from './screens/ProfileScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import './index.css'

type Screen = 'home' | 'map' | 'alert' | 'report' | 'safe' | 'route' | 'contacts' | 'profile'

const NAV_ITEMS = [
  {
    id: 'home',
    label: 'Beranda',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  },
  {
    id: 'map',
    label: 'Peta',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        <line x1="8" y1="2" x2="8" y2="18"/>
        <line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
    )
  },
  {
    id: 'alert',
    label: 'Peringatan',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    badge: 3
  },
  {
    id: 'report',
    label: 'Lapor',
    icon: (_active: boolean) => (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    fab: true
  },
  {
    id: 'profile',
    label: 'Profil',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )
  },
]

export default function App() {
  const [onboarded, setOnboarded] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')

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
      case 'contacts': return <ProfileScreen onNavigate={navigate}/>
      default: return <HomeScreen onNavigate={navigate}/>
    }
  }

  return (
    <div className="phone-shell">
      {/* Status bar */}
      <div className="status-bar">
        <span className="status-time">14:32</span>
        <div className="status-icons">
          <svg width="14" height="10" fill="currentColor" viewBox="0 0 14 10">
            <rect x="0" y="5" width="2" height="5" rx="1" opacity="0.4"/>
            <rect x="3" y="3.5" width="2" height="6.5" rx="1" opacity="0.6"/>
            <rect x="6" y="2" width="2" height="8" rx="1" opacity="0.8"/>
            <rect x="9" y="0.5" width="2" height="9.5" rx="1"/>
          </svg>
          <svg width="14" height="10" fill="currentColor" viewBox="0 0 14 10">
            <path d="M7 2C5.1 2 3.4 2.8 2.2 4.1L1 2.8C2.6 1.1 4.7 0 7 0s4.4 1.1 6 2.8L11.8 4.1C10.6 2.8 8.9 2 7 2z" opacity="0.4"/>
            <path d="M7 4.5c-1.3 0-2.4.6-3.2 1.5L2.6 4.8C3.7 3.7 5.3 3 7 3s3.3.7 4.4 1.8L10.2 6c-.8-.9-1.9-1.5-3.2-1.5z" opacity="0.7"/>
            <circle cx="7" cy="8" r="1.5"/>
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>87%</span>
            <div style={{ width: '22px', height: '11px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.4)', padding: '1.5px', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '68%', height: '100%', background: '#00C48C', borderRadius: '1.5px' }}/>
            </div>
          </div>
        </div>
      </div>

      {!onboarded ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <OnboardingScreen onComplete={() => setOnboarded(true)}/>
        </div>
      ) : (
        <>
          {isMapScreen ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {renderScreen()}
            </div>
          ) : (
            <div className="screen">
              {renderScreen()}
            </div>
          )}

          <nav className="bottom-nav">
            {NAV_ITEMS.map(item => {
              const isActive = activeNav === item.id
              const isFab = item.fab
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive && !isFab ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                  style={isFab ? {
                    background: 'var(--primary)',
                    borderRadius: '20px',
                    color: 'white',
                    width: '56px',
                    height: '50px',
                    padding: '0',
                    transform: 'translateY(-8px)',
                    boxShadow: '0 4px 20px rgba(0,102,255,0.4)',
                    border: 'none'
                  } : {}}
                >
                  <div style={{ position: 'relative' }}>
                    {item.icon(isActive)}
                    {'badge' in item && item.badge && !isActive && (
                      <span style={{
                        position: 'absolute', top: '-4px', right: '-6px',
                        width: '15px', height: '15px',
                        background: 'var(--danger)',
                        borderRadius: '50%',
                        fontSize: '8px', fontWeight: 800, color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1.5px solid var(--bg-card)'
                      }}>{item.badge}</span>
                    )}
                  </div>
                  {!isFab && <span className="nav-label">{item.label}</span>}
                </button>
              )
            })}
          </nav>
        </>
      )}
    </div>
  )
}
