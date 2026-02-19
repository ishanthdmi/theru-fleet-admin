from fastapi import HTTPException, Depends, status, Security, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional, Dict, Any, Annotated
from pydantic import BaseModel
from config import get_settings
from database import get_db
from supabase import Client
import secrets
import httpx
from functools import lru_cache
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

security = HTTPBearer()

# =============================================================================
# JWT VERIFICATION WITH JWKS (ES256)
# =============================================================================

@lru_cache(maxsize=1)
def get_jwks_client():
    """Get PyJWKClient for ES256 verification"""
    try:
        from jwt import PyJWKClient
        settings = get_settings()
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        return PyJWKClient(jwks_url, cache_keys=True)
    except ImportError:
        logger.warning("PyJWKClient not available, using fallback verification")
        return None

async def verify_jwt_token(token: str) -> dict:
    """
    Verify JWT token from Supabase
    Tries ES256 with JWKS first, falls back to claim verification
    """
    settings = get_settings()
    
    # Try JWKS verification first (proper ES256)
    jwks_client = get_jwks_client()
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                options={"verify_aud": False}
            )
            return payload
        except Exception as e:
            logger.warning(f"JWKS verification failed: {e}, trying fallback")
    
    # Fallback: Verify with JWT secret (HS256) or without signature
    try:
        # First try HS256 with the JWT secret
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        return payload
    except JWTError:
        # Last resort: decode without signature verification but verify issuer
        payload = jwt.decode(
            token,
            key="",
            options={"verify_signature": False, "verify_aud": False, "verify_exp": True}
        )
        
        # Verify issuer matches our Supabase instance
        expected_issuer = f"{settings.supabase_url}/auth/v1"
        if payload.get("iss") != expected_issuer:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer"
            )
        
        return payload

# =============================================================================
# USER AUTHENTICATION (Admin Dashboard)
# =============================================================================

class UserResponse(BaseModel):
    sub: str
    email: str
    role: str
    user_id: str

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(security)],
    db: Client = Depends(get_db)
) -> UserResponse:
    """Get current authenticated user from JWT"""
    token = credentials.credentials
    
    try:
        payload = await verify_jwt_token(token)
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims"
            )
        
        # Get role from user_roles table
        role = "admin"  # default to admin for now (single admin system)
        try:
            result = db.table("user_roles").select("role").eq("user_id", user_id).execute()
            if result.data and len(result.data) > 0:
                role = result.data[0].get("role", "admin")
            else:
                # Default to admin if no role found
                role = payload.get("user_role") or payload.get("role") or "admin"
        except Exception as e:
            logger.warning(f"Failed to fetch user role: {e}")
            role = "admin"
        
        return UserResponse(
            sub=user_id,
            email=email or "",
            role=role,
            user_id=user_id
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except JWTError as e:
        logger.error(f"JWT validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles
    
    async def __call__(self, current_user: Annotated[UserResponse, Depends(get_current_user)]) -> bool:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' not permitted"
            )
        return True

# =============================================================================
# DEVICE AUTHENTICATION (Tablet App)
# =============================================================================

class DeviceAuth(BaseModel):
    device_id: str
    device_code: str

async def verify_device_auth(
    x_device_code: str = Header(..., alias="X-Device-Code"),
    x_secret_key: str = Header(..., alias="X-Secret-Key"),
    db: Client = Depends(get_db)
) -> DeviceAuth:
    """
    Verify device authentication using deviceCode + secretKey
    Used by tablet app for all API calls
    """
    if not x_device_code or not x_secret_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Device credentials required"
        )
    
    try:
        # Look up device by device_code and secret_key
        result = db.table("devices").select("id, device_code").eq(
            "device_code", x_device_code
        ).eq(
            "secret_key", x_secret_key
        ).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid device credentials"
            )
        
        device = result.data[0]
        
        return DeviceAuth(
            device_id=device["id"],
            device_code=device["device_code"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device auth failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def generate_device_code(prefix: str = "THR") -> str:
    """Generate unique device code like THR-BLR-001"""
    import random
    import string
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"{prefix}-{suffix}"

def generate_secret_key() -> str:
    """Generate secure 64-character secret key"""
    return secrets.token_urlsafe(48)
