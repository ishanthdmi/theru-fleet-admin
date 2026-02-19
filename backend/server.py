from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client
from config import get_settings
from database import get_db
from auth import (
    get_current_user, RoleChecker, verify_device_auth,
    UserResponse, DeviceAuth, generate_device_code, generate_secret_key
)
from storage import upload_to_r2, generate_signed_url, delete_from_r2
from models import (
    DeviceRegisterRequest, DeviceRegisterResponse,
    DeviceHeartbeatRequest, DeviceHeartbeatResponse,
    DeviceCreate, DeviceResponse,
    DriverCreate, DriverResponse,
    ClientCreate, ClientResponse,
    CampaignCreate, CampaignResponse,
    AdResponse, AdForDevice, DeviceAdsResponse,
    ImpressionRequest, ImpressionResponse,
    AnalyticsOverview
)
from typing import List, Optional, Annotated
from datetime import datetime, timezone, date, timedelta
import logging
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()
app = FastAPI(title="Theru Fleet Ad Network API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# =============================================================================
# HEALTH & ROOT
# =============================================================================

@api_router.get("/")
async def root():
    return {"message": "Theru Fleet Ad Network API", "version": "2.0.0"}

@api_router.get("/health")
async def health_check(db: Client = Depends(get_db)):
    try:
        result = db.table("devices").select("id").limit(1).execute()
        return {"status": "healthy", "database": "connected", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "degraded", "database": "error", "error": str(e)}

# =============================================================================
# DEVICE REGISTRATION & HEARTBEAT (For Tablet App)
# =============================================================================

@api_router.post("/device/register", response_model=DeviceRegisterResponse)
async def register_device(
    request: DeviceRegisterRequest,
    db: Client = Depends(get_db)
):
    """
    Register a new device on first launch.
    Returns deviceCode and secretKey for authentication.
    """
    device_code = generate_device_code()
    secret_key = generate_secret_key()
    
    device_data = {
        "device_code": device_code,
        "secret_key": secret_key,
        "status": "offline"
    }
    
    try:
        result = db.table("devices").insert(device_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to register device")
        
        logger.info(f"Device registered: {device_code}")
        
        return DeviceRegisterResponse(
            device_code=device_code,
            secret_key=secret_key,
            polling_interval=settings.device_polling_interval
        )
    except Exception as e:
        logger.error(f"Device registration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/device/heartbeat", response_model=DeviceHeartbeatResponse)
async def device_heartbeat(
    request: DeviceHeartbeatRequest,
    device: DeviceAuth = Depends(verify_device_auth),
    db: Client = Depends(get_db)
):
    """
    Receive heartbeat from device every 5 minutes.
    Updates device status and stores telemetry.
    """
    now = datetime.now(timezone.utc)
    
    # Update device status
    update_data = {
        "status": "online",
        "last_seen": now.isoformat()
    }
    
    try:
        # Update device
        db.table("devices").update(update_data).eq("id", device.device_id).execute()
        
        # Store heartbeat log (matching user's schema: battery, gps_lat, gps_lng, storage_free)
        heartbeat_data = {
            "device_id": device.device_id,
            "battery": request.battery,
            "gps_lat": request.latitude,
            "gps_lng": request.longitude,
            "storage_free": int(request.storage_free_gb * 1024) if request.storage_free_gb else None  # Convert GB to MB
        }
        db.table("heartbeats").insert(heartbeat_data).execute()
        
        logger.info(f"Heartbeat received: {device.device_code}")
        
        return DeviceHeartbeatResponse(
            status="OK",
            server_time=now
        )
    except Exception as e:
        logger.error(f"Heartbeat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/device/ads", response_model=DeviceAdsResponse)
async def get_device_ads(
    device: DeviceAuth = Depends(verify_device_auth),
    db: Client = Depends(get_db)
):
    """
    Get all active ads assigned to this device.
    Returns signed URLs for secure download.
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    
    try:
        # Get device info (for city targeting)
        device_result = db.table("devices").select("id, city").eq("id", device.device_id).execute()
        device_info = device_result.data[0] if device_result.data else {}
        device_city = device_info.get("city")
        
        # Get all active campaigns (where today is between start_date and end_date)
        campaigns_result = db.table("campaigns").select("*").execute()
        
        ads_for_device = []
        
        for campaign in campaigns_result.data or []:
            # Check date range
            start_date_str = campaign.get("start_date")
            end_date_str = campaign.get("end_date")
            
            if not start_date_str or not end_date_str:
                continue
                
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            
            if not (start_date <= today <= end_date):
                continue
            
            # Get ads for this campaign
            ads_result = db.table("ads").select("*").eq("campaign_id", campaign["id"]).execute()
            
            for ad in ads_result.data or []:
                file_url = ad.get("file_url", "")
                
                # If it's an R2 key, generate signed URL
                if file_url and not file_url.startswith("http"):
                    file_url = generate_signed_url(file_url)
                
                ads_for_device.append(AdForDevice(
                    ad_id=ad["id"],
                    file_url=file_url,
                    duration=ad.get("duration", 30),
                    checksum=None,
                    valid_from=start_date,
                    valid_to=end_date
                ))
        
        logger.info(f"Returning {len(ads_for_device)} ads to device {device.device_code}")
        
        return DeviceAdsResponse(
            ads=ads_for_device,
            server_time=now
        )
    except Exception as e:
        logger.error(f"Get ads failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/device/impression", response_model=ImpressionResponse)
async def record_impression(
    request: ImpressionRequest,
    device: DeviceAuth = Depends(verify_device_auth),
    db: Client = Depends(get_db)
):
    """
    Record a single ad impression. CRITICAL FOR REVENUE.
    Each ad play must be logged - no batching, no skipping.
    """
    try:
        # Create impression record (matching user's schema)
        impression_data = {
            "device_id": device.device_id,
            "ad_id": request.ad_id,
            "played_at": request.timestamp.isoformat()
        }
        
        result = db.table("impressions").insert(impression_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to record impression")
        
        impression_id = result.data[0]["id"]
        
        logger.info(f"Impression recorded: {impression_id} for ad {request.ad_id}")
        
        return ImpressionResponse(
            status="recorded",
            impression_id=impression_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Impression recording failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# ADMIN: DEVICE MANAGEMENT
# =============================================================================

@api_router.get("/devices", response_model=List[DeviceResponse])
async def list_devices(
    city: Optional[str] = None,
    device_status: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """List all devices (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = db.table("devices").select("*")
    
    if city:
        query = query.eq("city", city)
    if device_status:
        query = query.eq("status", device_status)
    
    result = query.order("created_at", desc=True).execute()
    
    return [DeviceResponse(
        id=d["id"],
        device_code=d["device_code"],
        model=None,
        os_version=None,
        serial_number=None,
        vehicle_reg_number=None,
        city=d.get("city"),
        status=d.get("status", "offline"),
        battery_level=None,
        is_charging=None,
        latitude=None,
        longitude=None,
        last_seen=d.get("last_seen"),
        created_at=d.get("created_at")
    ) for d in result.data or []]

@api_router.get("/devices/{device_id}")
async def get_device(
    device_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get single device details"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = db.table("devices").select("*").eq("id", device_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Device not found")
    
    return result.data[0]

@api_router.put("/devices/{device_id}")
async def update_device(
    device_id: str,
    city: Optional[str] = None,
    driver_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Update device (assign to city, driver)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {}
    if city is not None:
        update_data["city"] = city
    if driver_id is not None:
        update_data["driver_id"] = driver_id
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = db.table("devices").update(update_data).eq("id", device_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Device not found")
    
    return {"message": "Device updated", "device": result.data[0]}

@api_router.delete("/devices/{device_id}")
async def delete_device(
    device_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Delete device"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db.table("devices").delete().eq("id", device_id).execute()
    
    return {"message": "Device deleted"}

# =============================================================================
# ADMIN: DRIVER MANAGEMENT
# =============================================================================

@api_router.post("/drivers")
async def create_driver(
    name: str = Query(...),
    phone: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    driver_data = {
        "name": name,
        "phone": phone
    }
    
    result = db.table("drivers").insert(driver_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create driver")
    
    return result.data[0]

@api_router.get("/drivers")
async def list_drivers(
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = db.table("drivers").select("*").execute()
    return result.data or []

@api_router.put("/drivers/{driver_id}")
async def update_driver(
    driver_id: str,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {}
    if name:
        update_data["name"] = name
    if phone:
        update_data["phone"] = phone
    
    result = db.table("drivers").update(update_data).eq("id", driver_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return {"message": "Driver updated"}

@api_router.delete("/drivers/{driver_id}")
async def delete_driver(
    driver_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db.table("drivers").delete().eq("id", driver_id).execute()
    
    return {"message": "Driver deleted"}

# =============================================================================
# ADMIN: CLIENT MANAGEMENT
# =============================================================================

@api_router.post("/clients")
async def create_client(
    name: str = Query(...),
    contact_person: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logger.info(f"Creating client: name={name}, contact={contact_person}, phone={phone}")
    
    client_data = {
        "name": name,
        "contact_person": contact_person,
        "phone": phone
    }
    
    result = db.table("clients").insert(client_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create client")
    
    return result.data[0]

@api_router.get("/clients")
async def list_clients(
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = db.table("clients").select("*").execute()
    return result.data or []

@api_router.put("/clients/{client_id}")
async def update_client(
    client_id: str,
    name: Optional[str] = None,
    contact_person: Optional[str] = None,
    phone: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {}
    if name:
        update_data["name"] = name
    if contact_person:
        update_data["contact_person"] = contact_person
    if phone:
        update_data["phone"] = phone
    
    result = db.table("clients").update(update_data).eq("id", client_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return {"message": "Client updated"}

# =============================================================================
# ADMIN: CAMPAIGN MANAGEMENT
# =============================================================================

@api_router.post("/campaigns")
async def create_campaign(
    name: str = Query(...),
    client_id: str = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logger.info(f"Creating campaign: name={name}, client={client_id}")
    
    campaign_data = {
        "name": name,
        "client_id": client_id,
        "start_date": start_date,
        "end_date": end_date
    }
    
    result = db.table("campaigns").insert(campaign_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create campaign")
    
    return result.data[0]

@api_router.get("/campaigns")
async def list_campaigns(
    client_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    query = db.table("campaigns").select("*")
    
    if client_id:
        query = query.eq("client_id", client_id)
    
    result = query.order("created_at", desc=True).execute()
    return result.data or []

@api_router.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {}
    if name:
        update_data["name"] = name
    if start_date:
        update_data["start_date"] = start_date
    if end_date:
        update_data["end_date"] = end_date
    
    result = db.table("campaigns").update(update_data).eq("id", campaign_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {"message": "Campaign updated"}

# =============================================================================
# ADMIN: AD UPLOAD & MANAGEMENT
# =============================================================================

@api_router.post("/campaigns/{campaign_id}/ads")
async def upload_ad(
    campaign_id: str,
    file: UploadFile = File(...),
    duration: int = Query(default=30, ge=1, le=300),
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Upload ad video to R2 and create database record"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video files are allowed")
    
    # Read file content
    content = await file.read()
    
    # Upload to R2
    try:
        upload_result = await upload_to_r2(
            file_content=content,
            file_name=file.filename,
            campaign_id=campaign_id,
            content_type=file.content_type
        )
    except Exception as e:
        logger.error(f"R2 upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    # Create database record (matching user's schema)
    ad_data = {
        "campaign_id": campaign_id,
        "file_url": upload_result["r2_key"],  # Store R2 key, generate signed URL on fetch
        "duration": duration
    }
    
    result = db.table("ads").insert(ad_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save ad record")
    
    return {
        "message": "Ad uploaded successfully",
        "ad": result.data[0],
        "signed_url": generate_signed_url(upload_result["r2_key"])
    }

@api_router.get("/campaigns/{campaign_id}/ads")
async def list_campaign_ads(
    campaign_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    result = db.table("ads").select("*").eq("campaign_id", campaign_id).execute()
    
    ads = []
    for a in result.data or []:
        file_url = a.get("file_url", "")
        # Generate signed URL if it's an R2 key
        if file_url and not file_url.startswith("http"):
            signed_url = generate_signed_url(file_url)
        else:
            signed_url = file_url
        
        ads.append({
            "id": a["id"],
            "campaign_id": a["campaign_id"],
            "file_url": signed_url,
            "duration": a.get("duration", 30),
            "created_at": a.get("created_at")
        })
    
    return ads

@api_router.delete("/ads/{ad_id}")
async def delete_ad(
    ad_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get ad to find R2 key
    ad_result = db.table("ads").select("file_url").eq("id", ad_id).execute()
    
    if not ad_result.data:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    r2_key = ad_result.data[0].get("file_url", "")
    
    # Delete from R2 if it's a key
    if r2_key and not r2_key.startswith("http"):
        await delete_from_r2(r2_key)
    
    # Delete from database
    db.table("ads").delete().eq("id", ad_id).execute()
    
    return {"message": "Ad deleted"}

# =============================================================================
# ANALYTICS
# =============================================================================

@api_router.get("/analytics/overview")
async def get_analytics_overview(
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get overall system analytics"""
    
    # Device counts
    devices_result = db.table("devices").select("status").execute()
    devices = devices_result.data or []
    total_devices = len(devices)
    online_devices = len([d for d in devices if d.get("status") == "online"])
    offline_devices = total_devices - online_devices
    
    # Campaign counts
    campaigns_result = db.table("campaigns").select("id").execute()
    total_campaigns = len(campaigns_result.data or [])
    
    # Impression counts
    impressions_result = db.table("impressions").select("id, played_at").execute()
    impressions = impressions_result.data or []
    total_impressions = len(impressions)
    
    # Today's impressions
    today = date.today().isoformat()
    today_impressions = len([i for i in impressions if i.get("played_at", "").startswith(today)])
    
    return {
        "total_devices": total_devices,
        "online_devices": online_devices,
        "offline_devices": offline_devices,
        "total_campaigns": total_campaigns,
        "total_impressions": total_impressions,
        "today_impressions": today_impressions
    }

@api_router.get("/analytics/campaigns")
async def get_campaign_analytics(
    campaign_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get analytics per campaign"""
    query = db.table("campaigns").select("*")
    
    if campaign_id:
        query = query.eq("id", campaign_id)
    
    campaigns = query.execute().data or []
    
    analytics = []
    for c in campaigns:
        # Get client name
        client_name = "Unknown"
        try:
            client_result = db.table("clients").select("name").eq("id", c.get("client_id")).execute()
            if client_result.data:
                client_name = client_result.data[0].get("name", "Unknown")
        except:
            pass
        
        # Get impression count
        imp_count = 0
        unique_devices = 0
        try:
            imp_result = db.table("impressions").select("device_id, ad_id").execute()
            # Get ads for this campaign
            ads_result = db.table("ads").select("id").eq("campaign_id", c["id"]).execute()
            ad_ids = [a["id"] for a in (ads_result.data or [])]
            
            campaign_impressions = [i for i in (imp_result.data or []) if i.get("ad_id") in ad_ids]
            imp_count = len(campaign_impressions)
            unique_devices = len(set(i.get("device_id") for i in campaign_impressions))
        except:
            pass
        
        analytics.append({
            "campaign_id": c["id"],
            "campaign_name": c.get("name", "Unknown"),
            "client_id": c.get("client_id"),
            "client_name": client_name,
            "status": c.get("status", "SCHEDULED"),
            "start_date": c.get("start_date"),
            "end_date": c.get("end_date"),
            "total_impressions": imp_count,
            "unique_devices": unique_devices
        })
    
    return analytics

@api_router.get("/analytics/impressions")
async def get_impressions(
    campaign_id: Optional[str] = None,
    device_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get detailed impression data with filters"""
    
    query = db.table("impressions").select("*, ads(campaign_id)")
    
    if device_id:
        query = query.eq("device_id", device_id)
    if start_date:
        query = query.gte("played_at", start_date)
    if end_date:
        query = query.lte("played_at", end_date)
    
    result = query.order("played_at", desc=True).limit(limit).execute()
    
    impressions = result.data or []
    
    # Filter by campaign_id if specified (need to join through ads)
    if campaign_id:
        impressions = [i for i in impressions if i.get("ads", {}).get("campaign_id") == campaign_id]
    
    return impressions

# =============================================================================
# UTILITY: Mark offline devices (called periodically)
# =============================================================================

@api_router.post("/admin/mark-offline")
async def mark_offline_devices(
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Mark devices offline if no heartbeat in 10 minutes (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    threshold = datetime.now(timezone.utc) - timedelta(minutes=10)
    
    # Get devices that should be marked offline
    result = db.table("devices").update({"status": "offline"}).eq("status", "online").lt("last_seen", threshold.isoformat()).execute()
    
    count = len(result.data) if result.data else 0
    
    return {"message": f"Marked {count} devices as offline"}

# =============================================================================
# INCLUDE ROUTER & MIDDLEWARE
# =============================================================================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=settings.cors_origins.split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
