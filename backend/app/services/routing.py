import httpx

from config import settings
from schemas import RouteStep, SafeZoneResponse
from utils.geo import haversine_km


class RoutingService:
    async def evacuation_route(
        self,
        origin_lat: float,
        origin_lng: float,
        destination: SafeZoneResponse,
        risk_points: list[dict] | None = None,
    ) -> dict:
        if settings.ors_api_key:
            route = await self._ors_route(origin_lat, origin_lng, destination.lat, destination.lng, risk_points)
            if route:
                return route

        return self._fallback_route(origin_lat, origin_lng, destination, bool(risk_points))

    async def _ors_route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        risk_points: list[dict] | None,
    ) -> dict | None:
        body: dict = {
            "coordinates": [[origin_lng, origin_lat], [dest_lng, dest_lat]],
            "format": "json",
        }
        if risk_points:
            avoid_polygons = []
            for p in risk_points[:5]:
                if p.get("score", 0) >= 70:
                    lat, lng = p["lat"], p["lng"]
                    d = 0.002
                    avoid_polygons.append([[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d]])
            if avoid_polygons:
                body["options"] = {"avoid_polygons": avoid_polygons}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.openrouteservice.org/v2/directions/driving-car/json",
                    json=body,
                    headers={"Authorization": settings.ors_api_key, "Content-Type": "application/json"},
                )
                if resp.status_code != 200:
                    return None
                data = resp.json()
                feature = data["features"][0]
                props = feature["properties"]["summary"]
                coords = feature["geometry"]["coordinates"]
                steps = [
                    RouteStep(
                        instruction=s.get("instruction", "Continue"),
                        distance_m=s.get("distance", 0),
                        duration_s=s.get("duration", 0),
                    )
                    for s in feature["properties"].get("segments", [{}])[0].get("steps", [])
                ]
                return {
                    "distance_km": props["distance"] / 1000,
                    "duration_min": props["duration"] / 60,
                    "geometry": [[c[1], c[0]] for c in coords],
                    "steps": steps,
                    "risk_penalty_applied": bool(risk_points),
                }
        except Exception:
            return None

    def _fallback_route(
        self,
        origin_lat: float,
        origin_lng: float,
        destination: SafeZoneResponse,
        risk_penalty: bool,
    ) -> dict:
        dist = haversine_km(origin_lat, origin_lng, destination.lat, destination.lng)
        mid_lat = (origin_lat + destination.lat) / 2
        mid_lng = (origin_lng + destination.lng) / 2
        geometry = [
            [origin_lat, origin_lng],
            [mid_lat, mid_lng],
            [destination.lat, destination.lng],
        ]
        return {
            "distance_km": dist,
            "duration_min": dist * 3,
            "geometry": geometry,
            "steps": [
                RouteStep(instruction="Head toward safe zone", distance_m=dist * 500, duration_s=dist * 60),
                RouteStep(instruction=f"Arrive at {destination.name}", distance_m=dist * 500, duration_s=dist * 60),
            ],
            "risk_penalty_applied": risk_penalty,
        }
