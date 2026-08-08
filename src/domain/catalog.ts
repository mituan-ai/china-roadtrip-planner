import {
  placeSchema,
  routeTemplateSchema,
  type Place,
  type RouteTemplate,
} from './types.js'
import { qiandaohuRing } from './routes/qiandaohu-ring.js'
import { wannanSichuanLine } from './routes/wannan-sichuan-line.js'
import { wanzheRouteOne } from './routes/wanzhe-route-one.js'
import { wanzheSkyRoad } from './routes/wanzhe-sky-road.js'
import { zhexiSkyRoad } from './routes/zhexi-sky-road.js'

const rawPlaces: Place[] = [
  { id: 'moon-bay', name: '月亮湾风景区', region: '安徽省宣城市泾县蔡村镇', coord: [118.567529, 30.678423], adcode: '341823', poiId: 'B0233014YE', kind: 'scenic', summary: '皖南川藏线西侧河谷入口。', defaultStayMinutes: 30 },
  { id: 'aimin', name: '爱民村', region: '安徽省宣城市泾县蔡村镇', coord: [118.591654, 30.645896], adcode: '341823', kind: 'town', summary: '由月亮湾河谷转入山路的定位点。', defaultStayMinutes: 10 },
  { id: 'tingxi', name: '汀溪镇', region: '安徽省宣城市泾县', coord: [118.550591, 30.580801], adcode: '341823', kind: 'service', summary: '桃岭盘山段前的补给点。', defaultStayMinutes: 20 },
  { id: 'suhong-anchor', name: '苏红村道路锚点', region: '安徽省宣城市泾县汀溪镇', coord: [118.557752, 30.539631], adcode: '341823', kind: 'anchor', summary: '用于约束桃岭公路走向，不作为游览节点。', defaultStayMinutes: 0 },
  { id: 'taoling', name: '泾县六道弯观景台', region: '安徽省宣城市泾县汀溪镇', coord: [118.586184, 30.511911], adcode: '341823', poiId: 'B0FFKF976M', kind: 'scenic', summary: '连续急弯和俯瞰盘山公路的核心路段。', defaultStayMinutes: 35 },
  { id: 'banqiao', name: '板桥村', region: '安徽省宣城市宁国市方塘乡', coord: [118.645617, 30.523906], adcode: '341881', kind: 'scenic', summary: '原始林与溪谷集中的山路节点。', defaultStayMinutes: 60 },
  { id: 'redwood', name: '方塘落羽杉湿地', region: '安徽省宣城市宁国市方塘乡', coord: [118.750437, 30.477728], adcode: '341881', kind: 'scenic', summary: '夏季以绿色水杉和湿地水面为主。', defaultStayMinutes: 40 },
  { id: 'chujia', name: '储家滩旅游景区', region: '安徽省宣城市宁国市青龙乡', coord: [118.885875, 30.5893], adcode: '341881', poiId: 'B0G23SD4W5', kind: 'scenic', summary: '青龙湾湖汊与临水公路景观。', defaultStayMinutes: 45 },
  { id: 'qinglong', name: '青龙乡东入口', region: '安徽省宣城市宁国市青龙乡', coord: [118.909657, 30.619088], adcode: '341881', kind: 'endpoint', summary: '皖南川藏线东侧入口。', defaultStayMinutes: 10 },

  { id: 'jiapeng', name: '家朋乡磡头村', region: '安徽省宣城市绩溪县家朋乡', coord: [118.816261, 30.238646], adcode: '341824', kind: 'endpoint', summary: '皖浙天路家朋端起点及徽派村落。', defaultStayMinutes: 35 },
  { id: 'meigan', name: '梅干岭观景台', region: '安徽省宣城市绩溪县家朋乡', coord: [118.809458, 30.226824], adcode: '341824', poiId: 'B0FFHUUBLB', kind: 'scenic', summary: '俯瞰梯田与村落的停车观景点。', defaultStayMinutes: 25 },
  { id: 'shangcun', name: '尚村', region: '安徽省宣城市绩溪县家朋乡', coord: [118.794352, 30.209244], adcode: '341824', kind: 'town', summary: '皖浙天路沿线徽派古村。', defaultStayMinutes: 35 },
  { id: 'shanyun', name: '山云岭停车观景点', region: '安徽省宣城市绩溪县荆州乡', coord: [118.823117, 30.186404], adcode: '341824', kind: 'scenic', summary: '荆州盘山段的高处停车点。', defaultStayMinutes: 20 },
  { id: 'jingzhou-anchor', name: '荆州公路锚点', region: '安徽省宣城市绩溪县荆州乡', coord: [118.844327, 30.182904], adcode: '341824', kind: 'anchor', summary: '用于约束荆州盘山公路，不作为游览节点。', defaultStayMinutes: 0 },
  { id: 'jingzhou', name: '荆州乡', region: '安徽省宣城市绩溪县', coord: [118.868447, 30.191125], adcode: '341824', poiId: 'B0233001X4', kind: 'endpoint', summary: '皖浙天路荆州端终点。', defaultStayMinutes: 20 },
  { id: 'daoshi', name: '岛石镇', region: '浙江省杭州市临安区', coord: [118.950375, 30.290131], adcode: '330112', kind: 'service', summary: '进入浙江后的可选补给与连接点。', defaultStayMinutes: 30 },

  { id: 'huaguang', name: '华光潭村', region: '浙江省杭州市临安区龙岗镇', coord: [119.007651, 30.29064], adcode: '330112', poiId: 'B023B145UR', kind: 'endpoint', summary: '浙西天路精华线北端。', defaultStayMinutes: 20 },
  { id: 'taizijian', name: '太子尖驿站', region: '浙江省杭州市临安区', coord: [118.897919, 30.175219], adcode: '330112', kind: 'scenic', summary: '高海拔山脊观景点，雨雾和大风时不宜久留。', defaultStayMinutes: 35 },
  { id: 'langguang', name: '浪广村', region: '浙江省杭州市临安区清凉峰镇', coord: [118.875596, 30.164972], adcode: '330112', kind: 'endpoint', summary: '浙西天路59公里精华段南端。', defaultStayMinutes: 20 },
  { id: 'jiakou', name: '颊口村', region: '浙江省杭州市临安区清凉峰镇', coord: [119.036593, 30.12981], adcode: '330112', kind: 'service', summary: '环线南侧补给和转向点。', defaultStayMinutes: 30 },
  { id: 'longgang', name: '龙岗镇', region: '浙江省杭州市临安区', coord: [119.096367, 30.209485], adcode: '330112', kind: 'town', summary: '浙西天路环线东侧连接点。', defaultStayMinutes: 25 },

  { id: 'tunxi', name: '屯溪老街', region: '安徽省黄山市屯溪区', coord: [118.302443, 29.708871], adcode: '341002', kind: 'endpoint', summary: '皖浙1号公路黄山端起点。', defaultStayMinutes: 60 },
  { id: 'huizhou-city', name: '徽州古城', region: '安徽省黄山市歙县', coord: [118.436772, 29.86602], adcode: '341021', kind: 'scenic', summary: '沿线主要徽州人文节点。', defaultStayMinutes: 50 },
  { id: 'shendu', name: '深渡港', region: '安徽省黄山市歙县深渡镇', coord: [118.618353, 29.862479], adcode: '341021', poiId: 'B022F00S22', kind: 'scenic', summary: '进入新安江山水画廊沿江路段。', defaultStayMinutes: 35 },
  { id: 'jiekou-anchor', name: '街口镇道路锚点', region: '安徽省黄山市歙县', coord: [118.727216, 29.747762], adcode: '341021', kind: 'anchor', summary: '约束新安江沿江路线，不作为游览节点。', defaultStayMinutes: 0 },
  { id: 'weiping', name: '威坪镇', region: '浙江省杭州市淳安县', coord: [118.795938, 29.725128], adcode: '330127', poiId: 'B023B07C9A', kind: 'town', summary: '进入千岛湖西北湖区的连接点。', defaultStayMinutes: 30 },
  { id: 'qiandaohu', name: '千岛湖镇', region: '浙江省杭州市淳安县', coord: [119.078234, 29.606922], adcode: '330127', poiId: 'B0FFF35O0T', kind: 'endpoint', summary: '皖浙1号公路浙江端及环湖起点。', defaultStayMinutes: 30 },

  { id: 'jiangjia', name: '姜家镇', region: '浙江省杭州市淳安县', coord: [118.663006, 29.477634], adcode: '330127', kind: 'town', summary: '千岛湖西部湖湾和桥梁路段。', defaultStayMinutes: 25 },
  { id: 'qinchuan', name: '芹川古村', region: '浙江省杭州市淳安县浪川乡', coord: [118.609136, 29.517502], adcode: '330127', kind: 'scenic', summary: '沿溪徽派古村，可选择短停。', defaultStayMinutes: 55 },
  { id: 'fenkou', name: '汾口镇', region: '浙江省杭州市淳安县', coord: [118.558455, 29.427915], adcode: '330127', kind: 'service', summary: '环湖西南端的补给点。', defaultStayMinutes: 45 },
  { id: 'anyang', name: '安阳乡', region: '浙江省杭州市淳安县', coord: [118.831738, 29.421899], adcode: '330127', kind: 'town', summary: '进入南岸淳杨线临湖段。', defaultStayMinutes: 20 },
  { id: 'shangjiang', name: '上江埠大桥', region: '浙江省杭州市淳安县', coord: [118.972877, 29.529786], adcode: '330127', poiId: 'B023B1D4RC', kind: 'scenic', summary: '长桥与开阔湖面的短停点。', defaultStayMinutes: 25 },

  { id: 'huzhou-yishang-street', name: '衣裳街历史文化街区', region: '浙江省湖州市吴兴区', address: '勤劳路259号状元街', coord: [120.099537, 30.862424], adcode: '330502', poiId: 'B023C02QRV', kind: 'scenic', summary: '保留湖州旧城街巷和老字号，适合午餐并短停。', defaultStayMinutes: 80 },
  { id: 'huzhou-moon-bay', name: '太湖月亮湾', region: '浙江省湖州市吴兴区', address: '滨湖街道太湖路5788号南太湖旅游度假区', coord: [120.108167, 30.957332], adcode: '330502', poiId: 'B0FFHWHMR5', kind: 'scenic', summary: '南太湖开阔湖景与月亮酒店观景点，午后短停即可。', defaultStayMinutes: 60 },
  { id: 'nanxun-ancient-town', name: '南浔古镇', region: '浙江省湖州市南浔区', address: '南浔镇东塘路古镇东大门', coord: [120.439896, 30.88091], adcode: '330503', poiId: 'B023C0OMFN', kind: 'scenic', summary: '江南水乡与近代宅园并存，傍晚游览可避开暑热。', defaultStayMinutes: 180 },
]

export const places = Object.freeze(rawPlaces.map((place) => placeSchema.parse(place)))
export const placesById = new Map(places.map((place) => [place.id, place]))

const rawRoutes: RouteTemplate[] = [wannanSichuanLine, wanzheSkyRoad, zhexiSkyRoad, wanzheRouteOne, qiandaohuRing]

export const routeCatalog = Object.freeze(rawRoutes.map((route) => routeTemplateSchema.parse(route)))
export const routesById = new Map(routeCatalog.map((route) => [route.id, route]))

for (const route of routeCatalog) {
  for (const variant of route.variants) {
    for (const ref of variant.nodeRefs) {
      if (!placesById.has(ref.placeId)) throw new Error(`Unknown place ${ref.placeId} in ${route.id}/${variant.id}`)
      const place = placesById.get(ref.placeId)!
      if ((ref.role === 'anchor') !== (place.kind === 'anchor')) {
        throw new Error(`Anchor role mismatch for ${ref.placeId}`)
      }
    }
  }
}
