import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

export function MapController({
  center,
  zoom,
}: {
  center: [number, number]
  zoom: number
}) {
  const map = useMap()
  const initialRef = useRef(true)

  useEffect(() => {
    map.setView(center, zoom, { animate: !initialRef.current })
    initialRef.current = false
  }, [center, zoom, map])

  return null
}

export function MapResizeFix() {
  const map = useMap()

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(t)
  }, [map])

  return null
}
