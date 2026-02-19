import boto3
from botocore.config import Config
from config import get_settings
import hashlib
import logging
from datetime import datetime, timedelta
from functools import lru_cache

logger = logging.getLogger(__name__)

@lru_cache
def get_r2_client():
    """Get Cloudflare R2 client (S3-compatible)"""
    settings = get_settings()
    
    client = boto3.client(
        's3',
        endpoint_url=settings.cloudflare_r2_endpoint,
        aws_access_key_id=settings.cloudflare_r2_access_key,
        aws_secret_access_key=settings.cloudflare_r2_secret_key,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )
    return client

async def upload_to_r2(file_content: bytes, file_name: str, campaign_id: str, content_type: str = "video/mp4") -> dict:
    """
    Upload file to Cloudflare R2
    Returns: {r2_key, file_url, checksum, file_size}
    """
    settings = get_settings()
    client = get_r2_client()
    
    # Generate unique key
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    checksum = hashlib.sha256(file_content).hexdigest()[:16]
    r2_key = f"ads/{campaign_id}/{timestamp}_{checksum}_{file_name}"
    
    try:
        # Upload to R2
        client.put_object(
            Bucket=settings.cloudflare_r2_bucket,
            Key=r2_key,
            Body=file_content,
            ContentType=content_type,
            Metadata={
                'campaign_id': campaign_id,
                'checksum': checksum,
                'uploaded_at': datetime.utcnow().isoformat()
            }
        )
        
        # Generate public URL (for direct access if bucket is public)
        file_url = f"{settings.cloudflare_r2_public_url}/{r2_key}"
        
        logger.info(f"Uploaded to R2: {r2_key}")
        
        return {
            "r2_key": r2_key,
            "file_url": file_url,
            "checksum": hashlib.sha256(file_content).hexdigest(),
            "file_size": len(file_content)
        }
    except Exception as e:
        logger.error(f"R2 upload failed: {e}")
        raise

def generate_signed_url(r2_key: str, expiry_seconds: int = None) -> str:
    """
    Generate a signed URL for secure file access
    Default expiry: 24 hours
    """
    settings = get_settings()
    client = get_r2_client()
    
    if expiry_seconds is None:
        expiry_seconds = settings.signed_url_expiry_seconds
    
    try:
        signed_url = client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.cloudflare_r2_bucket,
                'Key': r2_key
            },
            ExpiresIn=expiry_seconds
        )
        return signed_url
    except Exception as e:
        logger.error(f"Failed to generate signed URL: {e}")
        # Fallback to public URL
        return f"{settings.cloudflare_r2_public_url}/{r2_key}"

async def delete_from_r2(r2_key: str) -> bool:
    """Delete file from R2"""
    settings = get_settings()
    client = get_r2_client()
    
    try:
        client.delete_object(
            Bucket=settings.cloudflare_r2_bucket,
            Key=r2_key
        )
        logger.info(f"Deleted from R2: {r2_key}")
        return True
    except Exception as e:
        logger.error(f"R2 delete failed: {e}")
        return False

async def list_campaign_ads(campaign_id: str) -> list:
    """List all ads for a campaign in R2"""
    settings = get_settings()
    client = get_r2_client()
    
    prefix = f"ads/{campaign_id}/"
    
    try:
        response = client.list_objects_v2(
            Bucket=settings.cloudflare_r2_bucket,
            Prefix=prefix
        )
        
        files = []
        for obj in response.get('Contents', []):
            files.append({
                'key': obj['Key'],
                'size': obj['Size'],
                'last_modified': obj['LastModified'].isoformat()
            })
        return files
    except Exception as e:
        logger.error(f"Failed to list R2 objects: {e}")
        return []
