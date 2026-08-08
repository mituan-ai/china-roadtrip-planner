import { Layers3, LocateFixed } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { routesById } from '../../domain/catalog'
import type { Coordinate, ResolvedPlanPoint } from '../../domain/types'
import type { DayRouteView } from '../hooks/useDirections'
import type { DirectionsResponse } from '../lib/api'
import { fetchMapConfig } from '../lib/api'

declare global {
  interface Window {
    AMap?: any
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

let loaderPromise: Promise<any> | null = null

async function loadAmap() {
  if (window.AMap) return window.AMap
  if (loaderPromise) return loaderPromise
  loaderPromise = fetchMapConfig().then((config) => new Promise((resolve, reject) => {
    if (config.amapJsSecurityCode) window._AMapSecurityConfig = { securityJsCode: config.amapJsSecurityCode }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.amapJsKey)}&plugin=AMap.ToolBar,AMap.Scale`
    script.onload = () => resolve(window.AMap)
    script.onerror = () => reject(new Error('高德地图加载失败'))
    document.head.appendChild(script)
  }))
  return loaderPromise
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

function navUrl(point: ResolvedPlanPoint): string {
  const [lng, lat] = point.place.coord
  return `https://uri.amap.com/navigation?to=${lng},${lat},${encodeURIComponent(point.place.name)}&mode=car&policy=1&coordinate=gaode&callnative=1&src=china-roadtrip-planner`
}

type Preview = { points: ResolvedPlanPoint[], response: DirectionsResponse | null, color: string }

export function MapView({ routes, activeDayId, preview }: { routes: Map<string, DayRouteView>, activeDayId: string, preview: Preview | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let disposed = false
    void loadAmap().then((AMap) => {
      if (disposed || !containerRef.current) return
      const map = new AMap.Map(containerRef.current, { zoom: 8, center: [119.08, 30.22], viewMode: '2D', resizeEnable: true, mapStyle: 'amap://styles/normal' })
      map.addControl(new AMap.ToolBar())
      map.addControl(new AMap.Scale())
      mapRef.current = map
      setReady(true)
    }).catch((reason) => setError(reason instanceof Error ? reason.message : '地图加载失败'))
    return () => {
      disposed = true
      mapRef.current?.destroy()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current || !window.AMap) return
    const map = mapRef.current
    const AMap = window.AMap
    if (overlaysRef.current.length) map.remove(overlaysRef.current)
    const overlays: any[] = []
    const infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -18) })

    const views = preview ? [] : (showAll ? [...routes.values()] : [routes.get(activeDayId)].filter(Boolean) as DayRouteView[])
    const renderPath = (points: ResolvedPlanPoint[], response: DirectionsResponse, previewColor?: string) => {
      response.legs.forEach((leg) => {
        const from = points[leg.index]
        const to = points[leg.index + 1]
        const sameRoute = from?.routeId && from.routeId === to?.routeId && from.sourceItemId === to?.sourceItemId
        const color = previewColor || (sameRoute ? routesById.get(from.routeId!)?.color : '#68777f') || '#68777f'
        const line = new AMap.Polyline({
          path: leg.polyline,
          strokeColor: color,
          strokeWeight: sameRoute || previewColor ? 6 : 4,
          strokeOpacity: previewColor ? 0.9 : 0.95,
          strokeStyle: sameRoute || previewColor ? 'solid' : 'dashed',
          isOutline: true,
          outlineColor: '#ffffff',
          borderWeight: 2,
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: sameRoute ? 70 : 55,
        })
        overlays.push(line)
      })

      const seen = new Set<string>()
      let markerIndex = 0
      for (const point of points) {
        if (!point.visible) continue
        const key = `${point.place.coord.join(',')}:${point.place.name}`
        if (seen.has(key)) continue
        seen.add(key)
        markerIndex += 1
        const isHotel = point.role === 'lodging' || point.place.kind === 'hotel'
        const markerRole = point.role === 'start' ? 'start' : point.role === 'end' ? 'end' : isHotel ? 'hotel' : ''
        const markerLabel = markerRole === 'start' ? '起' : markerRole === 'end' ? '终' : markerRole === 'hotel' ? '住' : String(markerIndex)
        const marker = new AMap.Marker({
          position: point.place.coord,
          title: point.place.name,
          content: `<div class="map-marker ${markerRole}">${markerLabel}</div>`,
          offset: new AMap.Pixel(-12, -12),
          zIndex: 120,
        })
        marker.on('click', () => {
          const address = point.place.address ? ` · ${escapeHtml(point.place.address)}` : ''
          infoWindow.setContent(`<div class="map-popup"><strong>${escapeHtml(point.place.name)}</strong><span>${escapeHtml(point.place.region)}${address}</span><p>${escapeHtml(point.place.summary)}</p><a href="${navUrl(point)}" target="_blank" rel="noreferrer">高德导航</a></div>`)
          infoWindow.open(map, marker.getPosition())
        })
        overlays.push(marker)
      }
    }

    if (preview?.response) renderPath(preview.points, preview.response, preview.color)
    else for (const view of views) renderPath(view.points, view, undefined)

    if (overlays.length) {
      map.add(overlays)
      map.setFitView(overlays, false, [50, 50, 50, 50], 12)
    }
    overlaysRef.current = overlays
  }, [ready, routes, activeDayId, preview, showAll])

  return <main className="map-shell">
    <div ref={containerRef} className="map-container" />
    {!ready && !error && <div className="map-state">地图加载中</div>}
    {error && <div className="map-state error">{error}</div>}
    <div className="map-tools">
      <button className={`map-tool ${showAll ? 'active' : ''}`} onClick={() => setShowAll((value) => !value)} title="切换全程路线"><Layers3 size={16} />全程</button>
      <button className="map-tool" onClick={() => {
        const overlays = overlaysRef.current
        if (overlays.length) mapRef.current?.setFitView(overlays, false, [50, 50, 50, 50], 12)
      }} title="重新居中"><LocateFixed size={16} /></button>
    </div>
  </main>
}
