import type { RouteTemplate } from '../types.js'
import { anchor, reverse, routeSources, stop } from './helpers.js'

const forward = [
  stop('jiapeng'), stop('meigan'), stop('shangcun', true), stop('shanyun'), anchor('jingzhou-anchor'), stop('jingzhou'), stop('daoshi', true),
]

export const wanzheSkyRoad: RouteTemplate = {
  id: 'wanzhe-sky-road', slug: 'wanzhe-sky-road', version: 1, name: '皖浙天路', color: '#3169a8',
  regions: ['安徽省宣城市', '浙江省杭州市'], tags: ['盘山公路', '梯田', '古村'],
  summary: '由家朋梯田进入荆州盘山公路，可选连接浙江岛石镇。', bestSeasons: '春、秋', caution: '荆州段弯道密集，雨雾或结冰时应改走普通道路。', reviewedAt: '2026-08-04', sources: routeSources,
  variants: [
    { id: 'jiapeng-daoshi', name: '家朋至岛石', direction: '安徽向浙江', nodeRefs: forward },
    { id: 'daoshi-jiapeng', name: '岛石至家朋', direction: '浙江向安徽', nodeRefs: reverse(forward) },
  ],
}
