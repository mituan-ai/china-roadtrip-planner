import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { routeCatalog } from '../domain/catalog'
import { createPlan, createRouteItem, defaultStartDate, moveItem, newId, replaceRouteItem, setPlanReturnToStart } from '../domain/plan'
import { parsePlan } from '../domain/serialization'
import type { Lodging, Place, TripPlan } from '../domain/types'

type PlannerState = {
  plan: TripPlan
  activeDayId: string
  setPlan: (plan: TripPlan) => void
  setTitle: (title: string) => void
  setStartPlace: (place: Place) => void
  setEndPlace: (place: Place) => void
  setReturnToStart: (value: boolean) => void
  setActiveDay: (dayId: string) => void
  addDay: () => void
  removeDay: (dayId: string) => void
  updateDay: (dayId: string, values: Partial<Pick<TripPlan['days'][number], 'date' | 'departureTime'>>) => void
  addRoute: (dayId: string, routeId: string, variantId: string) => void
  replaceRoute: (dayId: string, itemId: string, routeId: string, variantId: string) => void
  changeVariant: (dayId: string, itemId: string, variantId: string) => void
  toggleSkippedPlace: (dayId: string, itemId: string, placeId: string) => void
  addStop: (dayId: string, place: Place) => void
  removeItem: (dayId: string, itemId: string) => void
  moveDayItem: (dayId: string, from: number, to: number) => void
  moveItemToDay: (fromDayId: string, itemId: string, toDayId: string) => void
  updateStopStay: (dayId: string, itemId: string, stayMinutes: number) => void
  setLodging: (afterDayId: string, place: Place | null) => void
}

const initialPlan = createPlan({ startDate: defaultStartDate(), dayCount: 3 })

function nextDate(lastDate: string): string {
  const value = new Date(`${lastDate}T12:00:00`)
  value.setDate(value.getDate() + 1)
  return value.toISOString().slice(0, 10)
}

