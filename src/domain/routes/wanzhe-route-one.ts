import type { RouteTemplate } from '../types.js'
import { anchor, reverse, routeSources, stop } from './helpers.js'

const forward = [stop('tunxi'), stop('huizhou-city', true), stop('shendu'), anchor('jiekou-anchor'), stop('weiping'), stop('qiandaohu')]

export const wanzheRouteOne: RouteTemplate = {
  id: 'wanzhe-route-one', slug: 'wanzhe-route-one', version: 1, name: '皖浙1号公路', color: '#9a5b35',
  regions: ['安徽省黄山市', '浙江省杭州市'], tags: ['沿江', '徽州', '湖区'],
  summary: '由屯溪、歙县和新安江沿江公路进入千岛湖西北湖区。', bestSeasons: '全年', caution: '沿江道路村镇出入口多，节假日预留拥堵时间。', reviewedAt: '2026-08-04', sources: routeSources,
  variants: [
    { id: 'huangshan-qiandaohu', name: '黄山至千岛湖', direction: '屯溪至千岛湖镇', nodeRefs: forward },
    { id: 'qiandaohu-huangshan', name: '千岛湖至黄山', direction: '千岛湖镇至屯溪', nodeRefs: reverse(forward) },
  ],
}
