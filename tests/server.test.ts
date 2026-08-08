import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from '../src/server/app'

const apps: Awaited<ReturnType<typeof createServer>>[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function routeResponse() {
  return {
    status: '1',
    route: { paths: [{ distance: '12345', duration: '1800', steps: [{ polyline: '118.1,30.1;118.2,30.2' }] }] },
  }
}

async function testServer(fetchImpl: typeof fetch, requestTimeoutMs = 1000, amapMaxQueuedRequests?: number) {
  const app = await createServer({
    amapWebServiceKey: 'server-key',
    amapJsKey: 'js-key-value',
    amapJsSecurityCode: 'security-code',
    fetchImpl,
    serveStatic: false,
    amapRequestTimeoutMs: requestTimeoutMs,
    amapMinStartIntervalMs: 0,
    amapMaxQueuedRequests,
  })
  apps.push(app)
  return app
}

describe('API', () => {
  it('returns health and public map configuration without the service key', async () => {
    const app = await testServer(vi.fn() as unknown as typeof fetch)
    expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).json()).toEqual({ status: 'ok' })
    const config = (await app.inject({ method: 'GET', url: '/api/v1/config' })).json()
    expect(config).toEqual({ amapJsKey: 'js-key-value', amapJsSecurityCode: 'security-code' })
    expect(JSON.stringify(config)).not.toContain('server-key')
  })

  it('calculates exact adjacent legs and totals', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(routeResponse()), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch
    const app = await testServer(fetchImpl)
    const response = await app.inject({ method: 'POST', url: '/api/v1/directions', payload: { points: [[118.1, 30.1], [118.2, 30.2], [118.3, 30.3]] } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ distanceMeters: 24690, durationSeconds: 3600 })
    expect(response.json().legs).toHaveLength(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rejects malformed coordinate requests before calling AMap', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const app = await testServer(fetchImpl)
    const response = await app.inject({ method: 'POST', url: '/api/v1/directions', payload: { points: [[1, 2]] } })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('INVALID_REQUEST')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('normalizes hotel search results', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: '1', pois: [{ id: 'B001', name: '汉庭酒店', location: '118.4,30.6', pname: '安徽省', cityname: '宣城市', adname: '泾县', adcode: '341823', address: '交通路1号' }] }), { status: 200 })) as unknown as typeof fetch
    const app = await testServer(fetchImpl)
    const response = await app.inject({ method: 'GET', url: '/api/v1/places?q=汉庭&kind=hotel' })
    expect(response.statusCode).toBe(200)
    expect(response.json().places[0]).toMatchObject({ name: '汉庭酒店', region: '安徽省宣城市泾县', kind: 'hotel', adcode: '341823' })
  })

  it('strictly limits place search when a full region is supplied', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => new Response(JSON.stringify({
      status: '1',
      pois: [
        { id: 'B001', name: '西湖', location: '120.1,30.2', pname: '浙江省', cityname: '杭州市', adname: '西湖区', adcode: '330106' },
        { id: 'B002', name: '西湖公园', location: '119.3,26.1', pname: '福建省', cityname: '福州市', adname: '鼓楼区', adcode: '350102' },
      ],
    }), { status: 200 }))
    const app = await testServer(fetchMock as unknown as typeof fetch)
    const response = await app.inject({ method: 'GET', url: '/api/v1/places?q=西湖&city=浙江省杭州市西湖区&kind=place' })
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.searchParams.get('city')).toBe('西湖区')
    expect(url.searchParams.get('citylimit')).toBe('true')
    expect(response.json().places).toHaveLength(1)
    expect(response.json().places[0]).toMatchObject({ name: '西湖', region: '浙江省杭州市西湖区' })
  })

  it('splits a long route into exact adjacent legs', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(routeResponse()), { status: 200 })) as unknown as typeof fetch
    const app = await testServer(fetchImpl)
    const points = Array.from({ length: 18 }, (_, index) => [117 + index * 0.01, 31 + index * 0.01])
    const response = await app.inject({ method: 'POST', url: '/api/v1/directions', payload: { points } })
    expect(response.statusCode).toBe(200)
    expect(response.json().legs).toHaveLength(17)
    expect(fetchImpl).toHaveBeenCalledTimes(17)
  })

  it('rejects routes beyond the public point limit', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const app = await testServer(fetchImpl)
    const points = Array.from({ length: 33 }, (_, index) => [117 + index * 0.01, 31 + index * 0.01])
    const response = await app.inject({ method: 'POST', url: '/api/v1/directions', payload: { points } })
    expect(response.statusCode).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns a structured error when AMap fails', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: '0', info: 'INVALID_USER_KEY' }), { status: 200 })) as unknown as typeof fetch
    const app = await testServer(fetchImpl)
    const response = await app.inject({ method: 'POST', url: '/api/v1/directions', payload: { points: [[116.21, 32.21], [116.22, 32.22]] } })
    expect(response.statusCode).toBe(502)
    expect(response.json()).toEqual({ error: { code: 'UPSTREAM_ERROR', message: 'INVALID_USER_KEY', retryable: true } })
  })

  it('times out stalled AMap requests', async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })) as unknown as typeof fetch
    const app = await testServer(fetchImpl, 20)
    const response = await app.inject({ method: 'POST', url: '/api/v1/directions', payload: { points: [[117.21, 31.21], [117.22, 31.22]] } })
    expect(response.statusCode).toBe(502)
    expect(response.json().error.code).toBe('UPSTREAM_ERROR')
  })

  it('caches repeated route, place and weather lookups', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/direction/driving')) return new Response(JSON.stringify(routeResponse()), { status: 200 })
      if (url.includes('/place/text')) return new Response(JSON.stringify({ status: '1', pois: [] }), { status: 200 })
      return new Response(JSON.stringify({ status: '1', forecasts: [{ city: '测试市', adcode: '340111', casts: [] }] }), { status: 200 })
    }) as unknown as typeof fetch
    const app = await testServer(fetchImpl)
    const directionPayload = { points: [[117.31, 31.31], [117.32, 31.32]] }
    await app.inject({ method: 'POST', url: '/api/v1/directions', payload: directionPayload })
    await app.inject({ method: 'POST', url: '/api/v1/directions', payload: directionPayload })
    await app.inject({ method: 'GET', url: '/api/v1/places?q=缓存测试地点&kind=place' })
    await app.inject({ method: 'GET', url: '/api/v1/places?q=缓存测试地点&kind=place' })
    await app.inject({ method: 'GET', url: '/api/v1/weather?adcode=340111' })
    await app.inject({ method: 'GET', url: '/api/v1/weather?adcode=340111' })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('rate limits excessive directions requests by IP', async () => {
    const app = await testServer(vi.fn() as unknown as typeof fetch)
    const responses = []
    for (let index = 0; index < 11; index += 1) {
      responses.push(await app.inject({ method: 'POST', url: '/api/v1/directions', payload: { points: [[1, 2]] } }))
    }
    const limited = responses.filter((response) => response.statusCode === 429)
    expect(limited).toHaveLength(1)
    expect(limited[0]!.json().error).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
  })

  it('rejects excess upstream work with a retryable 503', async () => {
    const fetchImpl = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
      return new Response(JSON.stringify(routeResponse()), { status: 200 })
    }) as unknown as typeof fetch
    const app = await testServer(fetchImpl, 1000, 0)
    const responses = await Promise.all(Array.from({ length: 3 }, (_, index) => app.inject({
      method: 'POST',
      url: '/api/v1/directions',
      payload: { points: [[123.31 + index * 0.01, 31.31], [123.32 + index * 0.01, 31.32]] },
    })))
    const busy = responses.find((response) => response.statusCode === 503)
    expect(busy?.json().error).toMatchObject({ code: 'SERVICE_BUSY', retryable: true })
  })
})
