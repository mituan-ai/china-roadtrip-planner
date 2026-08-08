import { z } from 'zod'

export const coordinateSchema = z.tuple([
  z.number().min(70).max(140),
  z.number().min(15).max(55),
])

export const placeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(4),
  address: z.string().optional(),
  coord: coordinateSchema,
  adcode: z.string().regex(/^\d{6}$/).optional(),
  poiId: z.string().optional(),
  kind: z.enum(['scenic', 'town', 'service', 'endpoint', 'anchor', 'hotel', 'custom']),
  summary: z.string().min(1),
  defaultStayMinutes: z.number().int().min(0).max(720).default(0),
})

export const routeNodeSchema = z.object({
  placeId: z.string().min(1),
  role: z.enum(['stop', 'anchor']),
  optional: z.boolean().default(false),
  stayMinutes: z.number().int().min(0).max(720).optional(),
  note: z.string().optional(),
})

export const routeVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  direction: z.string().min(1),
  nodeRefs: z.array(routeNodeSchema).min(2),
})

export const routeTemplateSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  name: z.string().min(1),
  summary: z.string().min(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  bestSeasons: z.string().min(1),
  caution: z.string().min(1),
  regions: z.array(z.string().min(2)).min(1),
  tags: z.array(z.string().min(1)).min(1),
  reviewedAt: z.string().date(),
  sources: z.array(z.object({ label: z.string(), url: z.string().url().optional() })).min(1),
  variants: z.array(routeVariantSchema).min(1),
})

export type Coordinate = z.infer<typeof coordinateSchema>
export type Place = z.infer<typeof placeSchema>
export type RouteNode = z.infer<typeof routeNodeSchema>
export type RouteVariant = z.infer<typeof routeVariantSchema>
export type RouteTemplate = z.infer<typeof routeTemplateSchema>

export type RoutePlanItem = {
  type: 'route'
  id: string
  routeId: string
  variantId: string
  skippedPlaceIds: string[]
}

export type StopPlanItem = {
  type: 'stop'
  id: string
  place: Place
  stayMinutes: number
}

export type PlanItem = RoutePlanItem | StopPlanItem

export type PlanDay = {
  id: string
  date: string
  departureTime: string
  items: PlanItem[]
}

export type Lodging = {
  afterDayId: string
  place: Place
}

export type TripPlan = {
  schemaVersion: 2
  id: string
  title: string
  startPlace?: Place
  endPlace?: Place
  returnToStart: boolean
  days: PlanDay[]
  lodgings: Lodging[]
}

export type ResolvedPlanPoint = {
  id: string
  place: Place
  visible: boolean
  stayMinutes: number
  sourceItemId: string
  routeId?: string
  role?: 'start' | 'end' | 'lodging'
}

export type DirectionLeg = {
  index: number
  distanceMeters: number
  durationSeconds: number
  polyline: Coordinate[]
}

export type DayDirections = {
  dayId: string
  legs: DirectionLeg[]
  distanceMeters: number
  durationSeconds: number
}
