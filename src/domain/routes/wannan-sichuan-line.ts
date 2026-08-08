import type { RouteTemplate } from '../types.js'
import { anchor, reverse, routeSources, stop } from './helpers.js'

const forward = [
  stop('moon-bay'), stop('aimin', true), stop('tingxi'), anchor('suhong-anchor'), stop('taoling'),
  stop('banqiao'), stop('redwood', true), stop('chujia'), stop('qinglong'),
]

export const wannanSichuanLine: RouteTemplate = {
  id: 'wannan-sichuan-line', slug: 'wannan-sichuan-line', version: 1, name: '皖南川藏线', color: '#16806f',
  regions: ['安徽省宣城市'], tags: ['山路', '竹林', '湖湾'],
  summary: '月亮湾、桃岭盘山段、板桥与青龙湾串联的皖南山水公路。', bestSeasons: '春、夏、秋', caution: '连续急弯较多，雨雾天降低车速，只在正规停车区停靠。', reviewedAt: '2026-08-04', sources: routeSources,
  variants: [
    { id: 'west-east', name: '西进东出', direction: '月亮湾至青龙乡', nodeRefs: forward },
    { id: 'east-west', name: '东进西出', direction: '青龙乡至月亮湾', nodeRefs: reverse(forward) },
  ],
}
