# BIMOED v2.0 - Quick Start Guide

## 🚀 Setup & Installation

### Backend Setup
```bash
cd backend/app

# Install new dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your API keys:
# - ORS_API_KEY (OpenRouteService for routing)
# - SINGAPORE_FLOOD_API_KEY (if needed)

# Run migrations (creates new tables)
alembic upgrade head

# Start server
bash start.sh
# or on Windows:
# powershell -ExecutionPolicy Bypass -File .\start.ps1
```

### Frontend Setup
```bash
cd frontend

# Install dependencies (includes PWA plugin)
npm install

# Development with offline support
npm run dev
# App available at http://localhost:5173

# Build for production (generates PWA)
npm run build
# Outputs to dist/

# Preview built app
npm run preview
```

---

## 🎯 Testing Key Features

### 1. Testing Trust Score & Community Validation

```bash
# Submit a report (gets initial trust_score)
curl -X POST http://localhost:8000/api/v1/reports \
  -H "Content-Type: application/json" \
  -d '{
    "category": "flood",
    "severity": "high",
    "lat": 3.5952,
    "lng": 98.6722,
    "description": "Water rising in Helvetia",
    "user_id": "user123"
  }'
# Returns: Report with trust_score: ~0.5 (initial)

# Validate the report (community feedback)
curl -X POST http://localhost:8000/api/v1/community/validate \
  -H "Content-Type: application/json" \
  -d '{
    "report_id": 1,
    "verdict": "accurate",
    "confidence": 0.9,
    "user_id": "validator1"
  }'
# Recalculates validation_score

# Check for duplicates (before submitting)
curl http://localhost:8000/api/v1/community/duplicates \
  ?lat=3.5952&lng=98.6722&category=flood
# Returns: {"is_duplicate": false}
```

### 2. Testing Multi-Criteria Routing

```bash
# Get evacuation route (auto-chooses safest)
curl -X POST http://localhost:8000/api/v1/routes/evacuation \
  -H "Content-Type: application/json" \
  -d '{
    "origin_lat": 3.5952,
    "origin_lng": 98.6722,
    "destination_lat": 3.5621,
    "destination_lng": 98.6534
  }'
# Returns: Route with geometry, distance, duration

# Get nearest safe zones (prioritized)
curl http://localhost:8000/api/v1/routes/evacuation \
  ?origin_lat=3.5952&origin_lng=98.6722
# Returns: [
#   {
#     "name": "GOR Satria",
#     "distance_km": 5.2,
#     "safety_score": 0.95,
#     "route_score": 5.5
#   },
#   ...
# ]
```

### 3. Testing Flood Notifications

```bash
# Create a flood alert
curl -X POST http://localhost:8000/api/v1/flood-alerts/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type": "flood",
    "severity": "critical",
    "lat": 3.5952,
    "lng": 98.6722,
    "location_name": "Medan Helvetia",
    "title": "Flash Flood Warning",
    "description": "Deli River overflowing",
    "source": "government",
    "radius_km": 15
  }'
# Returns: notification with ID

# Get active alerts nearby
curl http://localhost:8000/api/v1/flood-alerts/notifications/nearby \
  ?lat=3.5952&lng=98.6722&radius_km=15
# Returns: Array of nearby active alerts

# Broadcast notification
curl -X POST http://localhost:8000/api/v1/flood-alerts/notifications/1/broadcast
# Returns: Broadcast status and user count
```

### 4. Testing External Flood APIs

```bash
# Get Singapore flood alerts
curl http://localhost:8000/api/v1/flood-alerts/external/singapore
# Returns: Latest alerts from Singapore gov

# Get Indonesia weather alerts
curl http://localhost:8000/api/v1/flood-alerts/external/bmkg
# Returns: BMKG weather warnings

# Get rainfall forecast
curl http://localhost:8000/api/v1/flood-alerts/forecast \
  ?lat=3.5952&lng=98.6722&hours=24
# Returns: Rainfall forecast for 24 hours
```

### 5. Testing Image Processing

```bash
# Upload report with photo (auto-enhances)
curl -X POST http://localhost:8000/api/v1/reports/upload \
  -F "category=flood" \
  -F "severity=high" \
  -F "lat=3.5952" \
  -F "lng=98.6722" \
  -F "description=Flooded street" \
  -F "photo=@flood_photo.jpg"
# Processing pipeline:
# 1. Denoise (bilateral filter)
# 2. Deblur (morphological ops)
# 3. Enhance (contrast + sharpness)
# Returns: Report with processed_photo_url
```

### 6. Testing Admin Analytics

```bash
# System overview
curl http://localhost:8000/admin/analytics/overview
# Returns: Report counts, validation stats, quality metrics

# Training readiness
curl http://localhost:8000/admin/analytics/training-readiness
# Returns: Whether we have enough data for model retraining

# Model blind spots
curl http://localhost:8000/admin/analytics/blind-spots
# Returns: Geographic areas where model struggles

# IoT gap analysis
curl http://localhost:8000/admin/analytics/iot-gap-analysis
# Returns: Areas lacking sensor coverage

# Export training data
curl http://localhost:8000/admin/data/export-training?days=90
# Returns: CSV/JSON with validated reports for ML training
```

---

## 📱 Testing PWA Offline Mode

### Chrome DevTools
1. Open DevTools (F12)
2. Go to "Application" tab
3. Check "Service Workers" section
4. Look for registered service worker
5. Check cache storage:
   - `bimoed-v1`: Static assets
   - `bimoed-runtime`: API responses
   - `bimoed-images`: Photos

