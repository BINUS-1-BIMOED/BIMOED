from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""

    bmkg_api_key: str = ""
    open_meteo_base: str = "https://api.open-meteo.com/v1"
    ors_api_key: str = ""
    google_maps_api_key: str = ""

    # Shared secret for the /admin/* router (analytics, data export, cleanup — none of
    # it is called by the app itself). Required as an X-Admin-Key header; left empty,
    # the router refuses every request rather than defaulting to open.
    admin_api_key: str = ""

    model_path: str = "./ml/models/esster_pipeline.pkl"
    secondary_model_path: str = "./ml/models/flood_model.joblib"
    default_lat: float = 3.5952
    default_lng: float = 98.6722
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    api_prefix: str = "/api/v1"
    data_refresh_minutes: int = 15

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
