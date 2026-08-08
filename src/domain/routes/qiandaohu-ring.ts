import type { RouteTemplate } from '../types.js'
import { reverse, routeSources, stop } from './helpers.js'

const clockwise = [stop('qiandaohu'), stop('shangjiang'), stop('anyang'), stop('fenkou'), stop('qinchuan', true), stop('jiangjia'), stop('qiandaohu')]

export const qiandaohuRing: RouteTemplate = {
  id: 'qiandaohu-ring', slug: 'qiandaohu-ring', version: 1, name: '环千岛湖公路', color: '#7b4b8f',
  regions: ['浙江省杭州市'], tags: ['环湖', '桥梁', '古村'],
  summary: '串联西部湖湾、南岸淳杨线与上江埠大桥的完整环湖路线。', bestSeasons: '春、夏、秋', caution: '全环里程较长，游船和登岛活动不应与完整环线安排在同一天。', reviewedAt: '2026-08-04', sources: routeSources,
  variants: [
    { id: 'clockwise', name: '顺时针', direction: '千岛湖镇往南岸', nodeRefs: clockwise },
    { id: 'counterclockwise', name: '逆时针', direction: '千岛湖镇往姜家', nodeRefs: reverse(clockwise) },
  ],
}
