# backend/app/api/chats.py

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
import uuid
import os
import json
from ..core.supabase_client import supabase
from ..security.security import get_current_user_id, oauth2_scheme
from ..models import schemas
from typing import List

# --- [NEW] MiTM Imports ---
from ..security.mitm_tools import get_listeners, capture_packet, hash_data
# --- End MiTM Imports ---


router = APIRouter(
    prefix="/chats",
    tags=["Chats"]
)

# --- Helper Functions ---

def get_supabase_headers(token: str, content_type: str = "application/json"):
    """Creates standard headers for an authenticated Supabase request."""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": content_type,
        "Prefer": "return=representation" 
    }

def get_supabase_url():
    """Gets the Supabase URL from environment variables."""
    url = os.environ.get("SUPABASE_URL")
    if not url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")
    return url

# --- Chat Request Creation Endpoint ---

@router.post("/request", response_model=schemas.ChatRequest)
async def create_chat_request(
    request_data: schemas.ChatRequestCreate,
    sender_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Sends a chat request to another user.
    """
    
    sender_uuid = uuid.UUID(sender_id)
    
    if sender_uuid == request_data.receiver_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a chat request to yourself."
        )

    params = request_data.encryption_params
    method = request_data.encryption_method

    try:
        if method == "caesar":
            if "shift" not in params or not isinstance(params["shift"], int):
                raise ValueError("The 'shift' parameter (integer) is required for Caesar.")
        elif method == "playfair":
            if "key" not in params or not isinstance(params["key"], str):
                raise ValueError("The 'key' parameter (string) is required for Playfair.")
            if "size" not in params or not isinstance(params["size"], int):
                raise ValueError("The 'size' parameter (integer) is required for Playfair.")
            if params["size"] not in [5, 6]:
                raise ValueError("Size for Playfair must be 5 or 6.")
        elif method == "hill":
            if "key" not in params or not isinstance(params["key"], str):
                raise ValueError("The 'key' parameter (string) is required for Hill.")
            if "size" not in params or not isinstance(params["size"], int):
                raise ValueError("The 'size' parameter (integer) is required for Hill.")
            if params["size"] not in [2, 3]:
                raise ValueError("Size for Hill must be 2 or 3.")
        else:
            raise ValueError(f"Encryption method '{method}' not supported.")
            
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid encryption parameters: {e}")

    
    # --- [NEW] MiTM Capture for Chat Request ---
    # This happens *before* saving, capturing the plaintext data
    # and hashing it *for the demo packet only*.
    try:
        listeners = get_listeners()
        if listeners:
            # Hash all params for the MiTM demo, as requested
            hashed_method = hash_data(method)
            # Hash each parameter value
            hashed_params = {k: hash_data(v) for k, v in params.items()}
            
            mitm_data = {
                "sender_id": sender_id,
                "receiver_id": str(request_data.receiver_id),
                "hashed_method": hashed_method,
                "hashed_params": hashed_params
            }
            capture_packet(packet_type="chat_request", data=mitm_data, listeners=listeners)
    except Exception as e:
        print(f"MiTM Chat Request Capture Error: {e}") # Don't fail request
    # --- End MiTM Capture ---


    # Prepare new request for the database (using *plaintext* params)
    new_request_data = {
        "sender_id": sender_id,
        "receiver_id": str(request_data.receiver_id),
        "encryption_method": method,
        "encryption_params": params, # 'params' are the original, plaintext params
        "status": "pending"
    }

    # Insert the new chat request
    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        headers = get_supabase_headers(token)
        
        response = supabase.postgrest.session.post(
            f"{supabase_url}/rest/v1/chat_requests",
            headers=headers,
            data=json.dumps(new_request_data)
        )
        
        response.raise_for_status() 
            
        return response.json()[0] 

    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Supabase error: {e.response.text}"
             if "unique_chat_request" in e.response.text:
                 raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A chat request to this user already exists."
                 )
        
        raise HTTPException(status_code=500, detail=error_detail)
    

# --- Other Endpoints (Unchanged) ---

@router.get("/requests", response_model=List[schemas.ChatRequestDetails])
async def get_chat_requests(
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Retrieves all chat requests for the logged-in user.
    """
    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        headers = {"Authorization": f"Bearer {token}"} 
        
        params = {
            "select": "*,sender:users!sender_id(username),receiver:users!receiver_id(username)",
            "or": f"(sender_id.eq.{user_id},receiver_id.eq.{user_id})"
        }
        
        response = supabase.postgrest.session.get(
            f"{supabase_url}/rest/v1/chat_requests",
            headers=headers,
            params=params
        )
        
        response.raise_for_status()
        
        data = response.json()
        if not data:
            return []

        formatted_data = []
        for item in response.json():
            sender_username = item.get('sender', {}).get('username', 'Unknown')
            receiver_username = item.get('receiver', {}).get('username', 'Unknown')

            details = schemas.ChatRequestDetails(
                id=item['id'],
                sender_id=item['sender_id'],
                receiver_id=item['receiver_id'], 
                sender_username=sender_username,
                receiver_username=receiver_username, 
                status=item['status'],
                encryption_method=item['encryption_method'],
                encryption_params=item['encryption_params']
            )
            formatted_data.append(details)
            
        return formatted_data

    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Supabase error: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)