export const usePlannerStore = create<PlannerState>()(persist((set, get) => ({
  plan: initialPlan,
  activeDayId: initialPlan.days[0]!.id,
  setPlan: (plan) => set({ plan: parsePlan(plan), activeDayId: plan.days[0]!.id }),
  setTitle: (title) => set((state) => ({ plan: { ...state.plan, title } })),
  setStartPlace: (startPlace) => set((state) => ({ plan: { ...state.plan, startPlace, endPlace: state.plan.returnToStart ? startPlace : state.plan.endPlace } })),
  setEndPlace: (endPlace) => set((state) => ({ plan: { ...state.plan, endPlace, returnToStart: false } })),
  setReturnToStart: (returnToStart) => set((state) => ({ plan: setPlanReturnToStart(state.plan, returnToStart) })),
  setActiveDay: (activeDayId) => set({ activeDayId }),
  addDay: () => set((state) => {
    const lastDay = state.plan.days.at(-1)!
    const day = { id: newId('day'), date: nextDate(lastDay.date), departureTime: '08:00', items: [] }
    return { plan: { ...state.plan, days: [...state.plan.days, day] }, activeDayId: day.id }
  }),
  removeDay: (dayId) => set((state) => {
    if (state.plan.days.length === 1) return state
    const days = state.plan.days.filter((day) => day.id !== dayId)
    const lodgings = state.plan.lodgings.filter((item) => item.afterDayId !== dayId)
    return { plan: { ...state.plan, days, lodgings }, activeDayId: state.activeDayId === dayId ? days[0]!.id : state.activeDayId }
  }),
  updateDay: (dayId, values) => set((state) => ({
    plan: { ...state.plan, days: state.plan.days.map((day) => day.id === dayId ? { ...day, ...values } : day) },
  })),
  addRoute: (dayId, routeId, variantId) => set((state) => ({
    plan: { ...state.plan, days: state.plan.days.map((day) => day.id === dayId ? { ...day, items: [...day.items, createRouteItem(routeId, variantId)] } : day) },
  })),
  replaceRoute: (dayId, itemId, routeId, variantId) => set((state) => ({
    plan: { ...state.plan, days: state.plan.days.map((day) => day.id === dayId ? { ...day, items: replaceRouteItem(day.items, itemId, createRouteItem(routeId, variantId)) } : day) },
  })),
  changeVariant: (dayId, itemId, variantId) => set((state) => ({
    plan: { ...state.plan, days: state.plan.days.map((day) => day.id === dayId ? {
      ...day,
      items: day.items.map((item) => item.id === itemId && item.type === 'route' ? { ...item, variantId, skippedPlaceIds: [] } : item),
    } : day) },
  })),
  toggleSkippedPlace: (dayId, itemId, placeId) => set((state) => ({
    plan: { ...state.plan, days: state.plan.days.map((day) => day.id === dayId ? {
      ...day,
      items: day.items.map((item) => item.id === itemId && item.type === 'route' ? {
        ...item,
        skippedPlaceIds: item.skippedPlaceIds.includes(placeId) ? item.skippedPlaceIds.filter((id) => id !== placeId) : [...item.skippedPlaceIds, placeId],
      } : item),
    } : day) },
  })),
  addStop: (dayId, place) => set((state) => ({
    plan: { ...state.plan, days: state.plan.days.map((day) => day.id === dayId ? { ...day, items: [...day.items, { type: 'stop' as const, id: newId('stop'), place, stayMinutes: place.defaultStayMinutes }] } : day) },
  })),
  removeItem: (dayId, itemId) => set((state) => ({
    plan: { ...state.plan, days: state.plan.days.map((day) => day.id === dayId ? { ...day, items: day.items.filter((item) => item.id !== itemId) } : day) },
  })),
  moveDayItem: (dayId, from, to) => set((state) => ({
    plan: { ...state.plan, days: state.plan.days.map((day) => day.id === dayId ? { ...day, items: moveItem(day.items, from, to) } : day) },
  })),
  moveItemToDay: (fromDayId, itemId, toDayId) => set((state) => {
    if (fromDayId === toDayId) return state
    const item = state.plan.days.find((day) => day.id === fromDayId)?.items.find((entry) => entry.id === itemId)
    if (!item) return state
    return { plan: { ...state.plan, days: state.plan.days.map((day) => {
      if (day.id === fromDayId) return { ...day, items: day.items.filter((entry) => entry.id !== itemId) }
      if (day.id === toDayId) return { ...day, items: [...day.items, item] }
      return day
    }) } }
  }),
  updateStopStay: (dayId, itemId, stayMinutes) => set((state) => ({
    plan: { ...state.plan, days: state.plan.days.map((day) => day.id === dayId ? {
      ...day,
      items: day.items.map((item) => item.id === itemId && item.type === 'stop' ? { ...item, stayMinutes: Math.max(0, Math.min(720, Math.round(stayMinutes))) } : item),
    } : day) },
  })),
  setLodging: (afterDayId, place) => set((state) => {
    const others = state.plan.lodgings.filter((item) => item.afterDayId !== afterDayId)
    const lodgings: Lodging[] = place ? [...others, { afterDayId, place }] : others
    return { plan: { ...state.plan, lodgings } }
  }),
}), {
  name: 'china-roadtrip-plan',
  version: 2,
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({ plan: state.plan, activeDayId: state.activeDayId }),
  migrate: (persisted) => {
    const value = persisted as Partial<PlannerState>
    try {
      if (value.plan) {
        const plan = parsePlan(value.plan)
        return { ...value, plan, activeDayId: plan.days.some((day) => day.id === value.activeDayId) ? value.activeDayId : plan.days[0]!.id }
      }
      const plan = createPlan({ startDate: defaultStartDate(), dayCount: 3 })
      return { plan, activeDayId: plan.days[0]!.id }
    } catch {
      const plan = createPlan({ startDate: defaultStartDate(), dayCount: 3 })
      return { plan, activeDayId: plan.days[0]!.id }
    }
  },
}))

export const routeOptions = routeCatalog.map((route) => ({ value: route.id, label: route.name }))
