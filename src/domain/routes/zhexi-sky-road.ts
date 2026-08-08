import type { RouteTemplate } from '../types.js'
import { reverse, routeSources, stop } from './helpers.js'

const core = [stop('huaguang'), stop('taizijian'), stop('langguang')]
const loop = [stop('huaguang'), stop('taizijian'), stop('langguang'), stop('jiakou'), stop('longgang'), stop('huaguang')]

export const zhexiSkyRoad: RouteTemplate = {
  id: 'zhexi-sky-road', slug: 'zhexi-sky-road', version: 1, name: '浙西天路', color: '#946426',
  regions: ['浙江省杭州市'], tags: ['山脊', '高海拔', '盘山公路'],
  summary: '华光潭至太子尖的高海拔山脊路，可选精华穿越或完整环线。', bestSeasons: '夏、秋', caution: '高处天气变化快；139公里环线里程以实时道路规划为准。', reviewedAt: '2026-08-04', sources: routeSources,
  variants: [
    { id: 'core-southbound', name: '59公里精华 · 南行', direction: '华光潭至浪广', nodeRefs: core },
    { id: 'core-northbound', name: '59公里精华 · 北行', direction: '浪广至华光潭', nodeRefs: reverse(core) },
    { id: 'loop-clockwise', name: '139公里环线 · 顺时针', direction: '华光潭往太子尖', nodeRefs: loop },
    { id: 'loop-counterclockwise', name: '139公里环线 · 逆时针', direction: '华光潭往龙岗', nodeRefs: reverse(loop) },
  ],
}
