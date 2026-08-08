import { useEffect, useMemo, useRef, useState } from 'react'
import { routeCatalog } from '../../domain/catalog'
import { resolveDayPoints, resolvePlanItem } from '../../domain/plan'
import type { DayDirections, ResolvedPlanPoint, RoutePlanItem, TripPlan } from '../../domain/types'
import { fetchDirections, type DirectionsResponse } from '../lib/api'

export type DayRouteView = DayDirections & {
  points: ResolvedPlanPoint[]
  loading: boolean
  error?: string
}

export function usePlanDirections(plan: TripPlan, retryToken = 0): Map<string, DayRouteView> {
  const [routes, setRoutes] = useState<Map<string, DayRouteView>>(new Map())
  const revision = useRef(0)
  const responseCache = useRef(new Map<string, { signature: string, response: DirectionsResponse }>())
  const signature = useMemo(() => JSON.stringify({ days: plan.days, lodgings: plan.lodgings, startPlace: plan.startPlace, endPlace: plan.endPlace }), [plan.days, plan.lodgings, plan.startPlace, plan.endPlace])

  useEffect(() => {
    const controller = new AbortController()
    const currentRevision = ++revision.current
    const timer = window.setTimeout(async () => {
      const dayPoints = plan.days.map((day, index) => ({
        day,
        points: resolveDayPoints(day, plan.lodgings, plan.days[index - 1]?.id, {
          startPlace: index === 0 ? plan.startPlace : undefined,
          endPlace: index === plan.days.length - 1 ? plan.endPlace : undefined,
        }),
      }))
      setRoutes((previous) => {
        const next = new Map(previous)
        for (const { day, points } of dayPoints) {
          const old = next.get(day.id)
          if (points.length < 2) {
            next.set(day.id, { dayId: day.id, points, legs: [], distanceMeters: 0, durationSeconds: 0, loading: false })
          } else if (old?.legs.length) {
            next.set(day.id, { ...old, loading: true, error: undefined })
          } else {
            next.set(day.id, { dayId: day.id, points, legs: [], distanceMeters: 0, durationSeconds: 0, loading: true })
          }
        }
        return next
      })

      const results = await Promise.all(dayPoints.map(async ({ day, points }) => {
        if (points.length < 2) return { dayId: day.id, points, response: null as DirectionsResponse | null }
        const pointSignature = JSON.stringify(points.map((point) => point.place.coord))
        const cached = responseCache.current.get(day.id)
        if (cached?.signature === pointSignature) return { dayId: day.id, points, response: cached.response }
        try {
          const response = await fetchDirections(points.map((point) => point.place.coord), controller.signal)
          responseCache.current.set(day.id, { signature: pointSignature, response })
          return { dayId: day.id, points, response }
        } catch (error) {
          if (controller.signal.aborted) return { dayId: day.id, points, response: null as DirectionsResponse | null }
          return { dayId: day.id, points, response: null as DirectionsResponse | null, error: error instanceof Error ? error.message : '路线计算失败' }
        }
      }))
      if (controller.signal.aborted || currentRevision !== revision.current) return
      setRoutes((previous) => {
        const next = new Map(previous)
        for (const result of results) {
          const old = next.get(result.dayId)
          if (result.response) {
            next.set(result.dayId, { dayId: result.dayId, points: result.points, ...result.response, loading: false })
          } else if (result.error) {
            next.set(result.dayId, old?.legs.length
              ? { ...old, loading: false, error: result.error }
              : { dayId: result.dayId, points: result.points, legs: [], distanceMeters: 0, durationSeconds: 0, loading: false, error: result.error })
          } else {
            next.set(result.dayId, { dayId: result.dayId, points: result.points, legs: [], distanceMeters: 0, durationSeconds: 0, loading: false })
          }
        }
        return next
      })
    }, 450)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [signature, plan, retryToken])

  return routes
}

export function useRoutePreview(item: RoutePlanItem | null) {
  const points = useMemo(() => item ? resolvePlanItem(item) : [], [item])
  const [response, setResponse] = useState<DirectionsResponse | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    if (points.length < 2) {
      setResponse(null)
      return () => controller.abort()
    }
    void fetchDirections(points.map((point) => point.place.coord), controller.signal).then(setResponse).catch(() => setResponse(null))
    return () => controller.abort()
  }, [points])
  const route = item ? routeCatalog.find((entry) => entry.id === item.routeId) : undefined
  return { points, response, color: route?.color || '#475b66' }
}
