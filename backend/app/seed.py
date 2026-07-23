from sqlalchemy.orm import Session

from models.safe_zone import SafeZone

# Real evacuation centers in Medan, North Sumatra
MEDAN_SAFE_ZONES = [
    {
        "name": "Masjid Raya Al-Mashun",
        "lat": 3.5751,
        "lng": 98.6853,
        "capacity": 500,
        "address": "Jl. Sisingamangaraja, Medan",
    },
    {
        "name": "Lapangan Merdeka Medan",
        "lat": 3.5892,
        "lng": 98.6736,
        "capacity": 2000,
        "address": "Jl. Balai Kota, Medan",
    },
    {
        "name": "Universitas Sumatera Utara",
        "lat": 3.5629,
        "lng": 98.6544,
        "capacity": 1000,
        "address": "Jl. Perpustakaan, Medan",
    },
    {
        "name": "Gedung Serbaguna Pemko Medan",
        "lat": 3.5897,
        "lng": 98.6742,
        "capacity": 800,
        "address": "Jl. Balai Kota No.2, Medan",
    },
]


def seed_database(db: Session) -> None:
    """Initialize database with real evacuation safe zones."""
    if db.query(SafeZone).count() == 0:
        for zone in MEDAN_SAFE_ZONES:
            db.add(SafeZone(**zone))
    db.commit()
