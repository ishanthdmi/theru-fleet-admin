from supabase import create_client, Client
from config import get_settings
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

@lru_cache
def get_supabase_client() -> Client:
    """Get Supabase client instance (singleton)"""
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_key)
    logger.info("Supabase client initialized")
    return client

def get_db() -> Client:
    """Dependency for FastAPI routes"""
    return get_supabase_client()
