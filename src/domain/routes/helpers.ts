import type { RouteNode } from '../types.js'

export const stop = (placeId: string, optional = false, stayMinutes?: number): RouteNode => ({ placeId, role: 'stop', optional, stayMinutes })
export const anchor = (placeId: string): RouteNode => ({ placeId, role: 'anchor', optional: false, stayMinutes: 0 })
export const reverse = (nodes: RouteNode[]): RouteNode[] => [...nodes].reverse().map((node) => ({ ...node }))
export const routeSources = [{ label: '高德地图道路规划与POI核验', url: 'https://ditu.amap.com/' }]
