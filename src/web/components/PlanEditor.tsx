import { ArrowDown, ArrowLeftRight, ArrowUp, BedDouble, CalendarPlus, MapPin, MapPinPlus, Replace, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { placesById, routesById } from '../../domain/catalog'
import type { PlanDay, PlanItem, Place, TripPlan } from '../../domain/types'
import type { DayRouteView } from '../hooks/useDirections'
import { useWeather } from '../hooks/useWeather'
import { dateLabel, distanceText, durationText, timeline } from '../lib/format'
import { usePlannerStore } from '../store'
import { PlaceSearch } from './PlaceSearch'

type ReplaceTarget = { dayId: string, itemId: string, label: string }

type Props = {
  routes: Map<string, DayRouteView>
  onRetry: () => void
  onReplaceRequest: (target: ReplaceTarget) => void
  onPreviewItem: (item: Extract<PlanItem, { type: 'route' }>) => void
}

function MoveDaySelect({ dayId, itemId }: { dayId: string, itemId: string }) {
  const days = usePlannerStore((state) => state.plan.days)
  const moveItemToDay = usePlannerStore((state) => state.moveItemToDay)
  return <select className="move-day-select" aria-label="移至日期" value={dayId} onChange={(event) => moveItemToDay(dayId, itemId, event.target.value)}>
    {days.map((day) => <option key={day.id} value={day.id}>移至 {dateLabel(day.date)}</option>)}
  </select>
}

function WeatherLine({ day, route }: { day: PlanDay, route?: DayRouteView }) {
  const adcode = route?.points.find((point) => point.visible && point.place.adcode)?.place.adcode
  const forecast = useWeather(adcode)
  const cast = forecast?.casts?.find((item) => item.date === day.date)
  if (!cast) return null
  return <span className="weather-line">{cast.dayweather} {cast.nighttemp}—{cast.daytemp}℃ · {cast.daywind}风{cast.daypower}级</span>
}

function RouteItem({ day, item, index, itemCount, routeView, onReplaceRequest, onPreviewItem }: {
  day: PlanDay
  item: Extract<PlanItem, { type: 'route' }>
  index: number
  itemCount: number
  routeView?: DayRouteView
  onReplaceRequest: Props['onReplaceRequest']
  onPreviewItem: Props['onPreviewItem']
}) {
  const route = routesById.get(item.routeId)
  const variant = route?.variants.find((entry) => entry.id === item.variantId)
  const changeVariant = usePlannerStore((state) => state.changeVariant)
  const toggleSkipped = usePlannerStore((state) => state.toggleSkippedPlace)
  const removeItem = usePlannerStore((state) => state.removeItem)
  const moveDayItem = usePlannerStore((state) => state.moveDayItem)
  const itemPoints = routeView?.points.filter((point) => point.sourceItemId === item.id && point.visible) || []
  const times = timeline(routeView, day.departureTime)
  if (!route || !variant) return null

  return <article className="plan-item route-item" style={{ '--route-color': route.color } as React.CSSProperties} onClick={() => onPreviewItem(item)}>
    <span className="item-line" />
    <div className="item-main">
      <div className="item-title-row"><div><strong>{route.name}</strong><span>{variant.name}</span></div><div className="item-tools">
        <button className="icon-button" title="上移" disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveDayItem(day.id, index, index - 1) }}><ArrowUp size={15} /></button>
        <button className="icon-button" title="下移" disabled={index === itemCount - 1} onClick={(event) => { event.stopPropagation(); moveDayItem(day.id, index, index + 1) }}><ArrowDown size={15} /></button>
        <button className="icon-button" title="更换路线" onClick={(event) => { event.stopPropagation(); onReplaceRequest({ dayId: day.id, itemId: item.id, label: route.name }) }}><Replace size={15} /></button>
        <button className="icon-button danger" title="删除" onClick={(event) => { event.stopPropagation(); removeItem(day.id, item.id) }}><Trash2 size={15} /></button>
      </div></div>
      <select value={variant.id} onClick={(event) => event.stopPropagation()} onChange={(event) => changeVariant(day.id, item.id, event.target.value)}>
        {route.variants.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.direction}</option>)}
      </select>
      <details onClick={(event) => event.stopPropagation()}>
        <summary>{itemPoints.length}个游览节点</summary>
        <ol className="route-node-list">
          {variant.nodeRefs.filter((node) => node.role === 'stop').map((node) => {
            const place = placesById.get(node.placeId)!
            const point = itemPoints.find((entry) => entry.place.id === node.placeId)
            const skipped = item.skippedPlaceIds.includes(node.placeId)
            return <li key={node.placeId} className={skipped ? 'skipped' : ''}>
              <span className="node-clock">{point ? times.get(point.id) : '跳过'}</span>
              <span><strong>{place.name}</strong><small>{place.region}</small></span>
              {node.optional && <label title="是否经过"><input type="checkbox" checked={!skipped} onChange={() => toggleSkipped(day.id, item.id, node.placeId)} />经过</label>}
            </li>
          })}
        </ol>
      </details>
      <MoveDaySelect dayId={day.id} itemId={item.id} />
    </div>
  </article>
}

