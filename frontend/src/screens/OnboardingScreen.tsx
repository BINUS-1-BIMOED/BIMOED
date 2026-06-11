import { useState, useEffect } from 'react'
import floodLogo from '../assets/6.png'; // Assuming 6.png is in the assets folder

interface OnboardingScreenProps {
  onComplete: () => void
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [phase, setPhase] = useState<'splash' | 'onboard'>('splash')
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setPhase('onboard'), 2000)
    return () => clearTimeout(timer)
  }, [])

  const slides = [
    {
      icon: floodLogo,
      title: 'Real-Time Flood Detection',
      desc: 'Our AI analyzes sensor data, BMKG weather, and community reports simultaneously to deliver accurate early warnings.',
      color: '#0066FF',
      bg: 'rgba(0,102,255,0.08)'
    },
    {
      icon: '🗺️',
      title: 'Offline Evacuation Routes',
      desc: 'Maps and evacuation routes are stored on your device. They still work without an internet connection.',
      color: '#00C48C',
      bg: 'rgba(0,196,140,0.08)'
    },
    {
      icon: '🤖',
      title: 'Smart Validation',
      desc: 'Every community report is AI-validated before being shared, preventing misinformation that could endanger lives.',
      color: '#FF8C00',
      bg: 'rgba(255,140,0,0.08)'
    },
  ]

  if (phase === 'splash') {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '32px'
      }}>
        <div style={{ animation: 'float 3s ease infinite' }}>
          <div style={{
            width: '90px', height: '90px',
            borderRadius: '26px',
            background: 'linear-gradient(135deg, rgba(0,102,255,0.2), rgba(0,102,255,0.05))',
            border: '1.5px solid rgba(0,102,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '44px',
            marginBottom: '24px',
            boxShadow: '0 0 40px rgba(0,102,255,0.2)' // The fontSize property will not affect the image, but the image will fill the div.
          }}><img src={floodLogo} alt="Flood Detection" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
        </div>
        <div style={{ textAlign: 'center', animation: 'fade-in 0.6s ease 0.3s both' }}>
          <h1 style={{
            fontSize: '36px', fontWeight: 900,
            color: 'var(--text)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-1px',
            marginBottom: '8px'
          }}>
            <span style={{ color: 'var(--primary)' }}>ESC</span>OOD
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Flood Early Warning System
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '48px' }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--primary)',
                animation: `pulse-dot 1.2s ease ${i * 0.2}s infinite`
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  const current = slides[slide]

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 24px 32px',
      overflowY: 'auto',
      background: 'var(--bg)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
        <button
          onClick={onComplete}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Skip
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
          gap: '24px'
        }}
      >
        <div
          className="animate-fade-in"
          key={slide}
          style={{
            width: '160px', height: '160px',
            borderRadius: '40px',
            background: current.bg,
            border: `1.5px solid ${current.color}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '72px',
            boxShadow: `0 0 60px ${current.color}20`,
            animation: 'float 3s ease infinite, fade-in 0.4s ease'
          }}
        > 
          {current.icon === floodLogo ? (
            <img src={current.icon} alt={current.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            current.icon
          )}
        </div>

        <div className="animate-fade-in" key={`text-${slide}`} style={{ textAlign: 'center' }}>
          <h2 style={{
            fontSize: '24px', fontWeight: 800,
            color: 'var(--text)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.5px',
            marginBottom: '12px',
            lineHeight: 1.2
          }}>
            {current.title}
          </h2>
          <p style={{
            fontSize: '14px', color: 'var(--text-secondary)',
            lineHeight: 1.7, maxWidth: '280px', margin: '0 auto'
          }}>
            {current.desc}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
        {slides.map((_, i) => (
          <div
            key={i}
            onClick={() => setSlide(i)}
            style={{
              width: i === slide ? '24px' : '8px',
              height: '8px',
              borderRadius: '100px',
              background: i === slide ? current.color : 'var(--border)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
          />
        ))}
      </div>

      {slide < slides.length - 1 ? (
        <button
          className="btn-primary"
          onClick={() => setSlide(slide + 1)}
        >
          Next →
        </button>
      ) : (
        <button
          className="btn-primary"
          style={{ background: `linear-gradient(135deg, var(--primary), var(--primary-dark))`, boxShadow: 'var(--shadow-glow)' }}
          onClick={onComplete}
        >
          🌊 Get Started
        </button>
      )}
    </div>
  )
}
