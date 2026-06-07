import { useEffect, useState } from 'react'

const DEFAULT_LAT = 3.5952
const DEFAULT_LNG = 98.6722

export function useLocation() {
  const [lat, setLat] = useState(DEFAULT_LAT)
  const [lng, setLng] = useState(DEFAULT_LNG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setLoading(false)
      },
      () => {
        setError('Using default Medan location')
        setLoading(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }, [])

  return { lat, lng, loading, error, label: 'Medan, North Sumatra' }
}
