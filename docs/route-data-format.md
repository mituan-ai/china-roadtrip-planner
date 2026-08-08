# 路线数据格式

每条内置路线位于 `src/domain/routes/` 的独立文件中，地点统一维护在 `src/domain/catalog.ts`。加载目录时会用Zod校验；字段不完整、坐标越界或锚点类型不一致会直接阻止启动和构建。

```ts
type RouteTemplate = {
  id: string
  slug: string
  version: number
  name: string
  summary: string
  color: `#${string}`
  bestSeasons: string
  caution: string
  regions: string[]
  tags: string[]
  reviewedAt: string
  sources: Array<{ label: string; url?: string }>
  variants: Array<{
    id: string
    name: string
    direction: string
    nodeRefs: Array<{
      placeId: string
      role: 'stop' | 'anchor'
      optional: boolean
      stayMinutes?: number
      note?: string
    }>
  }>
}
```

- `stop` 是用户可见的游览或补给节点。
- `anchor` 只用于约束导航经过指定道路，不显示为景点，也不能设为可选。
- 坐标必须是GCJ-02；行政区填写完整省、市、区/县，乡镇可继续附在末尾。
- 正反方向版本应保持严格相反的节点顺序。其他版本可以独立定义，但要说明差异。
- `reviewedAt` 是最近一次人工核验日期，不是路线永久有效的承诺。
- `sources` 优先记录交通、政府、文旅和高德POI资料；社交平台内容只能作为待核验线索。

新增或修改路线时，同时更新单元测试，并在PR中写明坐标、节点顺序和道路通行信息的核验方法。
