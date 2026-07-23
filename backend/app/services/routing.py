import httpx
from sqlalchemy.orm import Session

from config import settings
from schemas import RouteStep, SafeZoneResponse
from utils.geo import haversine_km
from models.alert import Alert
from models.safe_zone import SafeZone


def _circle_avoid_polygon(lat: float, lng: float, radius_deg: float = 0.0018, segments: int = 8) -> list:
    """Build a circular avoid polygon (approx 200m) for OpenRouteService."""
    import math

    ring = []
    for i in range(segments + 1):
        angle = (2 * math.pi * i) / segments
        ring.append([lng + radius_deg * math.cos(angle), lat + radius_deg * math.sin(angle)])
    return ring


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

        osrm_route = await self._osrm_route(origin_lat, origin_lng, destination.lat, destination.lng)
        if osrm_route:
            osrm_route["risk_penalty_applied"] = bool(risk_points)
            return osrm_route

        return self._fallback_route(origin_lat, origin_lng, destination, bool(risk_points))

    async def _osrm_route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
    ) -> dict | None:
        """Free OSRM fallback — routes follow actual roads."""
        url = (
            f"https://router.project-osrm.org/route/v1/driving/"
            f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        )
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.get(
                    url,
                    params={"overview": "full", "geometries": "geojson", "steps": "true"},
                )
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if data.get("code") != "Ok" or not data.get("routes"):
                    return None
                route = data["routes"][0]
                coords = route["geometry"]["coordinates"]
                legs = route.get("legs", [{}])[0]
                steps = [
                    RouteStep(
                        instruction=(s.get("maneuver", {}).get("modifier") or "Continue").replace("_", " ").title(),
                        distance_m=s.get("distance", 0),
                        duration_s=s.get("duration", 0),
                    )
                    for s in legs.get("steps", [])
                ] or [
                    RouteStep(instruction="Head toward destination", distance_m=route["distance"], duration_s=route["duration"]),
                    RouteStep(instruction="Arrive at destination", distance_m=0, duration_s=0),
                ]
                return {
                    "distance_km": route["distance"] / 1000,
                    "duration_min": route["duration"] / 60,
                    "geometry": [[c[1], c[0]] for c in coords],
                    "steps": steps,
                    "risk_penalty_applied": False,
                    "route_strategy": "fastest (OSRM)",
                }
        except Exception:
            return None

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
        polygons: list = []
        if risk_points:
            # Hindari payload terlalu besar ke ORS agar lebih stabil & cepat.
            hazards = sorted(
                [p for p in risk_points if p.get("score", 0) >= 50 or p.get("rainfall_mm", 0) >= 3],
                key=lambda p: p.get("score", 0),
                reverse=True,
            )
            for p in hazards[:6]:
                lat, lng = p["lat"], p["lng"]
                radius = 0.0013 + min(0.001, p.get("rainfall_mm", 0) * 0.0002)
                polygons.append([_circle_avoid_polygon(lat, lng, radius)])
            if polygons:
                body["options"] = {
                    "avoid_polygons": {
                        "type": "MultiPolygon",
                        "coordinates": polygons,
                    }
                }


        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.openrouteservice.org/v2/directions/driving-car/json",
                    json=body,
                    headers={"Authorization": settings.ors_api_key, "Content-Type": "application/json"},
                )
                if resp.status_code != 200:
                    # Retry without avoid polygons if ORS rejects them
                    if "avoid_polygons" in body.get("options", {}):
                        body.pop("options", None)
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
                strategy = "safest (avoiding flood/rain zones)" if polygons else "fastest"
                return {
                    "distance_km": props["distance"] / 1000,
                    "duration_min": props["duration"] / 60,
                    "geometry": [[c[1], c[0]] for c in coords],
                    "steps": steps,
                    "risk_penalty_applied": bool(polygons),
                    "route_strategy": strategy,
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
            "route_strategy": "direct (offline fallback)",
        }

    # Advanced multi-criteria routing methods
    @staticmethod
    def calculate_flood_risk_penalty(db: Session, lat: float, lng: float) -> float:
        """
        Calculate flood risk at a location.
        Returns 0-1 multiplier for route cost (1 = safe, 0.1 = very dangerous).
        """
        nearby_alerts = db.query(Alert).filter(
            Alert.lat.between(lat - 0.1, lat + 0.1),
            Alert.lng.between(lng - 0.1, lng + 0.1),
        ).all()

        if not nearby_alerts:
            return 1.0

        max_severity = max(
            (
                3 if a.severity == "critical"
                else 2 if a.severity == "high"
                else 1 if a.severity == "moderate"
                else 0
            )
            for a in nearby_alerts
        )

        penalty = max(0.1, 1.0 - (max_severity * 0.25))
        return penalty

    @staticmethod
    def create_multi_route_options(
        start_lat: float,
        start_lng: float,
        end_lat: float,
        end_lng: float,
        db: Session,
    ) -> dict:
        """
        Generate multiple route options: fastest, safest, balanced.
        """
        routes = {}

        # Fastest route (direct)
        routes["fastest"] = {
            "geometry": RoutingService._create_geometry(start_lat, start_lng, end_lat, end_lng, db, "fastest"),
            "strategy": "Fastest route - direct path",
        }

        # Safest route (avoiding flood zones)
        routes["safest"] = {
            "geometry": RoutingService._create_geometry(start_lat, start_lng, end_lat, end_lng, db, "safest"),
            "strategy": "Safest route - avoids high-risk areas",
        }

        # Balanced route
        routes["balanced"] = {
            "geometry": RoutingService._create_geometry(start_lat, start_lng, end_lat, end_lng, db, "balanced"),
            "strategy": "Balanced route - reasonable speed and safety",
        }

        return routes

    @staticmethod
    def _create_geometry(start_lat: float, start_lng: float, end_lat: float, end_lng: float, db: Session, method: str) -> list:
        """Create route geometry based on method."""
        geometry = [[start_lat, start_lng]]

        # Add intermediate waypoints
        for i in range(1, 5):
            ratio = i / 5
            lat = start_lat + (end_lat - start_lat) * ratio
            lng = start_lng + (end_lng - start_lng) * ratio

            if method == "safest":
                # Shift away from high-risk areas
                lat, lng = RoutingService._shift_from_risk(lat, lng, db, method="aggressive")
            elif method == "balanced":
                # Minor risk avoidance
                lat, lng = RoutingService._shift_from_risk(lat, lng, db, method="mild")

            geometry.append([lat, lng])

        geometry.append([end_lat, end_lng])
        return geometry

    @staticmethod
    def _shift_from_risk(lat: float, lng: float, db: Session, method: str = "mild") -> tuple:
        """Shift waypoint away from flood zones."""
        penalty = RoutingService.calculate_flood_risk_penalty(db, lat, lng)

        if penalty > 0.7:
            return (lat, lng)

        nearby_alerts = db.query(Alert).filter(
            Alert.lat.between(lat - 0.05, lat + 0.05),
            Alert.lng.between(lng - 0.05, lng + 0.05),
        ).all()

        if not nearby_alerts:
            return (lat, lng)

        avg_alert_lat = sum(a.lat for a in nearby_alerts) / len(nearby_alerts)
        avg_alert_lng = sum(a.lng for a in nearby_alerts) / len(nearby_alerts)

        shift_amount = 0.15 if method == "aggressive" else 0.05

        shift_lat = lat + (lat - avg_alert_lat) * shift_amount
        shift_lng = lng + (lng - avg_alert_lng) * shift_amount

        return (shift_lat, shift_lng)

    @staticmethod
    def get_priority_safe_zones(lat: float, lng: float, db: Session, count: int = 3) -> list[dict]:
        """Find priority evacuation points sorted by distance and safety."""
        zones = db.query(SafeZone).all()

        scored = []
        for zone in zones:
            distance = haversine_km(lat, lng, zone.lat, zone.lng)
            risk = RoutingService.calculate_flood_risk_penalty(db, zone.lat, zone.lng)
            score = distance / max(risk, 0.1)

            scored.append({
                "id": zone.id,
                "name": zone.name,
                "lat": zone.lat,
                "lng": zone.lng,
                "distance_km": round(distance, 2),
                "safety": round(risk, 3),
                "score": round(score, 2),
            })

        return sorted(scored, key=lambda z: z["score"])[:count]
