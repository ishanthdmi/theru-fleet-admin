from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    # Supabase Configuration (PostgreSQL)
    supabase_url: str
    supabase_key: str  # This should be the service_role key for backend
    supabase_jwt_secret: str
    
    # CORS
    cors_origins: str = "*"
    
    # Cloudflare R2 Configuration
    cloudflare_r2_access_key: str
    cloudflare_r2_secret_key: str
    cloudflare_r2_bucket: str = "theru-ads"
    cloudflare_r2_endpoint: str
    cloudflare_r2_public_url: str
    cloudflare_account_id: str = ""
    
    # Device Config
    device_polling_interval: int = 300  # 5 minutes
    device_offline_threshold: int = 600  # 10 minutes
    
    # R2 Signed URL Expiry
    signed_url_expiry_seconds: int = 86400  # 24 hours
    
    model_config = SettingsConfigDict(env_file=".env")

@lru_cache
def get_settings() -> Settings:
    return Settings()
