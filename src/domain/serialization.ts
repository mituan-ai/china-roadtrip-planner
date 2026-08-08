import LZString from 'lz-string'
import { z } from 'zod'
import { PLAN_SCHEMA_VERSION } from './plan.js'
import { placeSchema, type TripPlan } from './types.js'

const planItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('route'), id: z.string(), routeId: z.string(), variantId: z.string(), skippedPlaceIds: z.array(z.string()) }),
  z.object({ type: z.literal('stop'), id: z.string(), place: placeSchema, stayMinutes: z.number().int().min(0).max(720) }),
])

const daySchema = z.object({
  id: z.string(),
  date: z.string().date(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  items: z.array(planItemSchema),
})

const lodgingSchema = z.object({ afterDayId: z.string(), place: placeSchema })

const v1PlanSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  title: z.string().min(1).max(100),
  days: z.array(daySchema).min(1).max(30),
  lodgings: z.array(lodgingSchema),
})

export const tripPlanSchema = z.object({
  schemaVersion: z.literal(PLAN_SCHEMA_VERSION),
  id: z.string(),
  title: z.string().min(1).max(100),
  startPlace: placeSchema.optional(),
  endPlace: placeSchema.optional(),
  returnToStart: z.boolean(),
  days: z.array(daySchema).min(1).max(30),
  lodgings: z.array(lodgingSchema),
})

function samePlace(left: z.infer<typeof placeSchema>, right: z.infer<typeof placeSchema>): boolean {
  return left.id === right.id || (left.coord[0] === right.coord[0] && left.coord[1] === right.coord[1])
}

function migrateV1(value: unknown): TripPlan {
  const old = v1PlanSchema.parse(value)
  const days = structuredClone(old.days)
  let startPlace: z.infer<typeof placeSchema> | undefined
  let endPlace: z.infer<typeof placeSchema> | undefined
  const first = days[0]?.items[0]
  if (first?.type === 'stop' && first.place.kind === 'endpoint') {
    startPlace = first.place
    days[0]!.items.shift()
  }
  const lastDay = days.at(-1)
  const last = lastDay?.items.at(-1)
  if (last?.type === 'stop' && last.place.kind === 'endpoint') {
    endPlace = last.place
    lastDay!.items.pop()
  }
  return tripPlanSchema.parse({
    ...old,
    schemaVersion: PLAN_SCHEMA_VERSION,
    days,
    startPlace,
    endPlace,
    returnToStart: Boolean(startPlace && endPlace && samePlace(startPlace, endPlace)),
  })
}

export function migratePlan(value: unknown): TripPlan {
  const version = value && typeof value === 'object' ? (value as { schemaVersion?: unknown }).schemaVersion : undefined
  if (version === PLAN_SCHEMA_VERSION) return tripPlanSchema.parse(value)
  if (version === 1) return migrateV1(value)
  throw new Error(`不支持的行程版本：${String(version ?? '未知')}`)
}

export function parsePlan(value: unknown): TripPlan {
  return migratePlan(value)
}

export function encodePlan(plan: TripPlan, includeLodgings = false): string {
  const shareable = includeLodgings ? plan : { ...plan, lodgings: [] }
  return LZString.compressToEncodedURIComponent(JSON.stringify(shareable))
}

export function decodePlan(encoded: string): TripPlan {
  const json = LZString.decompressFromEncodedURIComponent(encoded)
  if (!json) throw new Error('分享链接无效')
  return parsePlan(JSON.parse(json))
}

export function planFromHash(hash: string): TripPlan | null {
  const match = hash.match(/^#plan=(.+)$/)
  return match?.[1] ? decodePlan(match[1]) : null
}
