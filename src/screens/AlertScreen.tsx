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
      title: 'Banjir Kritis — Sungai Deli',
      subtitle: 'Ketinggian air mencapai 2.8m, melebihi batas siaga III',
      location: 'Medan Helvetia & Sekitar',
      time: '12 menit lalu',
      severity: 'critical',
      icon: '🌊',
      detail: 'Sungai Deli mencapai ketinggian 2.8m pukul 14:30 WIB. BNPB merekomendasikan evakuasi segera untuk warga di radius 500m. 3 titik pengungsian telah dibuka di GOR Pancing, Lapangan Merdeka, dan RSUP Adam Malik.',
      source: 'BNPB + Sensor IoT #DL-12',
      confidence: 94,
      affected: '~1.200 KK',
    },
    {
      id: 2,
      title: 'Peringatan Curah Hujan Ekstrem',
      subtitle: 'BMKG: Potensi hujan >100mm dalam 3 jam ke depan',
      location: 'Seluruh Kota Medan',
      time: '28 menit lalu',
      severity: 'high',
      icon: '⛈️',
      detail: 'BMKG mengeluarkan peringatan curah hujan ekstrem dengan estimasi 100–150mm dalam 3 jam. Potensi banjir kilat di kawasan rendah. Warga diimbau tidak melintas jembatan dan sungai kecil.',
      source: 'BMKG Feed Resmi',
      confidence: 88,
      affected: 'Seluruh Kota',
    },
    {
      id: 3,
      title: 'Potensi Longsor',
      subtitle: 'Tanah jenuh air di lereng Bukit Barisan bagian timur',
      location: 'Medan Tuntungan',
      time: '45 menit lalu',
      severity: 'high',
      icon: '⛰️',
      detail: 'Sensor pergerakan tanah mendeteksi peningkatan tekanan pada lereng di Kecamatan Tuntungan. Hujan 72 jam terakhir telah menyebabkan tanah jenuh. Warga di lereng diminta waspada.',
      source: 'Sensor Geofisika + Komunitas',
      confidence: 76,
      affected: '~340 KK',
    },
    {
      id: 4,
      title: 'Jalan Tergenang',
      subtitle: 'Jl. Gatot Subroto tidak dapat dilalui kendaraan',
      location: 'Medan Petisah',
      time: '1 jam lalu',
      severity: 'moderate',
      icon: '🚧',
      detail: 'Laporan dari komunitas dan kamera CCTV menunjukkan genangan setinggi 40–60cm di Jl. Gatot Subroto segmen Simpang Sekip. Hindari rute ini untuk sementara.',
      source: 'Laporan Komunitas (Terverifikasi)',
      confidence: 91,
      affected: 'Pengguna Jalan',
    },
    {
      id: 5,
      title: 'Siaga I PLTA Tangga',
      subtitle: 'Debit air meningkat, potensi pelepasan air',
      location: 'Hulu Sungai Asahan',
      time: '2 jam lalu',
      severity: 'high',
      icon: '⚡',
      detail: 'PLTA Tangga di hulu Sungai Asahan memasuki status Siaga I. Jika debit terus meningkat, pelepasan air terencana akan dilakukan dalam 4–6 jam. Warga di bantaran sungai agar bersiap.',
      source: 'PLN / Inalum Monitoring',
      confidence: 82,
      affected: 'Bantaran Asahan',
    },
    {
      id: 6,
      title: 'Info: Pos Pengungsian Dibuka',
      subtitle: 'GOR Pancing siap menampung 500 jiwa pengungsi',
      location: 'Jl. William Iskandar, Medan',
      time: '3 jam lalu',
      severity: 'info',
      icon: '⛺',
      detail: 'BPBD Kota Medan membuka pos pengungsian di GOR Pancing, Jl. William Iskandar. Kapasitas 500 jiwa, tersedia air bersih, dapur umum, dan tenaga medis. Bawa kartu identitas.',
      source: 'BPBD Kota Medan',
      confidence: 100,
      affected: 'Warga Terdampak',
    },
  ]

  const filters = [
    { id: 'all', label: 'Semua' },
    { id: 'critical', label: '🔴 Kritis' },
    { id: 'high', label: '🟠 Tinggi' },
    { id: 'moderate', label: '🟡 Sedang' },
    { id: 'info', label: 'ℹ️ Info' },
  ]

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter)

  const severityColors: Record<string, string> = {
    critical: '#FF3B3B',
    high: '#FF8C00',
    moderate: '#FFCE00',
    info: '#0066FF',
  }

  const severityLabels: Record<string, string> = {
    critical: 'KRITIS',
    high: 'TINGGI',
    moderate: 'SEDANG',
    info: 'INFO',
  }

  return (
    <div className="screen" style={{ padding: '0' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 0', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <button
            onClick={() => onNavigate('home')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', marginBottom: '2px' }}>
              Peringatan Dini
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length} peringatan aktif</p>
          </div>
          <div style={{
            background: 'var(--danger-bg)',
            border: '1px solid rgba(255,59,59,0.2)',
            borderRadius: '10px',
            padding: '6px 12px',
            fontSize: '12px', fontWeight: 700, color: 'var(--danger)'
          }}>LIVE</div>
        </div>

        {/* Filter chips */}
        <div className="scroll-row" style={{ marginBottom: '14px', paddingBottom: '2px' }}>
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`chip ${filter === f.id ? 'active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts list */}
      <div style={{ padding: '0 16px 16px' }}>
        {filtered.map((alert, i) => {
          const color = severityColors[alert.severity]
          const isExpanded = expandedId === alert.id
          return (
            <div
              key={alert.id}
              className="animate-fade-in"
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${color}25`,
                borderRadius: '18px',
                marginBottom: '10px',
                overflow: 'hidden',
                animationDelay: `${i * 0.05}s`,
                cursor: 'pointer'
              }}
              onClick={() => setExpandedId(isExpanded ? null : alert.id)}
            >
              {/* Alert row */}
              <div style={{ padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                  background: `${color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px',
                  border: `1px solid ${color}25`
                }}>
                  {alert.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{alert.title}</span>
                    <span className={`risk-badge ${alert.severity}`} style={{ fontSize: '9px', padding: '2px 8px', flexShrink: 0 }}>
                      {severityLabels[alert.severity]}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>{alert.subtitle}</p>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📍 {alert.location}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🕐 {alert.time}</span>
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div
                  className="animate-fade-in"
                  style={{
                    padding: '0 16px 14px',
                    borderTop: `1px solid ${color}15`
                  }}
                >
                  <div style={{ paddingTop: '12px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{alert.detail}</p>
                  </div>

                  {/* Metadata */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    {[
                      { label: 'Sumber', value: alert.source, icon: '📡' },
                      { label: 'Kepercayaan', value: `${alert.confidence}%`, icon: '✅' },
                      { label: 'Terdampak', value: alert.affected, icon: '👥' },
                      { label: 'Status', value: 'Terverifikasi', icon: '🔒' },
                    ].map(m => (
                      <div
                        key={m.label}
                        style={{
                          background: 'var(--bg-elevated)',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>{m.icon} {m.label}</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      className="btn-ghost"
                      style={{ width: '100%', textAlign: 'center' }}
                    >
                      Bagikan
                    </button>
                    <button
                      className="btn-primary"
                      style={{ padding: '10px', fontSize: '13px' }}
                      onClick={(e) => { e.stopPropagation(); onNavigate('map') }}
                    >
                      Lihat di Peta
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
