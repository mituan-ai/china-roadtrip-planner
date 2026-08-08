import { describe, expect, it } from 'vitest'
import { placesById, routeCatalog, routesById } from '../src/domain/catalog'
import { createExamplePlan, createPlan, createRouteItem, replaceRouteItem, resolveDayPoints, resolvePlanItem, setPlanReturnToStart } from '../src/domain/plan'
import { decodePlan, encodePlan, migratePlan, parsePlan } from '../src/domain/serialization'
import { timeline } from '../src/web/lib/format'

describe('route catalog', () => {
  it('contains validated routes with complete administrative regions', () => {
    expect(routeCatalog).toHaveLength(5)
    for (const route of routeCatalog) {
      expect(route.variants.length).toBeGreaterThan(0)
      for (const variant of route.variants) {
        expect(variant.nodeRefs.length).toBeGreaterThanOrEqual(2)
        for (const node of variant.nodeRefs) {
          const place = placesById.get(node.placeId)
          expect(place).toBeDefined()
          expect(place!.region).toMatch(/省.*(市|州).*(区|县|市|镇|乡)/)
        }
      }
    }
  })

  it('keeps navigation anchors hidden and mandatory', () => {
    const item = createRouteItem('wannan-sichuan-line', 'west-east')
    const points = resolvePlanItem(item)
    const anchor = points.find((point) => point.place.id === 'suhong-anchor')
    expect(anchor).toMatchObject({ visible: false, stayMinutes: 0 })
    expect(item.skippedPlaceIds).not.toContain('suhong-anchor')
  })

  it('can skip optional stops without mutating the template', () => {
    const item = createRouteItem('wannan-sichuan-line', 'west-east')
    const changed = { ...item, skippedPlaceIds: ['redwood'] }
    expect(resolvePlanItem(changed).some((point) => point.place.id === 'redwood')).toBe(false)
    expect(routesById.get(item.routeId)!.variants[0]!.nodeRefs.some((node) => node.placeId === 'redwood')).toBe(true)
  })

  it('keeps reverse variants in exact reverse node order', () => {
    const route = routesById.get('wannan-sichuan-line')!
    const forward = route.variants.find((variant) => variant.id === 'west-east')!.nodeRefs.map((node) => node.placeId)
    const backward = route.variants.find((variant) => variant.id === 'east-west')!.nodeRefs.map((node) => node.placeId)
    expect(backward).toEqual([...forward].reverse())
  })
})

