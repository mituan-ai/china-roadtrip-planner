import { expect, test, type Page } from '@playwright/test'

type MockPlace = {
  id: string
  poiId: string
  name: string
  region: string
  address: string
  coord: [number, number]
  adcode: string
  kind: 'custom' | 'hotel' | 'endpoint'
  summary: string
  defaultStayMinutes: number
}

const places: Record<string, MockPlace> = {
  '测试起点': {
    id: 'amap-start', poiId: 'start', name: '测试起点', region: '江苏省南京市玄武区', address: '中山路1号',
    coord: [118.7969, 32.0603], adcode: '320102', kind: 'custom', summary: '测试起点', defaultStayMinutes: 30,
  },
  '测试终点': {
    id: 'amap-end', poiId: 'end', name: '测试终点', region: '浙江省杭州市西湖区', address: '北山街1号',
    coord: [120.1302, 30.2596], adcode: '330106', kind: 'custom', summary: '测试终点', defaultStayMinutes: 30,
  },
  '测试景点': {
    id: 'amap-stop', poiId: 'stop', name: '测试景点', region: '安徽省宣城市泾县', address: '测试路1号',
    coord: [118.41, 30.69], adcode: '341823', kind: 'custom', summary: '测试景点', defaultStayMinutes: 30,
  },
  '测试酒店': {
    id: 'amap-hotel', poiId: 'hotel', name: '测试酒店', region: '安徽省宣城市泾县', address: '交通路1号',
    coord: [118.43, 30.67], adcode: '341823', kind: 'hotel', summary: '住宿节点', defaultStayMinutes: 0,
  },
}

async function mockBrowserApis(page: Page) {
  await page.addInitScript(() => {
    class MapMock {
      add() {}
      addControl() {}
      destroy() {}
      remove() {}
      setFitView() {}
    }
    class OverlayMock {
      on() {}
      getPosition() { return [118, 30] }
    }
    class InfoWindowMock {
      open() {}
      setContent() {}
    }
    class EmptyMock {}
    ;(window as any).AMap = {
      Map: MapMock,
      Marker: OverlayMock,
      Polyline: OverlayMock,
      InfoWindow: InfoWindowMock,
      Pixel: EmptyMock,
      Scale: EmptyMock,
      ToolBar: EmptyMock,
    }
  })
  await page.route('**/api/v1/directions', async (route) => {
    const body = route.request().postDataJSON() as { points: [number, number][] }
    const legs = body.points.slice(0, -1).map((point, index) => ({
      index,
      distanceMeters: 12000,
      durationSeconds: 1500,
      polyline: [point, body.points[index + 1]],
    }))
    await route.fulfill({ json: { legs, distanceMeters: legs.length * 12000, durationSeconds: legs.length * 1500 } })
  })
  await page.route('**/api/v1/weather*', (route) => route.fulfill({ json: { forecast: null } }))
  await page.route('**/api/v1/places*', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') || ''
    const place = places[query]
    await route.fulfill({ json: { places: place ? [place] : [] } })
  })
}

async function choosePlace(page: Page, query: keyof typeof places, region = '') {
  if (region) await page.getByLabel('限定地区').fill(region)
  await page.getByPlaceholder(/地点名称|酒店名称/).fill(query)
  await page.locator('.search-row').getByRole('button', { name: '搜索' }).click()
  await page.getByRole('button', { name: new RegExp(query) }).click()
}

async function createTrip(page: Page, options: { oneWay?: boolean, dayCount?: 1 | 2 | 3, navigate?: boolean } = {}) {
  if (options.navigate !== false) await page.goto('/')
  await expect(page.getByRole('region', { name: '新建行程' })).toBeVisible()
  const startDate = page.getByLabel('开始日期')
  if (options.dayCount === 1) await page.getByLabel('结束日期').fill(await startDate.inputValue())
  if (options.dayCount === 2) {
    const date = new Date(`${await startDate.inputValue()}T12:00:00`)
    date.setDate(date.getDate() + 1)
    await page.getByLabel('结束日期').fill(date.toISOString().slice(0, 10))
  }
  await page.locator('.endpoint-picker').filter({ hasText: '起点' }).click()
  await choosePlace(page, '测试起点', '江苏省南京市玄武区')
  if (options.oneWay) {
    await page.getByLabel('返回起点').uncheck()
    await page.locator('.endpoint-picker').filter({ hasText: '终点' }).click()
    await choosePlace(page, '测试终点', '浙江省杭州市西湖区')
  }
  await page.getByRole('button', { name: /创建\d+日行程/ }).click()
}

test.beforeEach(async ({ page }) => {
  await mockBrowserApis(page)
})

test('starts with a blank setup and supports round-trip and one-way endpoints', async ({ page }) => {
  await createTrip(page)
  await expect(page.getByLabel('行程名称')).toHaveValue('我的自驾行程')
  await expect(page.locator('.day-section')).toHaveCount(3)
  await expect(page.locator('.trip-boundaries')).toContainText('测试起点')
  await expect(page.getByLabel('返回起点')).toBeChecked()

  await page.getByTitle('新建行程').click()
  await createTrip(page, { oneWay: true, dayCount: 1, navigate: false })
  await expect(page.locator('.day-section')).toHaveCount(1)
  await expect(page.locator('.trip-boundaries')).toContainText('测试终点')
  await expect(page.locator('.day-stats')).toContainText('12 km')
})

