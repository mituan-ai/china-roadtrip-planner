import { z } from 'zod'
import { createServer } from './app.js'

const env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  AMAP_JS_KEY: z.string().min(8),
  AMAP_JS_SECURITY_CODE: z.string().default(''),
  AMAP_WEB_SERVICE_KEY: z.string().min(8),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DIRECTIONS_RATE_LIMIT: z.coerce.number().int().min(1).max(120).default(10),
  PLACES_RATE_LIMIT: z.coerce.number().int().min(1).max(240).default(30),
  WEATHER_RATE_LIMIT: z.coerce.number().int().min(1).max(120).default(20),
  AMAP_MAX_QUEUED_REQUESTS: z.coerce.number().int().min(10).max(1000).default(100),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.AMAP_JS_SECURITY_CODE.length < 8) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['AMAP_JS_SECURITY_CODE'], message: '生产环境必须配置高德 Web JS Security Code' })
  }
}).parse(process.env)

const app = await createServer({
  amapJsKey: env.AMAP_JS_KEY,
  amapJsSecurityCode: env.AMAP_JS_SECURITY_CODE,
  amapWebServiceKey: env.AMAP_WEB_SERVICE_KEY,
  logger: true,
  trustProxy: env.TRUST_PROXY,
  directionsRateLimit: env.DIRECTIONS_RATE_LIMIT,
  placesRateLimit: env.PLACES_RATE_LIMIT,
  weatherRateLimit: env.WEATHER_RATE_LIMIT,
  amapMaxQueuedRequests: env.AMAP_MAX_QUEUED_REQUESTS,
})

await app.listen({ host: '0.0.0.0', port: env.PORT })
