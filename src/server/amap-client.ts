import { LRUCache } from 'lru-cache'
import type { Coordinate, DirectionLeg } from '../domain/types.js'

type FetchLike = typeof fetch

type AmapClientOptions = {
  key: string
  fetchImpl?: FetchLike
  requestTimeoutMs?: number
  minStartIntervalMs?: number
  maxQueuedRequests?: number
}

type AmapEnvelope = {
  status?: string
  info?: string
  infocode?: string
}

const routeCache = new LRUCache<string, DirectionLeg>({ max: 3000, ttl: 24 * 60 * 60 * 1000 })
const placeCache = new LRUCache<string, unknown[]>({ max: 1000, ttl: 10 * 60 * 1000 })
const weatherCache = new LRUCache<string, Record<string, unknown>>({ max: 500, ttl: 30 * 60 * 1000 })

function parsePolyline(raw: string): Coordinate[] {
  return raw.split(';').flatMap((pair) => {
    const [lng, lat] = pair.split(',').map(Number)
    return Number.isFinite(lng) && Number.isFinite(lat) ? [[lng, lat] as Coordinate] : []
  })
}

export class AmapClient {
  readonly key: string
  readonly fetchImpl: FetchLike
  private activeRequests = 0
  private readonly waiting: Array<() => void> = []
  private readonly maxConcurrentRequests = 2
  private readonly requestTimeoutMs: number
  private readonly minStartIntervalMs: number
  private readonly maxQueuedRequests: number
  private nextStartAt = 0
  private startGate: Promise<void> = Promise.resolve()

  constructor({ key, fetchImpl = fetch, requestTimeoutMs = 9000, minStartIntervalMs = 350, maxQueuedRequests = 100 }: AmapClientOptions) {
    this.key = key
    this.fetchImpl = fetchImpl
    this.requestTimeoutMs = requestTimeoutMs
    this.minStartIntervalMs = minStartIntervalMs
    this.maxQueuedRequests = maxQueuedRequests
  }

  private async limited<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= this.maxConcurrentRequests) {
      if (this.waiting.length >= this.maxQueuedRequests) {
        const error = new Error('路线服务当前繁忙，请稍后重试') as Error & { statusCode: number }
        error.statusCode = 503
        throw error
      }
      await new Promise<void>((resolve) => this.waiting.push(resolve))
    }
    this.activeRequests += 1
    try {
      await this.waitForStartSlot()
      return await operation()
    } finally {
      this.activeRequests -= 1
      this.waiting.shift()?.()
    }
  }

  private async waitForStartSlot(): Promise<void> {
    let release: () => void = () => {}
    const previous = this.startGate
    this.startGate = new Promise<void>((resolve) => { release = resolve })
    await previous
    try {
      const delay = Math.max(0, this.nextStartAt - Date.now())
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
      this.nextStartAt = Date.now() + this.minStartIntervalMs
    } finally {
      release()
    }
  }

  private async request<T extends AmapEnvelope>(path: string, params: Record<string, string>, attempts = 3): Promise<T> {
    return this.limited(async () => {
      const query = new URLSearchParams({ key: this.key, ...params })
      let lastInfo = '高德服务暂不可用'
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const response = await this.fetchImpl(`https://restapi.amap.com${path}?${query}`, {
          signal: AbortSignal.timeout(this.requestTimeoutMs),
          headers: { accept: 'application/json' },
        })
        if (!response.ok) throw new Error(`高德服务返回 ${response.status}`)
        const data = await response.json() as T
        if (data.status === '1') return data
        lastInfo = data.info || lastInfo
        if (data.info !== 'CUQPS_HAS_EXCEEDED_THE_LIMIT' || attempt === attempts - 1) break
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
      }
      throw new Error(lastInfo === 'CUQPS_HAS_EXCEEDED_THE_LIMIT' ? '高德请求过于频繁，请稍后重试' : lastInfo)
    })
  }

  async directionLeg(origin: Coordinate, destination: Coordinate, index: number, strategy = 0): Promise<DirectionLeg> {
    const cacheKey = `${origin.join(',')}|${destination.join(',')}|${strategy}`
    const cached = routeCache.get(cacheKey)
    if (cached) return { ...cached, index }

    const data = await this.request<AmapEnvelope & {
      route?: { paths?: Array<{ distance: string, duration: string, steps: Array<{ polyline: string }> }> }
    }>('/v3/direction/driving', {
      origin: origin.join(','),
      destination: destination.join(','),
      strategy: String(strategy),
      extensions: 'base',
    })
    const path = data.route?.paths?.[0]
    if (!path) throw new Error('高德没有返回可驾驶路线')
    const polyline: Coordinate[] = []
    for (const step of path.steps) {
      for (const point of parsePolyline(step.polyline)) {
        const previous = polyline.at(-1)
        if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) polyline.push(point)
      }
    }
    const leg: DirectionLeg = {
      index,
      distanceMeters: Number(path.distance),
      durationSeconds: Number(path.duration),
      polyline,
    }
    routeCache.set(cacheKey, leg)
    return leg
  }

  async directions(points: Coordinate[], strategy = 0): Promise<DirectionLeg[]> {
    const jobs = points.slice(0, -1).map((origin, index) => () => this.directionLeg(origin, points[index + 1]!, index, strategy))
    const results: DirectionLeg[] = new Array(jobs.length)
    let cursor = 0
    const workers = Array.from({ length: Math.min(4, jobs.length) }, async () => {
      while (cursor < jobs.length) {
        const index = cursor++
        results[index] = await jobs[index]!()
      }
    })
    await Promise.all(workers)
    return results
  }

  async searchPlaces(query: string, city: string | undefined, kind: 'hotel' | 'place') {
    const cacheKey = `${query}|${city || ''}|${kind}`
    const cached = placeCache.get(cacheKey)
    if (cached) return cached
    const data = await this.request<AmapEnvelope & { pois?: unknown[] }>('/v3/place/text', {
      keywords: query,
      city: city || '',
      citylimit: city ? 'true' : 'false',
      types: kind === 'hotel' ? '100000' : '',
      offset: '12',
      page: '1',
      extensions: 'base',
    })
    const value = data.pois || []
    placeCache.set(cacheKey, value)
    return value
  }

  async weather(adcode: string) {
    const cached = weatherCache.get(adcode)
    if (cached) return cached
    const data = await this.request<AmapEnvelope & { forecasts?: Array<Record<string, unknown>> }>('/v3/weather/weatherInfo', {
      city: adcode,
      extensions: 'all',
    })
    const value = data.forecasts?.[0] || null
    if (value) weatherCache.set(adcode, value)
    return value
  }
}