test('applies the undated six-day example without a fixed personal address', async ({ page }) => {
  await page.goto('/')
  await page.getByTitle('套用示例').click()
  await expect(page.getByRole('region', { name: '套用示例' })).toBeVisible()
  await page.locator('.endpoint-picker').filter({ hasText: '起点' }).click()
  await choosePlace(page, '测试起点')
  await page.getByRole('button', { name: '套用六日示例' }).click()

  await expect(page.locator('.day-section')).toHaveCount(6)
  await expect(page.locator('.day-section').nth(1)).toContainText('皖南川藏线')
  await expect(page.locator('.day-section').nth(2)).toContainText('皖浙天路')
  await expect(page.locator('.day-section').nth(2)).toContainText('浙西天路')
  await expect(page.locator('.day-section').nth(3)).toContainText('环千岛湖公路')
  await expect(page.locator('.sidebar')).not.toContainText('大丰地税局')
})

test('uses an explicit route date and can replace a grouped route', async ({ page }) => {
  await createTrip(page)
  await page.getByRole('button', { name: '路线库' }).click()
  await page.getByLabel('加入日期').selectOption({ index: 1 })
  const wannan = page.locator('.route-card').filter({ hasText: '皖南川藏线' })
  await wannan.getByRole('button', { name: '加入' }).click()
  await expect(page.locator('.day-section').nth(1)).toContainText('皖南川藏线')

  await page.locator('.day-section').nth(1).getByTitle('更换路线').click()
  const qiandaohu = page.locator('.route-card').filter({ hasText: '环千岛湖公路' })
  await qiandaohu.getByRole('button', { name: '替换' }).click()
  await expect(page.locator('.day-section').nth(1)).toContainText('环千岛湖公路')
  await expect(page.locator('.day-section').nth(1)).not.toContainText('皖南川藏线')
})

test('limits search by region, edits stay time, and moves a stop across days', async ({ page }) => {
  await createTrip(page)
  const requestedUrls: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/places')) requestedUrls.push(request.url())
  })
  await page.locator('.day-section').first().getByRole('button', { name: '添加地点' }).click()
  await choosePlace(page, '测试景点', '安徽省宣城市泾县')
  expect(requestedUrls.at(-1)).toContain('city=%E5%AE%89%E5%BE%BD%E7%9C%81%E5%AE%A3%E5%9F%8E%E5%B8%82%E6%B3%BE%E5%8E%BF')

  const stop = page.locator('.stop-item').filter({ hasText: '测试景点' })
  await stop.locator('input[type="number"]').fill('90')
  await expect(stop.locator('input[type="number"]')).toHaveValue('90')
  await stop.getByLabel('移至日期').selectOption({ index: 1 })
  await expect(page.locator('.day-section').first()).not.toContainText('测试景点')
  await expect(page.locator('.day-section').nth(1)).toContainText('测试景点')
})

test('keeps lodging private in shares and imports a v1 plan', async ({ page }) => {
  await createTrip(page, { dayCount: 2 })
  await page.getByRole('button', { name: '搜索酒店' }).click()
  await choosePlace(page, '测试酒店', '安徽省宣城市泾县')
  await expect(page.locator('.selected-lodging')).toContainText('测试酒店')

  await page.getByTitle('分享').click()
  await expect(page.getByLabel('包含住宿信息')).not.toBeChecked()
  const shareUrl = await page.locator('.dialog textarea').inputValue()
  await page.goto(shareUrl)
  await expect(page.locator('.selected-lodging')).toHaveCount(0)

  const legacy = {
    schemaVersion: 1,
    id: 'legacy-plan',
    title: '旧版导入行程',
    lodgings: [],
    days: [{ id: 'legacy-day', date: '2027-05-01', departureTime: '08:00', items: [
      { type: 'stop', id: 'legacy-start', place: { ...places['测试起点'], kind: 'endpoint' }, stayMinutes: 0 },
      { type: 'stop', id: 'legacy-stop', place: places['测试景点'], stayMinutes: 45 },
      { type: 'stop', id: 'legacy-end', place: { ...places['测试终点'], kind: 'endpoint' }, stayMinutes: 0 },
    ] }],
  }
  await page.getByTitle('导入JSON').click()
  await page.locator('input[type="file"]').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) })
  await expect(page.getByLabel('行程名称')).toHaveValue('旧版导入行程')
  await expect(page.locator('.trip-boundaries')).toContainText('测试起点')
  await expect(page.locator('.trip-boundaries')).toContainText('测试终点')
  await expect(page.locator('.day-section')).toContainText('测试景点')

  const ambiguousLegacy = {
    ...legacy,
    id: 'ambiguous-legacy',
    title: '待补充端点',
    days: [{ ...legacy.days[0], items: [
      { type: 'stop', id: 'legacy-stop', place: places['测试景点'], stayMinutes: 45 },
    ] }],
  }
  await page.locator('input[type="file"]').setInputFiles({ name: 'ambiguous.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(ambiguousLegacy)) })
  await expect(page.getByLabel('行程名称')).toHaveValue('待补充端点')
  await expect(page.locator('.boundary-warning')).toContainText('补充起点和终点')
  await expect(page.locator('.day-section')).toContainText('测试景点')
})

test('mobile layout has no horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile')
  await page.goto('/')
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1)
  await expect(page.locator('.map-shell')).toBeVisible()
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.getByRole('region', { name: '新建行程' })).toBeVisible()
})