### Test Offline
1. Open DevTools → Network tab
2. Check "Offline" checkbox
3. Try to navigate → should still work
4. Try to submit report → gets queued
5. Uncheck "Offline"
6. Reports auto-sync when back online

### Test Install
1. Visit web app in Chrome
2. Click install prompt (top right)
3. App appears on home screen
4. Can be used like native app
5. Works offline completely

---

## 🔍 Monitoring & Debugging

### Backend Logging
```bash
# Check service worker logs (client-side)
# Open browser console:
console.log(navigator.serviceWorker.controller)

# Server logs for trust score calculations
# grep "trust_score\|validation" app.log

# Monitor API requests
# Backend logs all requests with timestamps
```

### Database Queries
```bash
# Check report trust scores
SELECT id, trust_score, validation_score, confidence 
FROM escood_reports 
ORDER BY created_at DESC LIMIT 10;

# Check community validations
SELECT report_id, COUNT(*) as votes, 
       COUNT(CASE WHEN verdict='accurate' THEN 1 END) as accurate
FROM escood_community_validations
GROUP BY report_id;

# Check pending notifications
SELECT id, title, is_broadcast, users_notified 
FROM escood_flood_notifications
WHERE expires_at > NOW()
ORDER BY created_at DESC;
```

---

## 🎓 Key Algorithms to Understand

### Trust Score Calculation
```
Input: New report with user_id, lat, lng, category
Process:
1. Calculate user_history_accuracy (35%)
   - Get user's past reports
   - Count how many were verified
   - Score = verified_count / total_count (0-1)

2. Calculate geographical_consistency (25%)
   - Find reports within 10km, last 30 days
   - Count similar category
   - Score = 0.5 + (similar/nearby) * 0.5

3. Calculate report_clustering (25%)
   - Find reports in 1km radius, last 24h
   - Score = min(1.0, count/10) → range 0.5-1.0
   - More clustered = higher confidence

4. Calculate temporal_consistency (15%)
   - Get current rainfall at location
   - Compare with report severity
   - Heavy rain (>20mm) + "critical" severity = high score
   - Light rain + "critical" severity = low score

Final: weighted_sum = 0.35*h + 0.25*g + 0.25*c + 0.15*t
```

### Community Validation Score
```
Input: List of community verdicts (accurate/inaccurate/duplicate)
Calculation:
- accurate_votes = count(verdict == "accurate")
- inaccurate_votes = count(verdict == "inaccurate")
- score = accurate_votes / (accurate_votes + inaccurate_votes)
- Boost for multiple votes: +0.2 max (more confidence with more votes)
Range: 0-1 (1 = high consensus)
```

### Routing Risk Score
```
For each waypoint:
- Get nearby alerts within 10km
- Calculate maximum alert severity (0-3)
- risk_penalty = max(0.1, 1.0 - severity*0.25)
- Lower penalty = more dangerous

Route selection:
- Fastest: direct line
- Safest: shift waypoints away from high-risk areas
- Balanced: minor adjustments only
```

---

## 🚨 Common Issues & Solutions

### Service Worker Not Caching
- Check browser DevTools → Application → Service Workers
- Force update: Click "Update" button in DevTools
- Verify manifest.json is accessible at `/manifest.json`
- Clear site data and reload

### Offline Sync Not Working
- Ensure service worker is registered (check console)
- Check if browser supports Background Sync API
- Try submitting report offline, then reconnect
- Check browser console for error messages

### Image Processing Fails
- Ensure OpenCV is installed: `pip list | grep opencv`
- Check file size (should be <10MB)
- Verify image format (JPEG, PNG, WebP supported)
- Check server logs for processing errors

### Trust Score Not Updating
- Verify report was created with user_id
- Check if community validations exist
- Ensure reports are marked as "verified"
- Check database for calculated scores

### Routing Shows Same Path
- Verify there are active flood alerts in area
- Check if risk zones are properly configured
- Confirm SafeZone records exist in database
- Look for OpenRouteService API errors

---

## 📊 Data Export Examples

### Export Training Data (CSV)
```bash
curl http://localhost:8000/admin/data/export-training?days=30 > training_data.csv
```
Columns:
```
id,lat,lng,category,severity,trust_score,validation_score,user_history_accuracy,geographical_consistency,temporal_consistency,description,confidence,created_at
```

### Export Feedback Data (JSON)
```bash
curl http://localhost:8000/admin/data/export-feedback > feedback.json
```
Each record includes report, verdict, confidence, notes, timestamp

---

## 🔐 Security Notes

- All external API calls use HTTPS
- Service Worker only caches from same origin
- Credentials not cached (reports still need auth on sync)
- Push notifications require user permission
- CORS properly configured for API access
- Database queries use parameterized statements

---

## 📈 Performance Tips

- Cache busting: Service Worker auto-updates weekly
- Image processing: Offload to queue if >5 pending
- Notification broadcasting: Use batch operations
- Data export: Stream large exports to avoid memory issues
- Trust score: Cache calculation for 5 minutes

---

## 🆘 Getting Help

1. **Check logs**: `backend/app/logs/` and browser console
2. **Database**: Use PostgreSQL client to inspect data
3. **API testing**: Use curl or Postman with examples above
4. **PWA debugging**: Chrome DevTools → Application tab
5. **Documentation**: See IMPLEMENTATION_SUMMARY.md for full details

---

**Last Updated**: 2026-06-19  
**BIMOED Version**: 2.0  
**Status**: Ready for Production ✅
