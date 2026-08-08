import type { Coordinate, DirectionLeg, Place } from '../../domain/types'

type ApiErrorBody = { error?: { message?: string } }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody
    throw new Error(body.error?.message || `请求失败（${response.status}）`)
  }
  return response.json() as Promise<T>
}

export type DirectionsResponse = {
  legs: DirectionLeg[]
  distanceMeters: number
  durationSeconds: number
}

export function fetchDirections(points: Coordinate[], signal?: AbortSignal): Promise<DirectionsResponse> {
  return request('/api/v1/directions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ points, strategy: 0 }),
    signal,
  })
}

export function searchPlaces(query: string, kind: 'hotel' | 'place', city?: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, kind })
  if (city) params.set('city', city)
  return request<{ places: Place[] }>(`/api/v1/places?${params}`, { signal }).then((result) => result.places)
}

export type WeatherForecast = {
  city: string
  adcode: string
  casts: Array<{ date: string, dayweather: string, nightweather: string, daytemp: string, nighttemp: string, daywind: string, daypower: string }>
}

export function fetchWeather(adcode: string, signal?: AbortSignal): Promise<WeatherForecast | null> {
  return request<{ forecast: WeatherForecast | null }>(`/api/v1/weather?adcode=${encodeURIComponent(adcode)}`, { signal }).then((result) => result.forecast)
}

export function fetchMapConfig(): Promise<{ amapJsKey: string, amapJsSecurityCode: string }> {
  return request('/api/v1/config')
}
