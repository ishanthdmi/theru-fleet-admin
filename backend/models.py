from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

# =============================================================================
# ENUMS
# =============================================================================

class DeviceStatus(str, Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    INACTIVE = "INACTIVE"

class DriverStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"

class ClientStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"

class CampaignStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

# =============================================================================
# DEVICE MODELS
# =============================================================================

class DeviceRegisterRequest(BaseModel):
    """Request from tablet app on first launch"""
    model: str
    os_version: str
    app_version: str
    serial_number: Optional[str] = None

class DeviceRegisterResponse(BaseModel):
    """Response to tablet after registration"""
    device_code: str
    secret_key: str
    polling_interval: int = 300

class DeviceHeartbeatRequest(BaseModel):
    """Heartbeat payload from tablet"""
    battery: int
    is_charging: bool
    storage_free_gb: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    network_type: Optional[str] = None

class DeviceHeartbeatResponse(BaseModel):
    status: str = "OK"
    server_time: datetime

class DeviceCreate(BaseModel):
    """Admin creates device manually"""
    serial_number: Optional[str] = None
    vehicle_reg_number: Optional[str] = None
    driver_id: Optional[str] = None
    city: Optional[str] = None

class DeviceResponse(BaseModel):
    id: str
    device_code: str
    model: Optional[str] = None
    os_version: Optional[str] = None
    serial_number: Optional[str] = None
    vehicle_reg_number: Optional[str] = None
    city: Optional[str] = None
    status: str
    battery_level: Optional[int] = None
    is_charging: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_seen: Optional[datetime] = None
    created_at: datetime

# =============================================================================
# DRIVER MODELS
# =============================================================================

class DriverCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    license_number: Optional[str] = None
    city: Optional[str] = None

class DriverResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    license_number: Optional[str] = None
    assigned_vehicle: Optional[str] = None
    city: Optional[str] = None
    status: str
    created_at: datetime

# =============================================================================
# CLIENT MODELS
# =============================================================================

class ClientCreate(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    billing_address: Optional[str] = None
    gst_number: Optional[str] = None

class ClientResponse(BaseModel):
    id: str
    company_name: str
    contact_person: Optional[str] = None
    email: str
    phone: Optional[str] = None
    status: str
    created_at: datetime

# =============================================================================
# CAMPAIGN MODELS
# =============================================================================

class CampaignCreate(BaseModel):
    client_id: str
    campaign_name: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    target_cities: Optional[List[str]] = []
    target_device_ids: Optional[List[str]] = []
    priority: int = 1
    daily_impression_limit: Optional[int] = None
    total_impression_limit: Optional[int] = None

class CampaignResponse(BaseModel):
    id: str
    client_id: str
    campaign_name: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    target_cities: Optional[List[str]] = []
    target_device_ids: Optional[List[str]] = []
    priority: int
    daily_impression_limit: Optional[int] = None
    total_impression_limit: Optional[int] = None
    status: str
    created_at: datetime

# =============================================================================
# AD MODELS
# =============================================================================

class AdResponse(BaseModel):
    id: str
    campaign_id: str
    file_name: str
    file_url: str
    duration_seconds: int
    is_active: bool
    created_at: datetime

class AdForDevice(BaseModel):
    """Ad payload for device - includes signed URL"""
    ad_id: str
    file_url: str  # Signed URL
    duration: int
    checksum: Optional[str] = None
    valid_from: date
    valid_to: date

class DeviceAdsResponse(BaseModel):
    """Response for GET /api/device/ads"""
    ads: List[AdForDevice]
    server_time: datetime

# =============================================================================
# IMPRESSION MODELS
# =============================================================================

class ImpressionRequest(BaseModel):
    """Single impression from device"""
    ad_id: str
    timestamp: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ImpressionResponse(BaseModel):
    status: str = "recorded"
    impression_id: str

# =============================================================================
# ANALYTICS MODELS
# =============================================================================

class AnalyticsOverview(BaseModel):
    total_devices: int
    online_devices: int
    offline_devices: int
    total_campaigns: int
    active_campaigns: int
    total_impressions: int
    today_impressions: int

class CampaignAnalytics(BaseModel):
    campaign_id: str
    campaign_name: str
    client_name: str
    total_impressions: int
    unique_devices: int
    active_days: int
    start_date: date
    end_date: date
    status: str

class DeviceAnalytics(BaseModel):
    device_id: str
    device_code: str
    total_impressions: int
    today_impressions: int
    city: Optional[str] = None
    status: str
