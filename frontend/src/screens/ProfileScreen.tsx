import { useState } from 'react'

type Theme = 'light' | 'dark'

interface ProfileScreenProps {
  onNavigate?: (screen: string) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

export default function ProfileScreen({ onNavigate: _onNavigate, theme, onThemeChange }: ProfileScreenProps) {
  const [offlineMode, setOfflineMode] = useState(true)
  const [vibration, setVibration] = useState(true)
  const [autoEvac, setAutoEvac] = useState(false)

  const stats = [
    { label: 'Reports', value: '7' },
    { label: 'Routes', value: '3' },
    { label: 'Alerts', value: '24' },
  ]

  const contacts = [
    { name: 'BNPB National', phone: '117', primary: true },
    { name: 'BPBD Medan', phone: '(061) 7322-888', primary: false },
    { name: 'PMI North Sumatra', phone: '(061) 8450-131', primary: false },
    { name: 'SAR Medan', phone: '(061) 8459-745', primary: false },
  ]

  const settings = [
    { label: 'Offline mode', desc: 'DEM data & maps stored locally', value: offlineMode, onChange: () => setOfflineMode(!offlineMode) },
    { label: 'Alert vibration', desc: 'Vibrate on emergency alerts', value: vibration, onChange: () => setVibration(!vibration) },
    { label: 'Auto evacuation', desc: 'Show route when risk is critical', value: autoEvac, onChange: () => setAutoEvac(!autoEvac) },
  ]

  const Toggle = ({ value, onChange }: { value: boolean, onChange: () => void }) => (
    <button className={`toggle ${value ? 'on' : ''}`} onClick={onChange} aria-pressed={value}>
      <div className="toggle-thumb"/>
    </button>
  )

  return (
    <div className="page">
      <div className="profile-card animate-fade-in" style={{ marginBottom: '16px' }}>
        <div className="profile-avatar">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">Budi Santoso</div>
          <div className="profile-location">Medan, North Sumatra</div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <span className="chip" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--success-bg)', color: 'var(--success)' }}>Verified</span>
            <span className="chip" style={{ fontSize: '10px', padding: '3px 8px' }}>Contributor</span>
          </div>
        </div>
      </div>

      <div className="stats-grid animate-fade-in" style={{ marginBottom: '24px', animationDelay: '0.05s' }}>
        {stats.map(stat => (
          <div key={stat.label} className="stat-card">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="animate-fade-in" style={{ marginBottom: '24px', animationDelay: '0.1s' }}>
        <p className="section-title" style={{ marginBottom: '10px' }}>Settings</p>
        <div className="settings-list">
          {settings.map((setting, i) => (
            <div key={i} className="settings-row">
              <div style={{ flex: 1 }}>
                <div className="settings-label">{setting.label}</div>
                <div className="settings-desc">{setting.desc}</div>
              </div>
              <Toggle value={setting.value} onChange={setting.onChange}/>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-fade-in" style={{ marginBottom: '24px', animationDelay: '0.15s' }}>
        <p className="section-title" style={{ marginBottom: '10px' }}>Appearance</p>
        <div className="theme-picker">
          {[
            { id: 'light' as Theme, label: 'Light' },
            { id: 'dark' as Theme, label: 'Dark' },
          ].map(t => (
            <button
              key={t.id}
              className={`theme-option ${theme === t.id ? 'active' : ''}`}
              onClick={() => onThemeChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-in" style={{ marginBottom: '24px', animationDelay: '0.2s' }}>
        <p className="section-title" style={{ marginBottom: '10px' }}>Emergency contacts</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {contacts.map((contact, i) => (
            <div
              key={i}
              className="list-item"
              style={contact.primary ? { borderColor: 'color-mix(in srgb, var(--danger) 25%, var(--border))' } : {}}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{contact.name}</div>
                <div style={{ fontSize: '12px', color: contact.primary ? 'var(--danger)' : 'var(--text-muted)', marginTop: '1px' }}>{contact.phone}</div>
              </div>
              <button className="icon-btn" style={{ width: '36px', height: '36px' }} aria-label={`Call ${contact.name}`}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '8px 0 16px', animationDelay: '0.25s' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.05em' }}>ESCOOD</p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>v1.0.0-beta · AAIH 2026</p>
      </div>
    </div>
  )
}
