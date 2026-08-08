import type { DayRouteView } from '../hooks/useDirections'

export function durationText(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}小时${rest ? `${rest}分` : ''}` : `${rest}分钟`
}

export function distanceText(meters: number): string {
  return `${Math.round(meters / 1000)} km`
}

export function dateLabel(date: string): string {
  const value = new Date(`${date}T12:00:00`)
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(value)
}

function minutesFromTime(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function clockText(totalMinutes: number): string {
  const value = ((Math.round(totalMinutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function timeline(route: DayRouteView | undefined, departureTime: string): Map<string, string> {
  const result = new Map<string, string>()
  if (!route) return result
  let cursor = minutesFromTime(departureTime)
  route.points.forEach((point, index) => {
    result.set(point.id, clockText(cursor))
    cursor += point.stayMinutes
    const leg = route.legs[index]
    if (leg) cursor += leg.durationSeconds / 60
  })
  return result
}
