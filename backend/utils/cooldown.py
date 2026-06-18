import time
from math import floor

# Simple in-memory cooldown manager for demo. In production, use Redis.
class CooldownManager:
    def __init__(self, default_seconds=600):
        self.default_seconds = default_seconds
        self.store = {}  # key -> expiry timestamp

    def _key(self, user_id, lat, lon):
        # bucket by coarse grid to avoid per-point explosion
        if lat is None or lon is None:
            return f"user:{user_id}"
        lat_b = floor(lat * 10) / 10.0
        lon_b = floor(lon * 10) / 10.0
        return f"user:{user_id}:grid:{lat_b}:{lon_b}"

    def can_send(self, user_id, lat, lon):
        k = self._key(user_id, lat, lon)
        now = time.time()
        exp = self.store.get(k)
        if exp and exp > now:
            return False
        self.store[k] = now + self.default_seconds
        return True
