from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.safe_zone import SafeZone
from schemas import EvacuationRouteRequest, EvacuationRouteResponse, SafeZoneResponse
from services.geospatial import nearby_risk_grid
from services.routing import RoutingService
from utils.geo import haversine_km

router = APIRouter(prefix="/routes", tags=["routes"])
routing = RoutingService()


@router.post("/evacuation", response_model=EvacuationRouteResponse)
async def evacuation_route(payload: EvacuationRouteRequest, db: Session = Depends(get_db)):
    if payload.destination_lat is not None and payload.destination_lng is not None:
        zone = (
            db.query(SafeZone)
            .filter(
                SafeZone.lat.between(payload.destination_lat - 0.001, payload.destination_lat + 0.001),
                SafeZone.lng.between(payload.destination_lng - 0.001, payload.destination_lng + 0.001),
            )
            .first()
        )
        if not zone:
            zone = SafeZone(
                name="Custom Destination",
                lat=payload.destination_lat,
                lng=payload.destination_lng,
                capacity=0,
                address="User selected",
            )
    else:
        zones = db.query(SafeZone).all()
        if not zones:
            raise HTTPException(status_code=404, detail="No safe zones available")
        zone = min(zones, key=lambda z: haversine_km(payload.origin_lat, payload.origin_lng, z.lat, z.lng))

    dest = SafeZoneResponse(
        id=zone.id if zone.id is not None else 0,
        name=zone.name,
        lat=zone.lat,
        lng=zone.lng,
        capacity=zone.capacity,
        address=zone.address,
        distance_km=round(haversine_km(payload.origin_lat, payload.origin_lng, zone.lat, zone.lng), 2),
    )

    risk_points = nearby_risk_grid(payload.origin_lat, payload.origin_lng)
    route = await routing.evacuation_route(payload.origin_lat, payload.origin_lng, dest, risk_points)

    return EvacuationRouteResponse(
        destination=dest,
        distance_km=round(route["distance_km"], 2),
        duration_min=round(route["duration_min"], 1),
        geometry=route["geometry"],
        steps=route["steps"],
        risk_penalty_applied=route["risk_penalty_applied"],
    )
