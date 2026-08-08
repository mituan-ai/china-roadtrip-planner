import { ArrowLeftRight, CalendarDays, MapPin, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createExamplePlan, createPlan, defaultStartDate, tripExample } from '../../domain/plan'
import type { Place, TripPlan } from '../../domain/types'
import { PlaceSearch } from './PlaceSearch'

type Props = {
  mode: 'new' | 'example'
  onSubmit: (plan: TripPlan) => void
  onCancel?: () => void
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}

function inclusiveDays(start: string, end: string): number {
  return Math.floor((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000) + 1
}

export function TripSetup({ mode, onSubmit, onCancel }: Props) {
  const initialStart = useMemo(defaultStartDate, [])
  const [title, setTitle] = useState(mode === 'example' ? tripExample.title : '我的自驾行程')
  const [startDate, setStartDate] = useState(initialStart)
  const [endDate, setEndDate] = useState(addDays(initialStart, 2))
  const [startPlace, setStartPlace] = useState<Place>()
  const [endPlace, setEndPlace] = useState<Place>()
  const [returnToStart, setReturnToStart] = useState(true)
  const [searchTarget, setSearchTarget] = useState<'start' | 'end' | null>(null)
  const [error, setError] = useState('')
  const dayCount = mode === 'example' ? tripExample.days.length : inclusiveDays(startDate, endDate)

  function changeStartDate(value: string) {
    setStartDate(value)
    if (mode === 'new' && value > endDate) setEndDate(addDays(value, 2))
  }

  function submit() {
    if (!startPlace) return setError('请选择起点')
    if (!returnToStart && !endPlace) return setError('请选择终点')
    if (dayCount < 1 || dayCount > 30) return setError('行程天数需要在1至30天之间')
    const plan = mode === 'example'
      ? createExamplePlan({ startDate, startPlace, endPlace, returnToStart })
      : createPlan({ title, startDate, dayCount, startPlace, endPlace, returnToStart })
    onSubmit(plan)
  }

  return <section className="trip-setup" aria-label={mode === 'example' ? '套用示例' : '新建行程'}>
    <div className="setup-heading">
      <div><span>{mode === 'example' ? '套用示例' : '新建行程'}</span><strong>{mode === 'example' ? tripExample.title : '从起点和日期开始'}</strong></div>
      {onCancel && <button className="icon-button" title="取消" onClick={onCancel}><X size={16} /></button>}
    </div>
    <label className="field-label">行程名称<input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} disabled={mode === 'example'} /></label>
    <div className="date-grid">
      <label className="field-label">开始日期<input type="date" value={startDate} onChange={(event) => changeStartDate(event.target.value)} /></label>
      {mode === 'new' && <label className="field-label">结束日期<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>}
      {mode === 'example' && <div className="setup-duration"><CalendarDays size={15} /><span>{tripExample.days.length}天</span></div>}
    </div>
    <div className="endpoint-grid">
      <button className="endpoint-picker" onClick={() => setSearchTarget('start')}><MapPin size={16} /><span><small>起点</small><strong>{startPlace?.name || '搜索地点'}</strong>{startPlace && <em>{startPlace.region}</em>}</span></button>
      <label className="round-trip"><input type="checkbox" checked={returnToStart} onChange={(event) => setReturnToStart(event.target.checked)} /><ArrowLeftRight size={14} />返回起点</label>
      {!returnToStart && <button className="endpoint-picker" onClick={() => setSearchTarget('end')}><MapPin size={16} /><span><small>终点</small><strong>{endPlace?.name || '搜索地点'}</strong>{endPlace && <em>{endPlace.region}</em>}</span></button>}
    </div>
    {error && <p className="setup-error">{error}</p>}
    <button className="primary setup-submit" onClick={submit}>{mode === 'example' ? '套用六日示例' : `创建${dayCount > 0 ? dayCount : ''}日行程`}</button>
    {searchTarget && <PlaceSearch kind="place" title={searchTarget === 'start' ? '选择起点' : '选择终点'} onSelect={(place) => {
      if (searchTarget === 'start') setStartPlace(place)
      else setEndPlace(place)
      setSearchTarget(null)
      setError('')
    }} onClose={() => setSearchTarget(null)} />}
  </section>
}
