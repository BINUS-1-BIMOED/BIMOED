import React, { useEffect, useState } from 'react'

export default function WeatherCard({lat, lon}){
  const [forecast, setForecast] = useState(null)
  useEffect(()=>{
    async function fetchForecast(){
      try{
        const res = await fetch(`/forecast?lat=${lat}&lon=${lon}`)
        const j = await res.json()
        setForecast(j)
      }catch(e){
        console.warn(e)
      }
    }
    if(lat && lon) fetchForecast()
  },[lat,lon])
  if(!forecast) return <div className="weather-card">Loading forecast...</div>
  return (
    <div className="weather-card">
      <div className="current">
        <div className="temp">{Math.round(forecast.current.temp)}°C</div>
        <div className="summary">{forecast.current.weather[0].description}</div>
      </div>
      <div className="hourly">
        {forecast.hourly.slice(0,12).map((h,i)=> (
          <div key={i} className="hour">{new Date(h.dt*1000).getHours()}h {Math.round(h.pop*100)}%</div>
        ))}
      </div>
    </div>
  )
}
