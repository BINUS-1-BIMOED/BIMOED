import { useCallback, useRef, useState } from 'react'
import { getEvacuationRoute } from '../api/client'
import type { EvacuationRoute, SafeZone } from '../api/types'

import { haversineKm, bearing } from '../utils/geo'

export interface NavigationState {
  route: EvacuationRoute | null
  active: boolean
  loading: boolean
  currentStepIndex: number
  progressPercent: number
  distanceRemainingKm: number
  durationRemainingMin: number
  nextInstruction: string
  nextInstructionDistance: number
  deviationDetected: boolean
  rerouting: boolean
}

export interface UseNavigationReturn extends NavigationState {
  startNavigation: (originLat: number, originLng: number, dest?: SafeZone) => Promise<void>
  stopNavigation: () => void
  updatePosition: (lat: number, lng: number, heading?: number | null) => void
  requestReroute: (lat: number, lng: number) => Promise<void>
}

const REROUTE_DEVIATION_KM = 0.15 // 150m deviation triggers reroute


/**
 * Find the closest point on a polyline to a given position.
 * Returns the segment index and progress along the route.
 */
function closestPointOnRoute(
  geometry: [number, number][],
  lat: number,
  lng: number,
): { segmentIndex: number; totalProgress: number; minDistKm: number } {
  let minDistKm = Infinity
  let segmentIndex = 0
  let totalDist = 0
  const cumulativeDist: number[] = [0]

  // Calculate cumulative distances
  for (let i = 1; i < geometry.length; i++) {
    const d = haversineKm(geometry[i - 1][0], geometry[i - 1][1], geometry[i][0], geometry[i][1])
    totalDist += d
    cumulativeDist.push(totalDist)
  }

  // Find closest segment
  for (let i = 0; i < geometry.length - 1; i++) {
    const d = pointToSegmentKm(
      lat, lng,
      geometry[i][0], geometry[i][1],
      geometry[i + 1][0], geometry[i + 1][1],
    )
    if (d < minDistKm) {
      minDistKm = d
      segmentIndex = i
    }
  }

  // Calculate progress percentage
  const distToSegmentStart = cumulativeDist[segmentIndex]
  const segLen = cumulativeDist[segmentIndex + 1] - cumulativeDist[segmentIndex]
  const progressAlongSegment = segLen > 0
    ? haversineKm(geometry[segmentIndex][0], geometry[segmentIndex][1], lat, lng) / segLen
    : 0

  const totalProgress = totalDist > 0
    ? Math.min(1, (distToSegmentStart + progressAlongSegment * segLen) / totalDist)
    : 0

  return { segmentIndex, totalProgress, minDistKm }
}

/**
 * Distance from point P to line segment AB in km.
 */
function pointToSegmentKm(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const dAb = haversineKm(aLat, aLng, bLat, bLng)
  if (dAb < 0.001) return haversineKm(pLat, pLng, aLat, aLng)

  // Project point onto line using bearing approximation
  const abBearing = bearing(aLat, aLng, bLat, bLng)
  const apBearing = bearing(aLat, aLng, pLat, pLng)
  const apDist = haversineKm(aLat, aLng, pLat, pLng)

  const angleDiff = ((apBearing - abBearing) * Math.PI) / 180
  const projection = apDist * Math.cos(angleDiff)

  if (projection <= 0) return apDist
  if (projection >= dAb) return haversineKm(pLat, pLng, bLat, bLng)

  const crossDist = Math.abs(apDist * Math.sin(angleDiff))
  return crossDist
}

