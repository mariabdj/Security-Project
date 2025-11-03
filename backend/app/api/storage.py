import os
import uuid
import base64
from typing import Optional, List # <-- [FIXED] Import Optional and List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Body
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.responses import Response
from ..security.security import oauth2_scheme, get_current_user_id
from ..core.supabase_client import supabase
from ..models import schemas

# Import all steganography tools
from ..security.steganography_tools import image_steg, audio_steg, video_steg

router = APIRouter(
    prefix="/storage",
    tags=["Storage & Steganography"]
)

BUCKET_NAME = "steganography_files"

# --- EXISTING /upload ENDPOINT (Keep) ---

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
        
        supabase_url = os.environ.get("SUPABASE_URL")
        if not supabase_url:
            raise HTTPException(status_code=500, detail="SUPABASE_URL not configured in .env")
        upload_url = f"{supabase_url}/storage/v1/object/{BUCKET_NAME}/{file_path}"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": file.content_type
        }
        
        response = supabase.postgrest.session.post(
            upload_url, headers=headers, data=contents
        )
        
        response.raise_for_status()

        public_url = f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/{file_path}"
            
        return {"file_url": public_url}

    except Exception as e:
        error_detail = f"An unexpected error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Error from Supabase: {e.response.text}"
        
        raise HTTPException(status_code=500, detail=error_detail)

# --- EXISTING FUNCTIONAL STEGANOGRAPHY ENDPOINTS (Keep) ---

@router.post("/steganography/image/encode", response_class=Response)
async def steganography_image_encode(
    secret_message: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id) 
):
    """Hides a secret message in an image and returns the new image file."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    try:
        image_bytes = await file.read()
        encoded_image_bytes = image_steg.encode_message(image_bytes, secret_message)
        return Response(
            content=encoded_image_bytes,
            media_type="image/png", # Force PNG for LSB
            headers={"Content-Disposition": f"attachment; filename=encoded_{file.filename}.png"}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.post("/steganography/image/decode", response_model=dict)
async def steganography_image_decode(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id) 
):
    """Extracts a secret message from an image."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    try:
        image_bytes = await file.read()
        decoded_message = image_steg.decode_message(image_bytes)
        if not decoded_message:
            raise HTTPException(status_code=404, detail="No hidden message found.")
        return {"secret_message": decoded_message}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


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

# --- [NEW] VISUALIZATION ENDPOINT ---

@router.post("/steganography/visualize/{media_type}/{mode}", response_model=schemas.StegoVisualizationResponse)
async def steganography_visualize(
    media_type: str, # 'image', 'audio', 'video'
    mode: str, # 'encode', 'decode'
    secret_message: Optional[str] = Form(None),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """
    Provides a step-by-step breakdown of the steganography process.
    The file data is passed directly in the request body.
    """
    
    file_bytes = await file.read()

    # 1. Validation and Dispatch
    if media_type == 'image':
        steg_module = image_steg
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image.")
    elif media_type == 'audio':
        steg_module = audio_steg
        if not file.content_type.startswith("audio/wav"):
            raise HTTPException(status_code=400, detail="File must be a WAV audio file.")
    elif media_type == 'video':
        steg_module = video_steg
        if not file.content_type.startswith("video/"):
            raise HTTPException(status_code=400, detail="File must be a video file.")
    else:
        raise HTTPException(status_code=400, detail="Invalid media type.")

    if mode == 'encode' and not secret_message:
        raise HTTPException(status_code=400, detail="Secret message is required for encoding.")
        
    try:
        # 2. Generate Steps (Logic is in the respective module)
        if mode == 'encode':
            # Dispatch to LSB or Append logic
            func = getattr(steg_module, f"visualize_encode_lsb_{media_type}" if media_type in ['image', 'audio'] else "visualize_encode_append_video")
            steps = func(file_bytes, secret_message)
            
            # For encoding, get the final encoded file and convert it to Base64
            final_func = getattr(steg_module, 'encode_message')
            final_bytes = final_func(file_bytes, secret_message)
            final_data_url = f"data:{file.content_type};base64,{base64.b64encode(final_bytes).decode('utf-8')}"
            
        elif mode == 'decode':
            # Dispatch to LSB or Append logic
            func = getattr(steg_module, f"visualize_decode_lsb_{media_type}" if media_type in ['image', 'audio'] else "visualize_decode_append_video")
            steps = func(file_bytes)
            final_data_url = None
            
        else:
            raise HTTPException(status_code=400, detail="Invalid mode. Must be 'encode' or 'decode'.")
        
        # 3. Return Response
        return schemas.StegoVisualizationResponse(
            steps=steps,
            final_result_data={
                "data_url": final_data_url,
                "mime_type": file.content_type,
                "original_filename": file.filename
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Steganography Error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")
