import { useState } from 'react'

interface ReportScreenProps {
  onNavigate: (screen: string) => void
}

export default function ReportScreen({ onNavigate }: ReportScreenProps) {
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('')
  const [description, setDescription] = useState('')
  const [photoAdded, setPhotoAdded] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [validating, setValidating] = useState(false)

  const categories = [
    { id: 'flood', label: 'Banjir', icon: '🌊', desc: 'Genangan / luapan air' },
    { id: 'landslide', label: 'Longsor', icon: '⛰️', desc: 'Tanah bergerak / ambles' },
    { id: 'blockage', label: 'Jalan Rusak', icon: '🚧', desc: 'Jalan terputus / tergenang' },
    { id: 'evacuation', label: 'Butuh Bantuan', icon: '🆘', desc: 'Perlu evakuasi / bantuan' },
    { id: 'safe_zone', label: 'Zona Aman', icon: '⛺', desc: 'Laporkan lokasi aman' },
    { id: 'other', label: 'Lainnya', icon: '📋', desc: 'Kejadian lain' },
  ]

  const severities = [
    { id: 'low', label: 'Ringan', color: '#00C48C', desc: 'Situasi terkendali' },
    { id: 'moderate', label: 'Sedang', color: '#FFCE00', desc: 'Butuh perhatian' },
    { id: 'high', label: 'Parah', color: '#FF8C00', desc: 'Segera ditangani' },
    { id: 'critical', label: 'Darurat', color: '#FF3B3B', desc: 'Bahaya jiwa!' },
  ]

  const handleSubmit = () => {
    setValidating(true)
    setTimeout(() => {
      setValidating(false)
      setSubmitted(true)
    }, 2500)
  }

  if (submitted) {
    return (
      <div className="screen" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="animate-fade-in" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: '72px', marginBottom: '20px', animation: 'float 3s ease infinite' }}>✅</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Laporan Terkirim!
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
            Laporan Anda sedang divalidasi oleh sistem AI Escood dan tim moderator kami. Estimasi verifikasi: <strong style={{ color: 'var(--text)' }}>5–10 menit</strong>.
          </p>

          {/* Validation stages */}
          <div className="card" style={{ textAlign: 'left', marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Proses Validasi</p>
            {[
              { step: 'Laporan diterima', done: true, icon: '📥' },
              { step: 'Cross-check sensor area', done: true, icon: '📡' },
              { step: 'Validasi AI Intelligent Engine', done: false, icon: '🤖' },
              { step: 'Review moderator manusia', done: false, icon: '👤' },
              { step: 'Publikasi ke pengguna lain', done: false, icon: '📢' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: s.done ? 'var(--success-bg)' : 'var(--bg-elevated)',
                  border: s.done ? '1px solid rgba(0,196,140,0.3)' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', flexShrink: 0
                }}>
                  {s.done ? '✓' : s.icon}
                </div>
                <span style={{ fontSize: '13px', color: s.done ? 'var(--success)' : 'var(--text-muted)', fontWeight: s.done ? 600 : 400 }}>{s.step}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setStep(1); setCategory(''); setSeverity(''); setDescription(''); setPhotoAdded(false); setSubmitted(false) }}>
              Laporan Baru
            </button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => onNavigate('home')}>
              Kembali
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (validating) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '32px' }}>
        <div className="animate-fade-in" style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 20px' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid var(--primary-glow)',
              animation: 'pulse-ring 1.5s ease infinite'
            }}/>
            <div style={{
              position: 'absolute', inset: '8px', borderRadius: '50%',
              background: 'var(--primary-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px'
            }}>🤖</div>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
            AI Memvalidasi Laporan...
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Sistem sedang mencocokkan laporan Anda dengan data sensor real-time dan laporan komunitas lainnya
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => step > 1 ? setStep(step - 1) : onNavigate('home')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>
            Laporkan Kejadian
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Langkah {step} dari 3</p>
        </div>
      </div>

      {/* Progress steps */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
        {[1, 2, 3].map(s => (
          <div
            key={s}
            style={{
              flex: 1, height: '4px', borderRadius: '100px',
              background: s <= step ? 'var(--primary)' : 'var(--border)',
              transition: 'background 0.3s ease'
            }}
          />
        ))}
      </div>

      {/* Step 1: Category */}
      {step === 1 && (
        <div className="animate-fade-in">
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Jenis Kejadian</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Pilih kategori yang paling sesuai</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  background: category === cat.id ? 'var(--primary-glow)' : 'var(--bg-card)',
                  border: `1px solid ${category === cat.id ? 'rgba(0,102,255,0.4)' : 'var(--border)'}`,
                  borderRadius: '16px',
                  padding: '16px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{cat.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: category === cat.id ? 'var(--primary)' : 'var(--text)', fontFamily: 'var(--font-display)' }}>{cat.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{cat.desc}</div>
              </button>
            ))}
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: '24px' }}
            disabled={!category}
            onClick={() => setStep(2)}
          >
            Lanjut →
          </button>
        </div>
      )}

      {/* Step 2: Severity + Location */}
      {step === 2 && (
        <div className="animate-fade-in">
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Tingkat Keparahan</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Seberapa parah situasinya?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {severities.map(sev => (
              <button
                key={sev.id}
                onClick={() => setSeverity(sev.id)}
                style={{
                  background: severity === sev.id ? `${sev.color}14` : 'var(--bg-card)',
                  border: `1px solid ${severity === sev.id ? `${sev.color}40` : 'var(--border)'}`,
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: sev.color, flexShrink: 0 }}/>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: severity === sev.id ? sev.color : 'var(--text)', fontFamily: 'var(--font-display)' }}>{sev.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sev.desc}</div>
                </div>
                {severity === sev.id && <span style={{ color: sev.color, fontSize: '16px' }}>✓</span>}
              </button>
            ))}
          </div>

          {/* Location auto-detected */}
          <div className="card" style={{ marginBottom: '24px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📍</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Lokasi Terdeteksi Otomatis</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Jl. Iskandar Muda No. 15, Medan Helvetia</p>
              </div>
              <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: '11px' }}>Ubah</button>
            </div>
          </div>

          <button
            className="btn-primary"
            disabled={!severity}
            onClick={() => setStep(3)}
          >
            Lanjut →
          </button>
        </div>
      )}

      {/* Step 3: Description + Photo */}
      {step === 3 && (
        <div className="animate-fade-in">
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Detail Kejadian</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Ceritakan apa yang Anda lihat</p>

          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Contoh: Air setinggi lutut menggenangi perumahan warga, warga mulai mengungsi..."
            style={{
              width: '100%',
              height: '110px',
              background: 'var(--bg-card)',
              border: `1px solid ${description ? 'rgba(0,102,255,0.3)' : 'var(--border)'}`,
              borderRadius: '14px',
              padding: '14px',
              color: 'var(--text)',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.6,
              marginBottom: '14px',
              transition: 'border-color 0.2s ease'
            }}
          />

          {/* Photo upload */}
          <button
            onClick={() => setPhotoAdded(!photoAdded)}
            style={{
              width: '100%',
              background: photoAdded ? 'var(--success-bg)' : 'var(--bg-card)',
              border: `1.5px dashed ${photoAdded ? 'rgba(0,196,140,0.4)' : 'var(--border)'}`,
              borderRadius: '14px',
              padding: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '24px'
            }}
          >
            <span style={{ fontSize: '24px' }}>{photoAdded ? '🖼️' : '📷'}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: photoAdded ? 'var(--success)' : 'var(--text)' }}>
                {photoAdded ? 'Foto Ditambahkan ✓' : 'Tambah Foto'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {photoAdded ? '1 foto terpilih' : 'Opsional — membantu validasi AI'}
              </div>
            </div>
          </button>

          {/* Disclaimer */}
          <div style={{
            background: 'rgba(0,102,255,0.06)',
            border: '1px solid rgba(0,102,255,0.12)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '20px',
            display: 'flex', gap: '8px'
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🤖</span>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Laporan Anda akan divalidasi secara otomatis oleh AI Escood dan ditinjau moderator manusia sebelum dipublikasikan. Laporan palsu dapat menghambat respons darurat.
            </p>
          </div>

          <button
            className="btn-danger"
            style={{ background: category === 'evacuation' ? 'var(--danger)' : 'var(--primary)' }}
            disabled={!description.trim()}
            onClick={handleSubmit}
          >
            {category === 'evacuation' ? '🆘 Kirim Laporan Darurat' : '📤 Kirim Laporan'}
          </button>
        </div>
      )}
    </div>
  )
}
