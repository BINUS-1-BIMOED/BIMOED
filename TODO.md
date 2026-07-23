# TODO
- [x] Audit alur request routing: frontend -> POST /api/v1/routes/evacuation -> build_weather_forecast_points -> routing service
- [x] Optimasi `WeatherService.build_weather_forecast_points` agar lebih cepat untuk kebutuhan routing (sampling lebih sedikit + filter threshold lebih ketat)
- [x] Kurangi ukuran `avoid_polygons` yang dikirim ke OpenRouteService (lebih sedikit hazard & radius lebih kecil)
- [ ] Jalankan dev backend & frontend, uji:
  - waktu tunggu load route membaik
  - polyline biru muncul
  - route mengikuti jalan (bukan garis lurus fallback)
- [ ] (Opsional) Tambahkan logging waktu eksekusi di backend untuk pinpoint bottleneck