export function useNavigation(): UseNavigationReturn {
  const [state, setState] = useState<NavigationState>({
    route: null,
    active: false,
    loading: false,
    currentStepIndex: 0,
    progressPercent: 0,
    distanceRemainingKm: 0,
    durationRemainingMin: 0,
    nextInstruction: '',
    nextInstructionDistance: 0,
    deviationDetected: false,
    rerouting: false,
  })

  const routeRef = useRef<EvacuationRoute | null>(null)
  const activeRef = useRef(false)
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null)

  const updateNavigationState = useCallback((partial: Partial<NavigationState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  const startNavigation = useCallback(async (originLat: number, originLng: number, dest?: SafeZone) => {
    updateNavigationState({ loading: true, active: true })
    try {
      const result = await getEvacuationRoute(originLat, originLng, dest?.lat, dest?.lng)
      routeRef.current = result
      activeRef.current = true
      lastPositionRef.current = { lat: originLat, lng: originLng }

      const totalDist = result.distance_km
      const totalDur = result.duration_min
      const firstInstruction = result.steps?.[0]?.instruction ?? 'Follow route to safe zone'
      const firstStepDist = result.steps?.[0]?.distance_m ?? totalDist * 1000

      updateNavigationState({
        route: result,
        loading: false,
        currentStepIndex: 0,
        progressPercent: 0,
        distanceRemainingKm: totalDist,
        durationRemainingMin: totalDur,
        nextInstruction: firstInstruction,
        nextInstructionDistance: firstStepDist,
        deviationDetected: false,
        rerouting: false,
      })
    } catch {
      updateNavigationState({ loading: false, active: false, route: null })
    }
  }, [updateNavigationState])

  const stopNavigation = useCallback(() => {
    routeRef.current = null
    activeRef.current = false
    lastPositionRef.current = null
    updateNavigationState({
      route: null,
      active: false,
      loading: false,
      currentStepIndex: 0,
      progressPercent: 0,
      distanceRemainingKm: 0,
      durationRemainingMin: 0,
      nextInstruction: '',
      nextInstructionDistance: 0,
      deviationDetected: false,
      rerouting: false,
    })
  }, [updateNavigationState])

  const updatePosition = useCallback((lat: number, lng: number, _heading?: number | null) => {
    const route = routeRef.current
    if (!route || !activeRef.current) return

    const geometry = route.geometry
    if (geometry.length < 2) return

    const { totalProgress, minDistKm } = closestPointOnRoute(geometry, lat, lng)


    // Check for deviation
    const deviation = minDistKm > REROUTE_DEVIATION_KM
    if (deviation && !state.deviationDetected) {
      updateNavigationState({ deviationDetected: true })
    } else if (!deviation && state.deviationDetected) {
      updateNavigationState({ deviationDetected: false })
    }

    // Calculate remaining distance and duration
    const totalDist = route.distance_km
    const remainingDist = totalDist * (1 - totalProgress)
    const remainingDur = route.duration_min * (1 - totalProgress)

    // Determine current step
    let stepIndex = 0
    let cumulativeDist = 0
    const stepDistances = route.steps?.map(s => s.distance_m / 1000) ?? [totalDist]

    for (let i = 0; i < stepDistances.length; i++) {
      const stepEnd = cumulativeDist + stepDistances[i]
      if (totalProgress * totalDist <= stepEnd) {
        stepIndex = i
        break
      }
      cumulativeDist += stepDistances[i]
    }

    // Get next instruction
    const nextStep = route.steps?.[Math.min(stepIndex, route.steps.length - 1)]
    const nextInstruction = nextStep?.instruction ?? 'Continue to destination'
    const nextDist = nextStep?.distance_m ?? remainingDist * 1000

    updateNavigationState({
      currentStepIndex: stepIndex,
      progressPercent: Math.round(totalProgress * 100),
      distanceRemainingKm: Math.max(0, remainingDist),
      durationRemainingMin: Math.max(0, remainingDur),
      nextInstruction,
      nextInstructionDistance: nextDist,
    })

    lastPositionRef.current = { lat, lng }
  }, [state.deviationDetected, updateNavigationState])

  const requestReroute = useCallback(async (lat: number, lng: number) => {
    const route = routeRef.current
    if (!route) return

    updateNavigationState({ rerouting: true, loading: true })
    try {
      const result = await getEvacuationRoute(lat, lng, route.destination.lat, route.destination.lng)
      routeRef.current = result
      activeRef.current = true
      lastPositionRef.current = { lat, lng }

      updateNavigationState({
        route: result,
        loading: false,
        rerouting: false,
        deviationDetected: false,
        currentStepIndex: 0,
        progressPercent: 0,
        distanceRemainingKm: result.distance_km,
        durationRemainingMin: result.duration_min,
        nextInstruction: result.steps?.[0]?.instruction ?? 'Follow route to safe zone',
        nextInstructionDistance: result.steps?.[0]?.distance_m ?? result.distance_km * 1000,
      })
    } catch {
      updateNavigationState({ rerouting: false, loading: false })
    }
  }, [updateNavigationState])

  return {
    ...state,
    startNavigation,
    stopNavigation,
    updatePosition,
    requestReroute,
  }
}