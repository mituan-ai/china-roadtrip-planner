import { Eye, Plus, Replace, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { routeCatalog } from '../../domain/catalog'
import { createRouteItem } from '../../domain/plan'
import type { RoutePlanItem } from '../../domain/types'
import { usePlannerStore } from '../store'

type ReplaceTarget = { dayId: string, itemId: string, label: string } | null

type Props = {
  activeDayId: string
  replaceTarget: ReplaceTarget
  onAdd: (routeId: string, variantId: string, dayId: string) => void
  onCancelReplace: () => void
  onPreview: (item: RoutePlanItem) => void
}

export function RouteLibrary({ activeDayId, replaceTarget, onAdd, onCancelReplace, onPreview }: Props) {
  const plan = usePlannerStore((state) => state.plan)
  const [variants, setVariants] = useState<Record<string, string>>(() => Object.fromEntries(routeCatalog.map((route) => [route.id, route.variants[0]!.id])))
  const [targetDayId, setTargetDayId] = useState(activeDayId)
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('')
  const regions = [...new Set(routeCatalog.flatMap((route) => route.regions))]
  const filtered = routeCatalog.filter((route) => {
    const text = `${route.name} ${route.summary} ${route.regions.join(' ')} ${route.tags.join(' ')}`.toLowerCase()
    return (!query.trim() || text.includes(query.trim().toLowerCase())) && (!region || route.regions.includes(region))
  })

  useEffect(() => {
    const first = routeCatalog[0]
    if (first) onPreview(createRouteItem(first.id, variants[first.id]))
  }, [])

  useEffect(() => setTargetDayId(activeDayId), [activeDayId])

  return <div className="route-library">
    {replaceTarget && <div className="replace-banner"><span>替换：{replaceTarget.label}</span><button onClick={onCancelReplace}>取消</button></div>}
    <div className="library-controls">
      <label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="路线、地区或景观" /></label>
      <select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="路线地区"><option value="">全部地区</option>{regions.map((item) => <option key={item}>{item}</option>)}</select>
      {!replaceTarget && <select value={targetDayId} onChange={(event) => setTargetDayId(event.target.value)} aria-label="加入日期">{plan.days.map((day) => <option key={day.id} value={day.id}>{day.date}</option>)}</select>}
    </div>
    <p className="library-count">首批{routeCatalog.length}条已核验路线 · 皖南与浙西</p>
    {filtered.map((route) => {
      const variantId = variants[route.id] || route.variants[0]!.id
      return <article className="route-card" key={route.id} style={{ '--route-color': route.color } as React.CSSProperties}>
        <div className="route-card-head"><span className="route-swatch" /><div><h2>{route.name}</h2><p>{route.summary}</p></div></div>
        <div className="route-meta"><span>{route.bestSeasons}</span><span>{route.reviewedAt}核验</span></div>
        <div className="route-tags">{route.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <select aria-label={`${route.name}版本`} value={variantId} onChange={(event) => setVariants((current) => ({ ...current, [route.id]: event.target.value }))}>
          {route.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {variant.direction}</option>)}
        </select>
        <p className="route-caution">{route.caution}</p>
        <div className="route-actions">
          <button className="secondary icon-command" onClick={() => onPreview(createRouteItem(route.id, variantId))}><Eye size={15} />预览</button>
          <button className="primary icon-command" onClick={() => onAdd(route.id, variantId, replaceTarget?.dayId || targetDayId)}>
            {replaceTarget ? <Replace size={15} /> : <Plus size={15} />}{replaceTarget ? '替换' : '加入'}
          </button>
        </div>
      </article>
    })}
    <span className="sr-only">当前日期 {activeDayId}</span>
  </div>
}
