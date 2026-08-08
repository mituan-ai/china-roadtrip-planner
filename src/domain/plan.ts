import { placesById, routesById } from './catalog.js'
import type { Lodging, Place, PlanDay, PlanItem, ResolvedPlanPoint, RoutePlanItem, TripPlan } from './types.js'

export const PLAN_SCHEMA_VERSION = 2 as const

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

export function createRouteItem(routeId: string, variantId?: string): RoutePlanItem {
  const route = routesById.get(routeId)
  if (!route) throw new Error(`Unknown route: ${routeId}`)
  const variant = variantId ? route.variants.find((item) => item.id === variantId) : route.variants[0]
  if (!variant) throw new Error(`Unknown variant: ${routeId}/${variantId}`)
  return { type: 'route', id: newId('route'), routeId, variantId: variant.id, skippedPlaceIds: [] }
}

export function resolvePlanItem(item: PlanItem): ResolvedPlanPoint[] {
  if (item.type === 'stop') {
    return [{ id: `${item.id}:${item.place.id}`, place: item.place, visible: true, stayMinutes: item.stayMinutes, sourceItemId: item.id }]
  }
  const route = routesById.get(item.routeId)
  const variant = route?.variants.find((entry) => entry.id === item.variantId)
  if (!route || !variant) return []
  return variant.nodeRefs.flatMap((node, index) => {
    const place = placesById.get(node.placeId)
    if (!place || (node.optional && item.skippedPlaceIds.includes(node.placeId))) return []
    return [{
      id: `${item.id}:${node.placeId}:${index}`,
      place,
      visible: node.role === 'stop',
      stayMinutes: node.role === 'anchor' ? 0 : (node.stayMinutes ?? place.defaultStayMinutes),
      sourceItemId: item.id,
      routeId: route.id,
    }]
  })
}

export function resolveDayPoints(day: PlanDay, lodgings: Lodging[], previousDayId?: string, boundaries?: { startPlace?: Place, endPlace?: Place }): ResolvedPlanPoint[] {
  const previousLodging = previousDayId ? lodgings.find((item) => item.afterDayId === previousDayId) : undefined
  const currentLodging = lodgings.find((item) => item.afterDayId === day.id)
  const points = [
    ...(boundaries?.startPlace ? [{ id: `trip-start:${boundaries.startPlace.id}`, place: boundaries.startPlace, visible: true, stayMinutes: 0, sourceItemId: 'trip-start', role: 'start' as const }] : []),
    ...(previousLodging ? [{ id: `lodging-start:${previousLodging.place.id}`, place: previousLodging.place, visible: true, stayMinutes: 0, sourceItemId: 'lodging', role: 'lodging' as const }] : []),
    ...day.items.flatMap(resolvePlanItem),
    ...(currentLodging ? [{ id: `lodging-end:${currentLodging.place.id}`, place: currentLodging.place, visible: true, stayMinutes: 0, sourceItemId: 'lodging', role: 'lodging' as const }] : []),
    ...(boundaries?.endPlace ? [{ id: `trip-end:${boundaries.endPlace.id}`, place: boundaries.endPlace, visible: true, stayMinutes: 0, sourceItemId: 'trip-end', role: 'end' as const }] : []),
  ] satisfies ResolvedPlanPoint[]
  return points.filter((point, index) => {
    if (index === 0) return true
    const previous = points[index - 1]
    return previous?.place.coord[0] !== point.place.coord[0] || previous?.place.coord[1] !== point.place.coord[1]
  })
}

export function moveItem(items: PlanItem[], from: number, to: number): PlanItem[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return items
  const copy = [...items]
  const [moved] = copy.splice(from, 1)
  if (!moved) return items
  copy.splice(to, 0, moved)
  return copy
}

export function replaceRouteItem(items: PlanItem[], itemId: string, replacement: RoutePlanItem): PlanItem[] {
  return items.map((item) => item.id === itemId && item.type === 'route' ? { ...replacement, id: item.id } : item)
}

const exampleStop = (id: string, placeId: string) => {
  const place = placesById.get(placeId)
  if (!place) throw new Error(`Unknown example place: ${placeId}`)
  return { type: 'stop' as const, id, place, stayMinutes: place.defaultStayMinutes }
}

export const tripExample = {
  id: 'wannan-zhexi-six-day',
  title: '皖南三线、千岛湖与湖州 · 6日示例',
  days: [
    { departureTime: '08:00', items: [] },
    { departureTime: '08:00', items: [createRouteItem('wannan-sichuan-line', 'west-east')] },
    { departureTime: '07:30', items: [createRouteItem('wanzhe-sky-road', 'jiapeng-daoshi'), createRouteItem('zhexi-sky-road', 'core-southbound')] },
    { departureTime: '07:30', items: [createRouteItem('qiandaohu-ring', 'counterclockwise')] },
    { departureTime: '08:00', items: [
      exampleStop('stop-huzhou-yishang', 'huzhou-yishang-street'),
      exampleStop('stop-huzhou-moon-bay', 'huzhou-moon-bay'),
      exampleStop('stop-nanxun', 'nanxun-ancient-town'),
    ] },
    { departureTime: '07:30', items: [] },
  ],
} as const

function dateAt(startDate: string, offset: number): string {
  const date = new Date(`${startDate}T12:00:00`)
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function createPlan(input: { title?: string, startDate: string, dayCount: number, startPlace?: Place, endPlace?: Place, returnToStart?: boolean }): TripPlan {
  const returnToStart = input.returnToStart ?? true
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    id: newId('plan'),
    title: input.title?.trim() || '我的自驾行程',
    startPlace: input.startPlace,
    endPlace: returnToStart ? input.startPlace : input.endPlace,
    returnToStart,
    lodgings: [],
    days: Array.from({ length: input.dayCount }, (_, index) => ({
      id: newId('day'),
      date: dateAt(input.startDate, index),
      departureTime: '08:00',
      items: [],
    })),
  }
}

export function setPlanReturnToStart(plan: TripPlan, returnToStart: boolean): TripPlan {
  return {
    ...plan,
    returnToStart,
    endPlace: returnToStart ? plan.startPlace : undefined,
  }
}

export function createExamplePlan(input: { startDate: string, startPlace: Place, endPlace?: Place, returnToStart: boolean }): TripPlan {
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    id: newId('plan'),
    title: tripExample.title,
    startPlace: input.startPlace,
    endPlace: input.returnToStart ? input.startPlace : input.endPlace,
    returnToStart: input.returnToStart,
    lodgings: [],
    days: tripExample.days.map((day, index) => ({
      id: newId('day'),
      date: dateAt(input.startDate, index),
      departureTime: day.departureTime,
      items: structuredClone(day.items) as unknown as PlanItem[],
    })),
  }
}

export function defaultStartDate(): string {
  return dateAt(new Date().toISOString().slice(0, 10), 1)
}