function StopItem({ dayId, item, index, itemCount, arrivalTime }: { dayId: string, item: Extract<PlanItem, { type: 'stop' }>, index: number, itemCount: number, arrivalTime?: string }) {
  const removeItem = usePlannerStore((state) => state.removeItem)
  const moveDayItem = usePlannerStore((state) => state.moveDayItem)
  const updateStopStay = usePlannerStore((state) => state.updateStopStay)
  return <article className="plan-item stop-item">
    <MapPinPlus size={18} />
    <div className="item-main"><strong>{item.place.name}</strong><span>{arrivalTime ? `${arrivalTime} · ` : ''}{item.place.region}</span></div>
    <div className="item-tools">
      <button className="icon-button" title="上移" disabled={index === 0} onClick={() => moveDayItem(dayId, index, index - 1)}><ArrowUp size={15} /></button>
      <button className="icon-button" title="下移" disabled={index === itemCount - 1} onClick={() => moveDayItem(dayId, index, index + 1)}><ArrowDown size={15} /></button>
      <button className="icon-button danger" title="删除" onClick={() => removeItem(dayId, item.id)}><Trash2 size={15} /></button>
    </div>
    <label className="stay-field">停留<input type="number" min="0" max="720" step="15" value={item.stayMinutes} onChange={(event) => updateStopStay(dayId, item.id, Number(event.target.value))} />分钟</label>
    <MoveDaySelect dayId={dayId} itemId={item.id} />
  </article>
}

