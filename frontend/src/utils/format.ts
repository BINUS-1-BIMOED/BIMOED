export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export function scoreToRiskClass(score: number): string {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'moderate'
  return 'low'
}

export function mapCoordsToSvg(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  span = 0.08,
): { x: number; y: number } {
  const x = 50 + ((lng - centerLng) / span) * 50
  const y = 50 - ((lat - centerLat) / span) * 50
  return {
    x: Math.max(5, Math.min(95, x)),
    y: Math.max(5, Math.min(95, y)),
  }
}
