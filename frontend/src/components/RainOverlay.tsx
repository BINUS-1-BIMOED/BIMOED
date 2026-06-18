import React, {useEffect} from 'react'
import L from 'leaflet'

export default function RainOverlay({map, apiEndpoint='/rain-points'}){
  useEffect(()=>{
    if(!map) return
    let layer = L.layerGroup().addTo(map)
    async function load(){
      try{
        const res = await fetch(apiEndpoint)
        const pts = await res.json()
        layer.clearLayers()
        pts.forEach(p=>{
          const c = L.circle([p.lat,p.lon],{radius:100,pane:'overlayPane',color:'blue',opacity:0.6})
          layer.addLayer(c)
        })
      }catch(e){console.warn(e)}
    }
    load()
    const iv = setInterval(load, 60*1000)
    return ()=>{clearInterval(iv); map.removeLayer(layer)}
  },[map])
  return null
}
