import { useState } from 'react'
import { ApiError, submitSOS } from '../api/client'
import type { SOSPayload } from '../api/types'
import { useLocation } from '../hooks/useLocation'

interface SOSModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const EMERGENCY_NUMBERS = [
  { label: 'BPBD Medan', number: '061-451-1234' },
  { label: 'National Emergency', number: '112' },
  { label: 'Police', number: '110' },
  { label: 'Fire & Rescue', number: '113' },
]

export default function SOSModal({ isOpen, onClose, onSuccess }: SOSModalProps) {
  const { lat, lng, loading: locating, accuracy } = useLocation()
  const [step, setStep] = useState<'form' | 'submitting' | 'success' | 'error'>('form')
  const [error, setError] = useState<string>('')
  const [cooldownError, setCooldownError] = useState(false)

  const [age, setAge] = useState<string>('')
  const [isDisabled, setIsDisabled] = useState(false)
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'critical'>('medium')
  const [description, setDescription] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!age || !urgency) {
      setError('Please fill in all required fields')
      return
    }

    const ageNum = parseInt(age, 10)
    if (ageNum < 0 || ageNum > 150) {
      setError('Please enter a valid age')
      return
    }

    // An SOS sent against the fallback city-center coordinates (no real GPS fix
    // yet) could send help to the wrong place — worth one extra second's wait.
    if (locating) {
      setError('Still getting your exact location — please wait a moment and try again.')
      return
    }

    setStep('submitting')
    setError('')

    try {
      const payload: SOSPayload = {
        lat,
        lng,
        age: ageNum,
        is_disabled: isDisabled,
        urgency,
        description: description.trim() || undefined,
        user_id: localStorage.getItem('esster-user-id') || undefined,
      }

      await submitSOS(payload)
      setStep('success')
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 2500)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setCooldownError(true)
        setError('You recently submitted an SOS alert. Please wait 5 minutes before submitting another.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error && err.name === 'AbortError') {
        setError('The request timed out. If you are in immediate danger, call emergency services directly.')
      } else {
        setError('Could not reach the server. If you are in immediate danger, call emergency services directly.')
      }
      setStep('error')
    }
  }

  const handleClose = () => {
    setStep('form')
    setAge('')
    setIsDisabled(false)
    setUrgency('medium')
    setDescription('')
    setError('')
    setCooldownError(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content sos-modal" onClick={(e) => e.stopPropagation()}>
        {step === 'form' && (
          <>
            <div className="modal-header">
              <h2>Emergency SOS Alert</h2>
              <button className="modal-close" onClick={handleClose} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="sos-form">
              <div className="form-group">
                <label htmlFor="age">Age *</label>
                <input
                  id="age"
                  type="number"
                  min="0"
                  max="150"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Enter your age"
                  required
                />
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={isDisabled}
                    onChange={(e) => setIsDisabled(e.target.checked)}
                  />
                  <span>I have a disability</span>
                </label>
              </div>

              <div className="form-group">
                <label>Urgency Level *</label>
                <div className="urgency-selector">
                  <button
                    type="button"
                    className={`urgency-option low ${urgency === 'low' ? 'active' : ''}`}
                    onClick={() => setUrgency('low')}
                  >
                    Low
                  </button>
                  <button
                    type="button"
                    className={`urgency-option medium ${urgency === 'medium' ? 'active' : ''}`}
                    onClick={() => setUrgency('medium')}
                  >
                    Medium
                  </button>
                  <button
                    type="button"
                    className={`urgency-option critical ${urgency === 'critical' ? 'active' : ''}`}
                    onClick={() => setUrgency('critical')}
                  >
                    Critical
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Additional Information</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any specific needs or details? (optional)"
                  rows={3}
                />
              </div>

              <p className="form-hint">
                {locating
                  ? '📍 Getting your exact location…'
                  : accuracy != null
                    ? `📍 Location ready (±${Math.round(accuracy)}m accuracy)`
                    : '📍 Location ready'}
              </p>

              {error && <div className="form-error">{error}</div>}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-danger" disabled={locating}>
                  Send SOS Alert
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'submitting' && (
          <div className="modal-center">
            <div className="spinner"></div>
            <p>Sending SOS alert...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="modal-center success">
            <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <h3>SOS Alert Sent</h3>
            <p>Your location has been recorded and an emergency alert has been created. If you need immediate help, also call one of these numbers:</p>
            <div className="sos-emergency-numbers">
              {EMERGENCY_NUMBERS.map((n) => (
                <a key={n.number} className="sos-emergency-number" href={`tel:${n.number.replace(/-/g, '')}`}>
                  <strong>{n.label}</strong>
                  <span>{n.number}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="modal-center error">
            <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3>{cooldownError ? 'Alert Cooldown' : 'Could Not Send Alert'}</h3>
            <p>{error}</p>
            <div className="sos-emergency-numbers">
              {EMERGENCY_NUMBERS.map((n) => (
                <a key={n.number} className="sos-emergency-number" href={`tel:${n.number.replace(/-/g, '')}`}>
                  <strong>{n.label}</strong>
                  <span>{n.number}</span>
                </a>
              ))}
            </div>
            <div className="form-actions">
              {!cooldownError && (
                <button className="btn-secondary" onClick={() => setStep('form')}>
                  Try Again
                </button>
              )}
              <button className="btn-primary" onClick={handleClose}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