describe('trip plan', () => {
  it('keeps the example geographically progressive without the detouring route', () => {
    const plan = createExamplePlan({ startDate: '2027-05-01', startPlace: placesById.get('qinglong')!, returnToStart: true })
    const dayFiveRoutes = plan.days[2]!.items.filter((item) => item.type === 'route')
    expect(dayFiveRoutes.map((item) => item.routeId)).toEqual(['wanzhe-sky-road', 'zhexi-sky-road'])
    expect(plan.days[3]!.items).toMatchObject([{ type: 'route', routeId: 'qiandaohu-ring' }])
    expect(plan.days.flatMap((day) => day.items).some((item) => item.type === 'route' && item.routeId === 'wanzhe-route-one')).toBe(false)
    expect(plan.days[4]!.items.map((item) => item.type === 'stop' ? item.place.id : item.routeId)).toEqual([
      'huzhou-yishang-street',
      'huzhou-moon-bay',
      'nanxun-ancient-town',
    ])
  })

  it('uses selected lodging as both day boundary points without fallback coordinates', () => {
    const plan = createPlan({ startDate: '2027-05-01', dayCount: 2, startPlace: placesById.get('qinglong')!, endPlace: placesById.get('chujia')!, returnToStart: false })
    const hotel = { ...placesById.get('moon-bay')!, id: 'hotel-test', name: '测试酒店', kind: 'hotel' as const }
    plan.lodgings = [{ afterDayId: plan.days[0]!.id, place: hotel }]
    const dayOne = resolveDayPoints(plan.days[0]!, plan.lodgings, undefined, { startPlace: plan.startPlace })
    const dayTwo = resolveDayPoints(plan.days[1]!, plan.lodgings, plan.days[0]!.id, { endPlace: plan.endPlace })
    expect(dayOne[0]?.role).toBe('start')
    expect(dayOne.at(-1)?.place.id).toBe('hotel-test')
    expect(dayTwo[0]?.place.id).toBe('hotel-test')
    expect(dayTwo.at(-1)?.role).toBe('end')
    plan.lodgings = []
    expect(resolveDayPoints(plan.days[0]!, plan.lodgings)).toHaveLength(0)
  })

  it('replaces a route in place and preserves surrounding custom stops', () => {
    const first = createRouteItem('wannan-sichuan-line')
    const stop = { type: 'stop' as const, id: 'custom', place: placesById.get('qinglong')!, stayMinutes: 0 }
    const replacement = createRouteItem('qiandaohu-ring', 'clockwise')
    const result = replaceRouteItem([stop, first], first.id, replacement)
    expect(result[0]).toBe(stop)
    expect(result[1]).toMatchObject({ id: first.id, routeId: 'qiandaohu-ring', variantId: 'clockwise', skippedPlaceIds: [] })
  })

  it('round-trips share data and excludes lodging by default', () => {
    const plan = createPlan({ startDate: '2027-05-01', dayCount: 3, startPlace: placesById.get('qinglong')!, returnToStart: true })
    plan.lodgings = [{ afterDayId: plan.days[0]!.id, place: { ...placesById.get('moon-bay')!, kind: 'hotel' } }]
    const privateShare = decodePlan(encodePlan(plan))
    const fullShare = decodePlan(encodePlan(plan, true))
    expect(privateShare.lodgings).toEqual([])
    expect(fullShare.lodgings).toHaveLength(1)
    expect(parsePlan(fullShare)).toEqual(fullShare)
  })

  it('builds arrival times from exact adjacent driving legs and stop durations', () => {
    const first = placesById.get('moon-bay')!
    const second = placesById.get('tingxi')!
    const route = {
      dayId: 'day', loading: false, distanceMeters: 1000, durationSeconds: 1800,
      points: [
        { id: 'first', place: first, visible: true, stayMinutes: 30, sourceItemId: 'a' },
        { id: 'second', place: second, visible: true, stayMinutes: 0, sourceItemId: 'b' },
      ],
      legs: [{ index: 0, distanceMeters: 1000, durationSeconds: 1800, polyline: [first.coord, second.coord] }],
    }
    expect(timeline(route, '08:00').get('first')).toBe('08:00')
    expect(timeline(route, '08:00').get('second')).toBe('09:00')
  })

  it('rejects unknown schema versions through the migration entrypoint', () => {
    expect(() => migratePlan({ schemaVersion: 999 })).toThrow('不支持的行程版本')
  })

  it('migrates v1 endpoint stops into v2 trip boundaries', () => {
    const start = placesById.get('qinglong')!
    const end = placesById.get('jiapeng')!
    const migrated = migratePlan({
      schemaVersion: 1,
      id: 'legacy',
      title: '旧行程',
      lodgings: [],
      days: [{ id: 'day', date: '2027-05-01', departureTime: '08:00', items: [
        { type: 'stop', id: 'start', place: start, stayMinutes: 0 },
        { type: 'stop', id: 'middle', place: placesById.get('moon-bay')!, stayMinutes: 30 },
        { type: 'stop', id: 'end', place: end, stayMinutes: 0 },
      ] }],
    })
    expect(migrated).toMatchObject({ schemaVersion: 2, startPlace: { id: start.id }, endPlace: { id: end.id }, returnToStart: false })
    expect(migrated.days[0]!.items.map((item) => item.id)).toEqual(['middle'])
  })

  it('preserves ambiguous v1 stops for manual endpoint completion', () => {
    const stop = placesById.get('moon-bay')!
    const migrated = migratePlan({
      schemaVersion: 1,
      id: 'ambiguous-legacy',
      title: '待补充端点',
      lodgings: [],
      days: [{ id: 'day', date: '2027-05-01', departureTime: '08:00', items: [
        { type: 'stop', id: 'ordinary-stop', place: stop, stayMinutes: 30 },
      ] }],
    })
    expect(migrated.startPlace).toBeUndefined()
    expect(migrated.endPlace).toBeUndefined()
    expect(migrated.days[0]!.items).toMatchObject([{ id: 'ordinary-stop', place: { id: stop.id } }])
  })

  it('clears the copied round-trip endpoint when switching to a one-way trip', () => {
    const start = placesById.get('qinglong')!
    const plan = createPlan({ startDate: '2027-05-01', dayCount: 3, startPlace: start, returnToStart: true })
    const changed = setPlanReturnToStart(plan, false)
    expect(changed).toMatchObject({ returnToStart: false, startPlace: { id: start.id } })
    expect(changed.endPlace).toBeUndefined()
  })
})
