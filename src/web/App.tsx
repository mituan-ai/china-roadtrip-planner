import { BookOpen, Download, Github, Library, MessageCircle, Plus, Route, Share2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createRouteItem } from '../domain/plan'
import { parsePlan, planFromHash } from '../domain/serialization'
import type { RoutePlanItem, TripPlan } from '../domain/types'
import { usePlanDirections, useRoutePreview } from './hooks/useDirections'
import { distanceText, durationText } from './lib/format'
import { usePlannerStore } from './store'
import { MapView } from './components/MapView'
import { PlanEditor } from './components/PlanEditor'
import { RouteLibrary } from './components/RouteLibrary'
import { ShareDialog } from './components/ShareDialog'
import { TripSetup } from './components/TripSetup'

type ReplaceTarget = { dayId: string, itemId: string, label: string } | null

function isBlankPlan(plan: TripPlan): boolean {
  return !plan.startPlace
    && !plan.endPlace
    && plan.lodgings.length === 0
    && plan.days.every((day) => day.items.length === 0)
}

export default function App() {
  const plan = usePlannerStore((state) => state.plan)
  const activeDayId = usePlannerStore((state) => state.activeDayId)
  const setPlan = usePlannerStore((state) => state.setPlan)
  const setTitle = usePlannerStore((state) => state.setTitle)
  const addRoute = usePlannerStore((state) => state.addRoute)
  const replaceRoute = usePlannerStore((state) => state.replaceRoute)
  const [tab, setTab] = useState<'library' | 'plan'>('plan')
  const [setupMode, setSetupMode] = useState<'new' | 'example' | null>(() => isBlankPlan(plan) ? 'new' : null)
  const [replaceTarget, setReplaceTarget] = useState<ReplaceTarget>(null)
  const [previewItem, setPreviewItem] = useState<RoutePlanItem | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [directionsRetryToken, setDirectionsRetryToken] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const routes = usePlanDirections(plan, directionsRetryToken)
  const preview = useRoutePreview(previewItem)

  useEffect(() => {
    function importSharedPlan() {
      if (!window.location.hash) return
      try {
        const shared = planFromHash(window.location.hash)
        if (shared) {
          setPlan(shared)
          setSetupMode(isBlankPlan(shared) ? 'new' : null)
          setTab('plan')
          setPreviewItem(null)
          setReplaceTarget(null)
          setShareOpen(false)
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '分享链接无效')
      }
    }
    importSharedPlan()
    window.addEventListener('hashchange', importSharedPlan)
    return () => window.removeEventListener('hashchange', importSharedPlan)
  }, [setPlan])

  const totals = useMemo(() => [...routes.values()].reduce((value, route) => ({
    distance: value.distance + route.distanceMeters,
    duration: value.duration + route.durationSeconds,
  }), { distance: 0, duration: 0 }), [routes])

  function chooseRoute(routeId: string, variantId: string, dayId: string) {
    if (replaceTarget) {
      replaceRoute(replaceTarget.dayId, replaceTarget.itemId, routeId, variantId)
      setReplaceTarget(null)
    } else {
      addRoute(dayId, routeId, variantId)
    }
    setPreviewItem(createRouteItem(routeId, variantId))
    setTab('plan')
  }

  function exportPlan() {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `自驾行程-${plan.days[0]?.date || 'plan'}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function importPlan(file: File) {
    try {
      const imported = parsePlan(JSON.parse(await file.text()))
      setPlan(imported)
      setSetupMode(null)
      setTab('plan')
      setNotice('行程已导入')
    } catch {
      setNotice('文件格式不正确')
    }
  }

  return <div className="planner-app">
    <aside className="sidebar">
      <header className="app-header">
        <input className="plan-title" value={plan.title} onChange={(event) => setTitle(event.target.value)} aria-label="行程名称" />
        <div className="summary"><span>{plan.days.length}天</span><span>{distanceText(totals.distance)}</span><span>驾驶{durationText(totals.duration)}</span></div>
        <div className="header-actions">
          <button className="icon-button" title="新建行程" onClick={() => setSetupMode('new')}><Plus size={16} /></button>
          <button className="icon-button" title="套用示例" onClick={() => setSetupMode('example')}><BookOpen size={16} /></button>
          <button className="icon-button" title="导入JSON" onClick={() => fileInput.current?.click()}><Upload size={16} /></button>
          <button className="icon-button" title="导出JSON" onClick={exportPlan}><Download size={16} /></button>
          <button className="icon-button" title="分享" onClick={() => setShareOpen(true)}><Share2 size={16} /></button>
          <a className="icon-button" title="GitHub源码" href="https://github.com/mituan-ai/china-roadtrip-planner" target="_blank" rel="noreferrer"><Github size={16} /></a>
          <a className="icon-button" title="反馈问题" href="https://github.com/mituan-ai/china-roadtrip-planner/issues" target="_blank" rel="noreferrer"><MessageCircle size={16} /></a>
          <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importPlan(file); event.target.value = '' }} />
        </div>
      </header>
      <nav className="tabs" aria-label="规划视图">
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}><Library size={16} />路线库</button>
        <button className={tab === 'plan' ? 'active' : ''} onClick={() => { setTab('plan'); setReplaceTarget(null); setPreviewItem(null) }}><Route size={16} />我的行程</button>
      </nav>
      <div className="sidebar-content">
        {setupMode
          ? <TripSetup mode={setupMode} onSubmit={(nextPlan) => { setPlan(nextPlan); setSetupMode(null); setTab('plan') }} onCancel={plan.startPlace && plan.endPlace ? () => setSetupMode(null) : undefined} />
          : tab === 'library'
            ? <RouteLibrary activeDayId={activeDayId} replaceTarget={replaceTarget} onCancelReplace={() => setReplaceTarget(null)} onAdd={chooseRoute} onPreview={setPreviewItem} />
            : <PlanEditor routes={routes} onRetry={() => setDirectionsRetryToken((value) => value + 1)} onReplaceRequest={(target) => { setReplaceTarget(target); setTab('library') }} onPreviewItem={() => setPreviewItem(null)} />}
      </div>
    </aside>
    <MapView routes={routes} activeDayId={activeDayId} preview={tab === 'library' && previewItem ? preview : null} />
    {shareOpen && <ShareDialog plan={plan} onClose={() => setShareOpen(false)} />}
    {notice && <button className="toast" onClick={() => setNotice('')}>{notice}</button>}
  </div>
}
