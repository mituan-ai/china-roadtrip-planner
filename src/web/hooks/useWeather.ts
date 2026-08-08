import { useEffect, useState } from 'react'
import { fetchWeather, type WeatherForecast } from '../lib/api'

export function useWeather(adcode?: string) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null)
  useEffect(() => {
    if (!adcode) return
    const controller = new AbortController()
    void fetchWeather(adcode, controller.signal).then(setForecast).catch(() => setForecast(null))
    return () => controller.abort()
  }, [adcode])
  return forecast
}
