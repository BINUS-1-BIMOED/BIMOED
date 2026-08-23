import { useState } from 'react'
import qrisImage from '../assets/qris.jpeg'

interface DonationScreenProps {
  onNavigate: (screen: string) => void
}

const TOTAL_COLLECTED = 12_450_000
const TOTAL_TARGET = 25_000_000
const DONORS_PAGE_SIZE = 10

const formatRupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`

const maskName = (fullName: string) =>
  fullName
    .split(' ')
    .map((word) => (word.length <= 1 ? word : word[0] + '*'.repeat(word.length - 1)))
    .join(' ')

// Dummy/demo donor list — display only, no real donor data is collected anywhere in this prototype.
const DONORS = [
  { name: 'Timothy Febyant', amount: 10_000 },
  { name: 'Lorenzo Leonardo', amount: 100_000 },
  { name: 'Siti Aminah', amount: 50_000 },
  { name: 'Budi Santoso', amount: 25_000 },
  { name: 'Maria Christina', amount: 200_000 },
  { name: 'Ahmad Fauzi', amount: 15_000 },
  { name: 'Dewi Lestari', amount: 75_000 },
  { name: 'Rangga Pratama', amount: 30_000 },
  { name: 'Putri Ayu', amount: 500_000 },
  { name: 'Andi Wijaya', amount: 20_000 },
  { name: 'Nadia Salsabila', amount: 40_000 },
  { name: 'Kevin Halim', amount: 60_000 },
  { name: 'Ratna Sari', amount: 12_000 },
  { name: 'Fajar Nugraha', amount: 90_000 },
  { name: 'Yuni Astuti', amount: 35_000 },
]

const IMPACT_ITEMS = [
  {
    label: 'Drainage cleaning',
    detail: 'Clearing blocked and silted drainage channels in flood-prone neighborhoods.',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
      </svg>
    ),
  },
  {
    label: 'Waste removal',
    detail: 'Clearing trash and debris that block water flow during heavy rain.',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
  },
  {
    label: 'Community flood prevention activities',
    detail: 'Funding local gotong-royong efforts and flood-preparedness training.',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: 'Maintenance of drainage infrastructure',
    detail: 'Repairing culverts, pumps, and other flood-control infrastructure.',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
]

export default function DonationScreen({ onNavigate }: DonationScreenProps) {
  const percent = Math.min(100, Math.round((TOTAL_COLLECTED / TOTAL_TARGET) * 100))
  const [donorsOpen, setDonorsOpen] = useState(false)
  const [donorsVisible, setDonorsVisible] = useState(DONORS_PAGE_SIZE)
  const visibleDonors = DONORS.slice(0, donorsVisible)

  return (
    <div>
      <div className="screen-top">
        <button className="back-btn" onClick={() => onNavigate('home')} aria-label="Back">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">Open Donation</h1>
          <p className="page-subtitle">Support flood prevention</p>
        </div>
      </div>

      <div style={{ padding: '0 var(--page-pad) 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Hero */}
        <div className="animate-fade-in">
          <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.3, marginBottom: '8px' }}>
            Support Our Flood Prevention Efforts
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Your donation helps fund drainage cleaning and maintenance activities in flood-prone
            areas around Medan, carried out together with local communities.
          </p>
        </div>

        {/* Total donation */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <div className="section-header">
            <span className="section-title">Total Donation Collected</span>
            <span className="chip-live">{percent}%</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '14px' }}>
            {formatRupiah(TOTAL_COLLECTED)}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${percent}%`, background: 'var(--primary)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatRupiah(TOTAL_COLLECTED)}</span>
            <button
              onClick={() => setDonorsOpen((v) => !v)}
              aria-expanded={donorsOpen}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
                fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
              }}
            >
              Goal: {formatRupiah(TOTAL_TARGET)}
              <svg
                width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                style={{ transition: 'transform 0.15s ease', transform: donorsOpen ? 'rotate(180deg)' : 'none' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {donorsOpen && (
            <div className="animate-fade-in" style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {visibleDonors.map((donor, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 2px', borderBottom: i < visibleDonors.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: 'var(--text)' }}>{maskName(donor.name)}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{formatRupiah(donor.amount)}</span>
                  </div>
                ))}
              </div>
              {donorsVisible < DONORS.length && (
                <button
                  className="btn-ghost"
                  style={{ width: '100%', marginTop: '12px' }}
                  onClick={() => setDonorsVisible((v) => Math.min(DONORS.length, v + DONORS_PAGE_SIZE))}
                >
                  More
                </button>
              )}
            </div>
          )}
        </div>

       
        {/* QRIS */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="section-header">
            <span className="section-title">Donate via QRIS</span>
          </div>
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
              padding: '20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            <img
              src={qrisImage}
              alt="ESCOOD donation QRIS code"
              style={{
                width: '220px', maxWidth: '100%', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
              }}
            />
            <a
              href={qrisImage}
              download="escood-donation-qris.jpeg"
              className="btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download QR
            </a>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '260px' }}>
              Scan the QR code using your preferred mobile banking or e-wallet app.
            </p>
          </div>
        </div>
        
         {/* Donation impact */}
        <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <div className="section-header">
            <span className="section-title">Donation Impact</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {IMPACT_ITEMS.map((item) => (
              <div key={item.label} className="list-item">
                <div className="list-icon">{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        

        {/* Prototype notice */}
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>
          Prototype — Donation functionality is currently simulated for demonstration purposes.
        </p>
      </div>
    </div>
  )
}