export function PlanEditor({ routes, onRetry, onReplaceRequest, onPreviewItem }: Props) {
  const plan = usePlannerStore((state) => state.plan)
  const activeDayId = usePlannerStore((state) => state.activeDayId)
  const setActiveDay = usePlannerStore((state) => state.setActiveDay)
  const addDay = usePlannerStore((state) => state.addDay)
  const removeDay = usePlannerStore((state) => state.removeDay)
  const updateDay = usePlannerStore((state) => state.updateDay)
  const addStop = usePlannerStore((state) => state.addStop)
  const setLodging = usePlannerStore((state) => state.setLodging)
  const setStartPlace = usePlannerStore((state) => state.setStartPlace)
  const setEndPlace = usePlannerStore((state) => state.setEndPlace)
  const setReturnToStart = usePlannerStore((state) => state.setReturnToStart)
  const moveDayItem = usePlannerStore((state) => state.moveDayItem)
  const [search, setSearch] = useState<{ dayId?: string, kind: 'hotel' | 'place' | 'start' | 'end' } | null>(null)
  const [drag, setDrag] = useState<{ dayId: string, index: number } | null>(null)

  function choosePlace(place: Place) {
    if (!search) return
    if (search.kind === 'start') setStartPlace(place)
    else if (search.kind === 'end') setEndPlace(place)
    else if (search.kind === 'hotel' && search.dayId) setLodging(search.dayId, place)
    else if (search.kind === 'place' && search.dayId) addStop(search.dayId, place)
    setSearch(null)
  }

  return <div className="plan-editor">
    <section className="trip-boundaries">
      <button className="boundary-button" onClick={() => setSearch({ kind: 'start' })}><MapPin size={16} /><span><small>起点</small><strong>{plan.startPlace?.name || '选择起点'}</strong><em>{plan.startPlace?.region}</em></span></button>
      <label><input type="checkbox" checked={plan.returnToStart} onChange={(event) => setReturnToStart(event.target.checked)} /><ArrowLeftRight size={14} />返回起点</label>
      {!plan.returnToStart && <button className="boundary-button" onClick={() => setSearch({ kind: 'end' })}><MapPin size={16} /><span><small>终点</small><strong>{plan.endPlace?.name || '选择终点'}</strong><em>{plan.endPlace?.region}</em></span></button>}
      {(!plan.startPlace || !plan.endPlace) && <p className="boundary-warning">补充起点和终点后计算完整路线</p>}
    </section>
    {plan.days.map((day, dayIndex) => {
      const routeView = routes.get(day.id)
      const lodging = plan.lodgings.find((item) => item.afterDayId === day.id)
      const dayTimes = timeline(routeView, day.departureTime)
      const lodgingArrival = lodging ? dayTimes.get(`lodging-end:${lodging.place.id}`) : undefined
      const plannedSeconds = (routeView?.durationSeconds || 0) + (routeView?.points.reduce((sum, point) => sum + point.stayMinutes * 60, 0) || 0)
      return <div key={day.id}>
        <section className={`day-section ${activeDayId === day.id ? 'active' : ''}`} onClick={() => setActiveDay(day.id)}>
          <header className="day-header">
            <div><span className="day-index">D{dayIndex + 1}</span><strong>{dateLabel(day.date)}</strong></div>
            <div className="day-controls">
              <input type="date" value={day.date} onClick={(event) => event.stopPropagation()} onChange={(event) => updateDay(day.id, { date: event.target.value })} />
              <input type="time" value={day.departureTime} onClick={(event) => event.stopPropagation()} onChange={(event) => updateDay(day.id, { departureTime: event.target.value })} title="出发时间" />
              {plan.days.length > 1 && <button className="icon-button danger" title="删除这一天" onClick={(event) => { event.stopPropagation(); removeDay(day.id) }}><Trash2 size={15} /></button>}
            </div>
          </header>
          <div className="day-stats">
            {routeView?.loading ? <span>路线计算中</span> : routeView && routeView.distanceMeters > 0 ? <><span>{distanceText(routeView.distanceMeters)}</span><span>驾驶{durationText(routeView.durationSeconds)}</span></> : <span>至少需要两个明确节点</span>}
            <WeatherLine day={day} route={routeView} />
          </div>
          {routeView?.error && <p className="inline-error">路线未更新：{routeView.error}<button type="button" onClick={(event) => { event.stopPropagation(); onRetry() }}>重试</button></p>}
          {plannedSeconds > 11 * 3600 && <p className="long-day">含停留约{durationText(plannedSeconds)}，当天安排偏满</p>}
          <div className="day-items">
            {day.items.map((item, index) => <div key={item.id} draggable onDragStart={() => setDrag({ dayId: day.id, index })} onDragOver={(event) => event.preventDefault()} onDrop={() => {
              if (drag?.dayId === day.id) moveDayItem(day.id, drag.index, index)
              setDrag(null)
            }}>
              {item.type === 'route'
                ? <RouteItem day={day} item={item} index={index} itemCount={day.items.length} routeView={routeView} onReplaceRequest={onReplaceRequest} onPreviewItem={onPreviewItem} />
                : <StopItem dayId={day.id} item={item} index={index} itemCount={day.items.length} arrivalTime={dayTimes.get(`${item.id}:${item.place.id}`)} />}
            </div>)}
          </div>
          <button className="add-stop" onClick={(event) => { event.stopPropagation(); setSearch({ dayId: day.id, kind: 'place' }) }}><MapPinPlus size={15} />添加地点</button>
        </section>
        {dayIndex < plan.days.length - 1 && <section className="lodging-section">
          <div className="lodging-label"><BedDouble size={16} /><strong>{dateLabel(day.date)}住宿</strong></div>
          {lodging ? <div className="selected-lodging"><span><strong>{lodging.place.name}</strong><small>{lodgingArrival ? `${lodgingArrival}到达 · ` : ''}{lodging.place.region}{lodging.place.address ? ` · ${lodging.place.address}` : ''}</small></span><button className="icon-button" title="清除住宿" onClick={() => setLodging(day.id, null)}><X size={15} /></button></div>
            : <button className="lodging-search-button" onClick={() => setSearch({ dayId: day.id, kind: 'hotel' })}>搜索酒店</button>}
        </section>}
      </div>
    })}
    <button className="add-day" onClick={addDay}><CalendarPlus size={16} />增加一天</button>
    {search && <PlaceSearch kind={search.kind === 'hotel' ? 'hotel' : 'place'} title={search.kind === 'hotel' ? '选择住宿' : search.kind === 'start' ? '选择起点' : search.kind === 'end' ? '选择终点' : '添加地点'} onSelect={choosePlace} onClose={() => setSearch(null)} />}
  </div>
}
