import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z, ZodError } from 'zod'
import { coordinateSchema } from '../domain/types.js'
import { AmapClient } from './amap-client.js'

type ServerOptions = {
  amapWebServiceKey: string
  amapJsKey: string
  amapJsSecurityCode: string
  fetchImpl?: typeof fetch
  serveStatic?: boolean
  logger?: boolean
  amapRequestTimeoutMs?: number
  amapMinStartIntervalMs?: number
  amapMaxQueuedRequests?: number
  trustProxy?: boolean
  directionsRateLimit?: number
  placesRateLimit?: number
  weatherRateLimit?: number
}

const directionsSchema = z.object({
  points: z.array(coordinateSchema).min(2).max(32),
  strategy: z.number().int().min(0).max(20).default(0),
})

const placeQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  city: z.string().trim().max(30).optional(),
  kind: z.enum(['hotel', 'place']).default('place'),
})

const weatherQuerySchema = z.object({ adcode: z.string().regex(/^\d{6}$/) })

function poiRegion(poi: Record<string, unknown>): string {
  const parts = [poi.pname, poi.cityname, poi.adname].filter((value): value is string => typeof value === 'string' && value.length > 0 && value !== '[]')
  return [...new Set(parts)].join('')
}

function normalizePoi(value: unknown, kind: 'hotel' | 'place') {
  const poi = value as Record<string, unknown>
  if (typeof poi.location !== 'string' || typeof poi.name !== 'string') return null
  const coord = poi.location.split(',').map(Number)
  const parsed = coordinateSchema.safeParse(coord)
  if (!parsed.success) return null
  return {
    id: typeof poi.id === 'string' ? `amap-${poi.id}` : `amap-${poi.location}-${poi.name}`,
    poiId: typeof poi.id === 'string' ? poi.id : undefined,
    name: poi.name,
    region: poiRegion(poi) || '行政区待确认',
    address: typeof poi.address === 'string' && poi.address ? poi.address : undefined,
    coord: parsed.data,
    adcode: typeof poi.adcode === 'string' && /^\d{6}$/.test(poi.adcode) ? poi.adcode : undefined,
    kind: kind === 'hotel' ? 'hotel' : 'custom',
    summary: kind === 'hotel' ? '住宿节点' : '自定义行程节点',
    defaultStayMinutes: kind === 'hotel' ? 0 : 30,
  }
}

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: options.trustProxy ?? false, bodyLimit: 64 * 1024 })
  const amap = new AmapClient({
    key: options.amapWebServiceKey,
    fetchImpl: options.fetchImpl,
    requestTimeoutMs: options.amapRequestTimeoutMs,
    minStartIntervalMs: options.amapMinStartIntervalMs,
    maxQueuedRequests: options.amapMaxQueuedRequests,
  })

  await app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute' })

  app.get('/api/v1/health', async () => ({ status: 'ok' }))
  app.get('/api/v1/config', async () => ({ amapJsKey: options.amapJsKey, amapJsSecurityCode: options.amapJsSecurityCode }))

  app.post('/api/v1/directions', { config: { rateLimit: { max: options.directionsRateLimit ?? 10, timeWindow: '1 minute' } } }, async (request) => {
    const input = directionsSchema.parse(request.body)
    const legs = await amap.directions(input.points, input.strategy)
    return {
      legs,
      distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
      durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    }
  })

  app.get('/api/v1/places', { config: { rateLimit: { max: options.placesRateLimit ?? 30, timeWindow: '1 minute' } } }, async (request) => {
    const input = placeQuerySchema.parse(request.query)
    const pois = await amap.searchPlaces(input.q, input.city, input.kind) as unknown[]
    return { places: pois.map((poi) => normalizePoi(poi, input.kind)).filter(Boolean) }
  })

  app.get('/api/v1/weather', { config: { rateLimit: { max: options.weatherRateLimit ?? 20, timeWindow: '1 minute' } } }, async (request) => {
    const input = weatherQuerySchema.parse(request.query)
    return { forecast: await amap.weather(input.adcode) }
  })

  app.setErrorHandler((error, request, reply) => {
    const serverError = error as { statusCode?: number, message?: string }
    const statusCode = error instanceof ZodError ? 400 : (serverError.statusCode && serverError.statusCode >= 400 ? serverError.statusCode : 502)
    const message = error instanceof ZodError ? '请求参数不正确' : (serverError.message || '服务暂不可用')
    const code = error instanceof ZodError
      ? 'INVALID_REQUEST'
      : statusCode === 429
        ? 'RATE_LIMITED'
        : statusCode === 503
          ? 'SERVICE_BUSY'
          : 'UPSTREAM_ERROR'
    if (statusCode >= 500) request.log.error({ error: message }, 'request failed')
    void reply.status(statusCode).send({ error: { code, message, retryable: statusCode === 429 || statusCode >= 500 } })
  })

  if (options.serveStatic !== false) {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const clientRoot = path.resolve(currentDir, '../../client')
    await app.register(fastifyStatic, { root: clientRoot })
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '接口不存在' } })
      return reply.sendFile('index.html')
    })
  }

  return app
}
