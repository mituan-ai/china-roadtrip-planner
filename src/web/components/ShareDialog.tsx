import { Check, Copy, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { encodePlan } from '../../domain/serialization'
import type { TripPlan } from '../../domain/types'

export function ShareDialog({ plan, onClose }: { plan: TripPlan, onClose: () => void }) {
  const [includeLodgings, setIncludeLodgings] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = useMemo(() => `${window.location.origin}${window.location.pathname}#plan=${encodePlan(plan, includeLodgings)}`, [plan, includeLodgings])

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="dialog" role="dialog" aria-modal="true" aria-label="分享行程" onMouseDown={(event) => event.stopPropagation()}>
      <div className="dialog-head"><h2>分享行程</h2><button className="icon-button" title="关闭" onClick={onClose}><X size={17} /></button></div>
      <label className="check-row"><input type="checkbox" checked={includeLodgings} onChange={(event) => setIncludeLodgings(event.target.checked)} />包含住宿信息</label>
      <p className="privacy-note">默认不分享酒店名称和位置。链接包含路线、日期和自定义节点。</p>
      <textarea readOnly value={url} rows={4} />
      <button className="primary icon-command full" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制' : '复制链接'}</button>
    </section>
  </div>
}
