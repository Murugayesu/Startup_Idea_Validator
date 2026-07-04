from supabase import create_client, Client
from functools import lru_cache
from app.core.config import get_settings


@lru_cache
def get_anon_client() -> Client:
    """
    Supabase client using the anon/public key.
    Respects RLS policies — used for user-facing queries in the API.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_service_client() -> Client:
    """
    Supabase client using the service_role key.
    Bypasses RLS — used ONLY by the Celery worker to write run_events
    and update validation_runs. Never exposed to the frontend.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