@router.put("/requests/{request_id}", response_model=schemas.ChatRequest)
async def respond_to_chat_request(
    request_id: uuid.UUID,
    response_data: schemas.ChatRequestUpdate,
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Allows a user to accept or reject a chat request.
    """
    
    new_status = response_data.status
    if new_status not in ["accepted", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'accepted' or 'rejected'"
        )

    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        headers = get_supabase_headers(token)
        
        params = {
            "id": f"eq.{str(request_id)}",
            "receiver_id": f"eq.{user_id}",
            "status": "eq.pending"
        }
        
        payload = {"status": new_status}

        response = supabase.postgrest.session.patch(
            f"{supabase_url}/rest/v1/chat_requests",
            headers=headers,
            params=params,
            data=json.dumps(payload)
        )
        
        response.raise_for_status()
        
        data = response.json()
        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pending request not found or permission denied."
            )
            
        return data[0]

    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Supabase error: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)
    

@router.post("/{chat_id}/messages", response_model=schemas.Message)
async def send_message(
    chat_id: uuid.UUID,
    message: schemas.MessageCreate,
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Sends a message to an accepted chat.
    """

    # --- [NEW] MiTM Capture for Chat Message ---
    # The content is already encrypted, which is exactly what we want to capture.
    try:
        listeners = get_listeners()
        if listeners:
            mitm_data = {
                "chat_id": str(chat_id),
                "sender_id": user_id,
                "encrypted_content": message.encrypted_content,
                "content_type": message.content_type
            }
            capture_packet(packet_type="chat_message", data=mitm_data, listeners=listeners)
    except Exception as e:
        print(f"MiTM Chat Message Capture Error: {e}") # Don't fail message send
    # --- End MiTM Capture ---
    
    new_message_data = {
        "chat_id": str(chat_id),
        "sender_id": user_id,
        "encrypted_content": message.encrypted_content,
        "content_type": message.content_type
    }

    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        headers = get_supabase_headers(token)

        response = supabase.postgrest.session.post(
            f"{supabase_url}/rest/v1/messages",
            headers=headers,
            data=json.dumps(new_message_data)
        )

        response.raise_for_status()
        
        data = response.json()
        if not data:
            raise HTTPException(status_code=500, detail="Could not send message.")
            
        return data[0]

    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Supabase error: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)


@router.get("/{chat_id}/messages", response_model=List[schemas.Message])
async def get_messages(
    chat_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Retrieves all messages from an accepted chat.
    """
    
    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        headers = {"Authorization": f"Bearer {token}"}
        
        params = {
            "chat_id": f"eq.{str(chat_id)}",
            "select": "*",
            "order": "created_at.asc" 
        }

        response = supabase.postgrest.session.get(
            f"{supabase_url}/rest/v1/messages",
            headers=headers,
            params=params
        )
        
        response.raise_for_status()
        
        return response.json()

    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Supabase error: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)
