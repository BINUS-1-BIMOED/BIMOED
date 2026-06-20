import { useCallback, useEffect, useRef, useState } from 'react'
import { saveLastPosition, getLastPosition } from '../utils/storage'

const DEFAULT_LAT = 3.5952
const DEFAULT_LNG = 98.6722

export interface LocationState {
  lat: number
  lng: number
  heading: number | null      // degrees, for rotating the marker
  speed: number | null        // m/s
  accuracy: number | null     // meters
  timestamp: number
}

export function useLocation(highAccuracy = false) {
  const [location, setLocation] = useState<LocationState>({
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
    heading: null,
    speed: null,
    accuracy: null,
    timestamp: Date.now(),
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const updatePosition = useCallback((pos: GeolocationPosition) => {
    const newLoc: LocationState = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    }
    setLocation(newLoc)
    saveLastPosition(newLoc.lat, newLoc.lng)
    setLoading(false)
  }, [])

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.warn('[useLocation] Geolocation error:', err.message)
    setError(err.message || 'Location unavailable')
    setLoading(false)
  }, [])

  useEffect(() => {
    // Restore last known position from storage
    getLastPosition().then((saved) => {
      if (saved) {
        setLocation(prev => ({
          ...prev,
          lat: saved.lat,
          lng: saved.lng,
        }))
        setLoading(false)
      }
    })

    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      setLoading(false)
      return
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      updatePosition,
      handleError,
      {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: highAccuracy ? 5000 : 30000,
      },
    )

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      updatePosition,
      handleError,
      {
        enableHighAccuracy: highAccuracy,
        timeout: highAccuracy ? 5000 : 10000,
        maximumAge: highAccuracy ? 2000 : 15000,
      },
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [highAccuracy, updatePosition, handleError])

  return {
    ...location,
    loading,
    error,
    label: 'Medan, North Sumatra',
  }
}