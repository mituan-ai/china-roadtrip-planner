import { LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Place } from '../../domain/types'
import { searchPlaces } from '../lib/api'

type Props = {
  kind: 'hotel' | 'place'
  title: string
  onSelect: (place: Place) => void
  onClose: () => void
}

export function PlaceSearch({ kind, title, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [status, setStatus] = useState('')
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    controller.current?.abort()
    controller.current = new AbortController()
    setStatus('searching')
    try {
      const places = await searchPlaces(query.trim(), kind, region.trim() || undefined, controller.current.signal)
      setResults(places)
      setStatus(places.length ? '' : '没有结果')
    } catch (error) {
      if (!controller.current.signal.aborted) setStatus(error instanceof Error ? error.message : '搜索失败')
    }
  }

  return <div className="search-panel">
    <div className="search-panel-head"><strong>{title}</strong><button className="icon-button" onClick={onClose} title="关闭"><X size={16} /></button></div>
    <form className="search-row" onSubmit={submit}>
      <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="省市区/县（可选）" aria-label="限定地区" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kind === 'hotel' ? '酒店名称' : '地点名称'} autoFocus />
      <button className="primary icon-command" type="submit"><Search size={15} />搜索</button>
    </form>
    {status && <p className="search-status">{status === 'searching' ? <><LoaderCircle className="spin" size={13} />搜索中</> : status}</p>}
    <div className="search-results">
      {results.map((place) => <button key={place.id} className="search-result" onClick={() => onSelect(place)}>
        <span className="result-name">{place.name}</span>
        <span>{place.region}{place.address ? ` · ${place.address}` : ''}</span>
      </button>)}
    </div>
  </div>
}
