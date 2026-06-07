from datetime import date

from sqlalchemy.orm import Session

from models.alert import Alert
from models.historical_flood import HistoricalFlood
from models.safe_zone import SafeZone


def seed_database(db: Session) -> None:
    if db.query(SafeZone).count() == 0:
        zones = [
            SafeZone(name="GOR Satria Medan", lat=3.5621, lng=98.6534, capacity=2000, address="Jl. Gatot Subroto, Medan"),
            SafeZone(name="Lapangan Merdeka Medan", lat=3.5892, lng=98.6741, capacity=5000, address="Jl. Balai Kota, Medan"),
            SafeZone(name="UNIMED Campus", lat=3.5387, lng=98.6723, capacity=3000, address="Jl. Willem Iskandar, Medan"),
            SafeZone(name="Masjid Raya Al Mashun", lat=3.5734, lng=98.6867, capacity=1500, address="Jl. Masjid Raya, Medan"),
        ]
        db.add_all(zones)

    if db.query(HistoricalFlood).count() == 0:
        floods = [
            HistoricalFlood(location="Medan Helvetia", lat=3.5952, lng=98.6722, flood_date=date(2022, 12, 2), severity="critical"),
            HistoricalFlood(location="Medan Denai", lat=3.5214, lng=98.6731, flood_date=date(2023, 3, 15), severity="high"),
            HistoricalFlood(location="Medan Tuntungan", lat=3.6123, lng=98.6345, flood_date=date(2021, 10, 8), severity="high"),
            HistoricalFlood(location="Deli Serdang", lat=3.5489, lng=98.7123, flood_date=date(2020, 11, 20), severity="moderate"),
        ]
        db.add_all(floods)

    if db.query(Alert).count() == 0:
        alerts = [
            Alert(title="Deli River Overflowing", location="Medan Helvetia", lat=3.5952, lng=98.6722, severity="critical", source="BNPB"),
            Alert(title="Extreme Rainfall", location="Medan Denai", lat=3.5214, lng=98.6731, severity="high", source="BMKG"),
            Alert(title="Landslide Detected", location="Medan Tuntungan", lat=3.6123, lng=98.6345, severity="high", source="community"),
        ]
        db.add_all(alerts)

    db.commit()
