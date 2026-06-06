import { useState } from 'react'

interface ProfileScreenProps {
  onNavigate?: (screen: string) => void
}

export default function ProfileScreen({ onNavigate: _onNavigate }: ProfileScreenProps) {
  const [offlineMode, setOfflineMode] = useState(true)
  const [vibration, setVibration] = useState(true)
  const [autoEvac, setAutoEvac] = useState(false)
  const [language, setLanguage] = useState('id')

  const stats = [
    { label: 'Laporan Dikirim', value: '7', icon: '📢' },
    { label: 'Rute Digunakan', value: '3', icon: '🗺️' },
    { label: 'Alert Diterima', value: '24', icon: '🔔' },
  ]

  const contacts = [
    { name: 'BNPB Pusat', phone: '117', icon: '🏛️', primary: true },
    { name: 'BPBD Medan', phone: '(061) 7322-888', icon: '🚒', primary: false },
    { name: 'PMI Sumut', phone: '(061) 8450-131', icon: '🏥', primary: false },
    { name: 'SAR Medan', phone: '(061) 8459-745', icon: '⛑️', primary: false },
  ]

  const Toggle = ({ value, onChange }: { value: boolean, onChange: () => void }) => (
    <button
      onClick={onChange}
      style={{
        width: '44px', height: '24px',
        borderRadius: '100px',
        background: value ? 'var(--primary)' : 'var(--bg-elevated)',
        border: `1px solid ${value ? 'var(--primary)' : 'var(--border)'}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.25s ease',
        flexShrink: 0
      }}
    >
      <div style={{
        position: 'absolute',
        top: '2px',
        left: value ? '22px' : '2px',
        width: '18px', height: '18px',
        borderRadius: '50%',
        background: 'white',
        transition: 'left 0.25s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
      }}/>
    </button>
  )

  return (
    <div className="screen" style={{ padding: '16px' }}>
      {/* Profile card */}
      <div className="animate-fade-in" style={{ marginBottom: '20px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(0,102,255,0.15), rgba(0,102,255,0.05))',
            border: '1px solid rgba(0,102,255,0.2)',
            borderRadius: '24px',
            padding: '24px 20px',
            display: 'flex', alignItems: 'center', gap: '16px'
          }}
        >
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px',
            background: 'var(--primary-glow)',
            border: '2px solid rgba(0,102,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', flexShrink: 0
          }}>👤</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.3px', marginBottom: '4px' }}>
              Budi Santoso
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Medan, Sumatera Utara</p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className="chip" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'rgba(0,196,140,0.2)' }}>
                ✓ Terverifikasi
              </span>
              <span className="chip" style={{ fontSize: '10px', padding: '3px 8px' }}>
                🏅 Kontributor
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px', animationDelay: '0.05s' }}>
        {stats.map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{stat.icon}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="animate-fade-in" style={{ marginBottom: '20px', animationDelay: '0.1s' }}>
        <p className="section-title" style={{ marginBottom: '12px' }}>⚙️ Pengaturan</p>
        <div className="card" style={{ padding: '4px 0' }}>
          {[
            {
              label: 'Mode Offline',
              desc: 'Data DEM & peta tersimpan lokal',
              icon: '📶',
              value: offlineMode,
              onChange: () => setOfflineMode(!offlineMode)
            },
            {
              label: 'Getar Peringatan',
              desc: 'Notifikasi getar saat peringatan darurat',
              icon: '📳',
              value: vibration,
              onChange: () => setVibration(!vibration)
            },
            {
              label: 'Evakuasi Otomatis',
              desc: 'Tampilkan rute saat risiko kritis',
              icon: '🗺️',
              value: autoEvac,
              onChange: () => setAutoEvac(!autoEvac)
            },
          ].map((setting, i) => (
            <div key={i}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                  {setting.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{setting.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{setting.desc}</div>
                </div>
                <Toggle value={setting.value} onChange={setting.onChange}/>
              </div>
              {i < 2 && <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 16px' }}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="animate-fade-in" style={{ marginBottom: '20px', animationDelay: '0.15s' }}>
        <p className="section-title" style={{ marginBottom: '12px' }}>🌐 Bahasa</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'id', label: '🇮🇩 Bahasa Indonesia' },
            { id: 'en', label: '🇬🇧 English' },
          ].map(lang => (
            <button
              key={lang.id}
              onClick={() => setLanguage(lang.id)}
              style={{
                flex: 1, padding: '12px',
                background: language === lang.id ? 'var(--primary-glow)' : 'var(--bg-card)',
                border: `1px solid ${language === lang.id ? 'rgba(0,102,255,0.3)' : 'var(--border)'}`,
                borderRadius: '14px',
                color: language === lang.id ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Emergency contacts */}
      <div className="animate-fade-in" style={{ marginBottom: '20px', animationDelay: '0.2s' }}>
        <p className="section-title" style={{ marginBottom: '12px' }}>📞 Kontak Darurat</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {contacts.map((contact, i) => (
            <div
              key={i}
              className="card"
              style={{
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: '12px',
                border: contact.primary ? '1px solid rgba(255,59,59,0.2)' : '1px solid var(--border)',
                background: contact.primary ? 'var(--danger-bg)' : 'var(--bg-card)'
              }}
            >
              <div style={{ fontSize: '22px' }}>{contact.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{contact.name}</div>
                <div style={{ fontSize: '12px', color: contact.primary ? 'var(--danger)' : 'var(--text-muted)', fontWeight: contact.primary ? 700 : 400 }}>{contact.phone}</div>
              </div>
              <button
                style={{
                  background: contact.primary ? 'var(--danger)' : 'var(--bg-elevated)',
                  border: 'none',
                  borderRadius: '10px',
                  width: '36px', height: '36px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                📲
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* App info */}
      <div className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
        <div style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'var(--primary-glow)',
            border: '1px solid rgba(0,102,255,0.2)',
            borderRadius: '12px',
            padding: '8px 16px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '18px' }}>🌊</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>ESCOOD</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            v1.0.0-beta · AAIH 2026 · Climate Change Track
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Data: BNPB · BMKG · NASA SRTM · OpenStreetMap
          </p>
        </div>
      </div>
    </div>
  )
}
