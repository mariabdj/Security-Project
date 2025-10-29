import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials
from ..security.security import oauth2_scheme, get_current_user_id
from ..core.supabase_client import supabase
from ..models import schemas

router = APIRouter(
    prefix="/storage",
    tags=["Storage & Steganography"]
)

BUCKET_NAME = "steganography_files"

@router.post("/upload", response_model=schemas.FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Uploads a file to the user's private folder in Supabase Storage.
    """
    if not (
        file.content_type.startswith("image/") or
        file.content_type.startswith("audio/") or
        file.content_type.startswith("video/")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only images, audio, or video files are allowed."
        )

    try:
        contents = await file.read()
        file_path = f"{user_id}/{uuid.uuid4()}-{file.filename}"
        token = creds.credentials
        
        # The supabase-python library's upload method is buggy with RLS.
        # We will use the underlying postgrest client to make a direct HTTP request.
        # This is more robust.
        
        # Manually construct the upload URL
        supabase_url = os.environ.get("SUPABASE_URL")
        if not supabase_url:
            raise HTTPException(status_code=500, detail="SUPABASE_URL not configured in .env")
        upload_url = f"{supabase_url}/storage/v1/object/{BUCKET_NAME}/{file_path}"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": file.content_type
        }
        
        # Use the http client that supabase-py uses internally to make the request
        # This ensures we are using the same session
        response = supabase.postgrest.session.post(
            upload_url, headers=headers, data=contents
        )
        
        # Check for HTTP errors from the manual request
        response.raise_for_status()

        # Manually construct the public URL
        public_url = f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/{file_path}"
            
        return {"file_url": public_url}

    except Exception as e:
        # Provide a more detailed error message
        error_detail = f"An unexpected error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Error from Supabase: {e.response.text}"
        
        raise HTTPException(status_code=500, detail=error_detail)

# backend/app/api/storage.py

# ... (keep all your existing imports and the /upload endpoint) ...

# --- NEW IMPORTS FOR STEGANOGRAPHY ---
from ..security.steganography_tools import image_steg
from fastapi import Form
from fastapi.responses import Response
# --- END NEW IMPORTS ---


@router.post("/steganography/image/encode", response_class=Response)
async def steganography_image_encode(
    secret_message: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id) # Protected
):
    """
    Hides a secret message in an image and returns the new image file.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        image_bytes = await file.read()
        
        # Use our "pure" logic to create the new image
        encoded_image_bytes = image_steg.encode_message(image_bytes, secret_message)
        
        # Return the new image directly as a downloadable file
        return Response(
            content=encoded_image_bytes,
            media_type="image/png",
            headers={"Content-Disposition": f"attachment; filename=encoded_{file.filename}.png"}
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.post("/steganography/image/decode", response_model=dict)
async def steganography_image_decode(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id) # Protected
):
    """
    Extracts a secret message from an image.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        image_bytes = await file.read()
        
        # Use our "pure" logic to decode the message
        decoded_message = image_steg.decode_message(image_bytes)
        
        if not decoded_message:
            raise HTTPException(status_code=404, detail="No hidden message found.")

        return {"secret_message": decoded_message}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


# backend/app/api/storage.py

# ... (keep all your existing imports and image endpoints) ...

# --- NEW IMPORTS ---
from ..security.steganography_tools import audio_steg, video_steg
# --- END NEW IMPORTS ---


# ... (keep your existing /image/encode and /image/decode endpoints) ...


# --- NEW AUDIO ENDPOINTS ---

@router.post("/steganography/audio/encode", response_class=Response)
async def steganography_audio_encode(
    secret_message: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """Hides a secret message in a WAV audio file."""
    if not file.content_type.startswith("audio/wav"):
        raise HTTPException(status_code=400, detail="File must be a WAV audio file (.wav).")
    try:
        audio_bytes = await file.read()
        encoded_audio_bytes = audio_steg.encode_message(audio_bytes, secret_message)
        return Response(
            content=encoded_audio_bytes,
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=encoded_{file.filename}"}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.post("/steganography/audio/decode", response_model=dict)
async def steganography_audio_decode(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """Extracts a secret message from a WAV audio file."""
    if not file.content_type.startswith("audio/wav"):
        raise HTTPException(status_code=400, detail="File must be a WAV audio file (.wav).")
    try:
        audio_bytes = await file.read()
        decoded_message = audio_steg.decode_message(audio_bytes)
        if not decoded_message:
            raise HTTPException(status_code=404, detail="No hidden message found.")
        return {"secret_message": decoded_message}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

# --- NEW VIDEO ENDPOINTS ---

@router.post("/steganography/video/encode", response_class=Response)
async def steganography_video_encode(
    secret_message: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """Hides a secret message at the end of a video file."""
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video file.")
    try:
        video_bytes = await file.read()
        encoded_video_bytes = video_steg.encode_message(video_bytes, secret_message)
        return Response(
            content=encoded_video_bytes,
            media_type=file.content_type,
            headers={"Content-Disposition": f"attachment; filename=encoded_{file.filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.post("/steganography/video/decode", response_model=dict)
async def steganography_video_decode(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """Extracts a secret message from the end of a video file."""
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video file.")
    try:
        video_bytes = await file.read()
        decoded_message = video_steg.decode_message(video_bytes)
        if not decoded_message:
            raise HTTPException(status_code=404, detail="No hidden message found.")
        return {"secret_message": decoded_message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")