import { useState } from 'react'
import { submitSOS } from '../api/client'
import type { SOSPayload } from '../api/types'
import { useLocation } from '../hooks/useLocation'

interface SOSModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function SOSModal({ isOpen, onClose, onSuccess }: SOSModalProps) {
  const { lat, lng } = useLocation()
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
        user_id: localStorage.getItem('escood-user-id') || undefined,
      }

      await submitSOS(payload)
      setStep('success')
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('cooldown')) {
        setCooldownError(true)
        setError('You recently submitted an SOS alert. Please wait 5 minutes before submitting another.')
      } else if (msg.includes('flood-risk')) {
        setError('SOS can only be submitted in flood-risk areas. Your current location is not in a risk zone.')
      } else {
        setError(`Error: ${msg}`)
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

              {error && <div className="form-error">{error}</div>}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-danger">
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
            <h3>SOS Alert Terkirim!</h3>
            <p>Lokasi Anda telah dicatat dan alert darurat dibuat. Hubungi BPBD Medan (061-451-1234) atau layanan darurat 112/110/113 jika perlu.</p>
          </div>
        )}

        {step === 'error' && (
          <div className="modal-center error">
            <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3>{cooldownError ? 'Alert Cooldown' : 'Error'}</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={handleClose}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
