# backend/app/api/chats.py

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
import uuid
import os
import json
from ..core.supabase_client import supabase
from ..security.security import get_current_user_id, oauth2_scheme # Import new deps
from ..models import schemas
from typing import List

router = APIRouter(
    prefix="/chats",
    tags=["Chats"]
)

# --- HELPER FUNCTION ---

def get_supabase_headers(token: str, content_type: str = "application/json"):
    """Creates the standard headers for an authenticated Supabase request."""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": content_type,
        "Prefer": "return=representation" # Asks Supabase to return the inserted/updated row
    }

def get_supabase_url():
    """Gets the Supabase URL from environment variables."""
    url = os.environ.get("SUPABASE_URL")
    if not url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")
    return url

# --- END HELPER ---


@router.post("/request", response_model=schemas.ChatRequest)
async def create_chat_request(
    request_data: schemas.ChatRequestCreate,
    sender_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme) # [FIX] Get auth token
):
    """
    Sends a chat request to another user.
    - Must be logged in.
    - The sender_id is taken from the user's token.
    """
    
    sender_uuid = uuid.UUID(sender_id)
    
    # 1. Check if user is trying to chat with themselves
    if sender_uuid == request_data.receiver_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a chat request to yourself."
        )

    # 2. Prepare the new request for the database
    new_request_data = {
        "sender_id": sender_id,
        "receiver_id": str(request_data.receiver_id),
        "encryption_method": request_data.encryption_method,
        "encryption_params": request_data.encryption_params,
        "status": "pending"
    }

    # 3. Insert the new chat request using manual HTTP request
    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        headers = get_supabase_headers(token)
        
        # [FIX] Manually call the Supabase REST API with the user's token
        response = supabase.postgrest.session.post(
            f"{supabase_url}/rest/v1/chat_requests",
            headers=headers,
            data=json.dumps(new_request_data)
        )
        
        # Raise an exception if the request failed (e.g., 4xx or 5xx)
        response.raise_for_status() 
            
        return response.json()[0] # Return the new row

    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Error from Supabase: {e.response.text}"
             
             # Check for the unique constraint violation
             if "unique_chat_request" in e.response.text:
                 raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A chat request to this user already exists."
                 )
        
        raise HTTPException(status_code=500, detail=error_detail)
    

@router.get("/requests", response_model=List[schemas.ChatRequestDetails])
async def get_chat_requests(
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme) # [FIX] Get auth token
):
    """
    Gets all chat requests for the logged-in user (both sent and received).
    We will join with the 'users' table to get the usernames.
    """
    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        # [FIX] We only need Auth, no Content-Type for GET
        headers = {"Authorization": f"Bearer {token}"} 
        
        # Define the query params
        params = {
            "select": "*,sender:users!sender_id(username),receiver:users!receiver_id(username)",
            "or": f"(sender_id.eq.{user_id},receiver_id.eq.{user_id})"
        }
        
        # [FIX] Manually call the Supabase REST API with the user's token
        response = supabase.postgrest.session.get(
            f"{supabase_url}/rest/v1/chat_requests",
            headers=headers,
            params=params
        )
        
        response.raise_for_status()
        
        data = response.json()
        if not data:
            return []

        # Re-format the data to match our ChatRequestDetails schema
        formatted_data = []
        for item in response.json():
            # [FIX] Need to handle joins that might be null
            sender_username = item.get('sender', {}).get('username', 'Unknown')
            receiver_username = item.get('receiver', {}).get('username', 'Unknown')

            details = schemas.ChatRequestDetails(
                id=item['id'],
                sender_id=item['sender_id'],
                receiver_id=item['receiver_id'], # Add receiver_id to schema
                sender_username=sender_username,
                receiver_username=receiver_username, # Add receiver_username to schema
                status=item['status'],
                encryption_method=item['encryption_method'],
                encryption_params=item['encryption_params']
            )
            formatted_data.append(details)
            
        return formatted_data

    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Error from Supabase: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)


@router.put("/requests/{request_id}", response_model=schemas.ChatRequest)
async def respond_to_chat_request(
    request_id: uuid.UUID,
    response_data: schemas.ChatRequestUpdate,
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme) # [FIX] Get auth token
):
    """
    Allows a user to accept or reject a pending chat request.
    A user can only respond to requests sent TO them.
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
        
        # [FIX] We use PATCH to update, not PUT
        # We also filter on receiver_id and status in the query params
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
                detail="Pending request not found or you do not have permission to modify it."
            )
            
        return data[0]

    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Error from Supabase: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)
    

@router.post("/{chat_id}/messages", response_model=schemas.Message)
async def send_message(
    chat_id: uuid.UUID,
    message: schemas.MessageCreate,
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme) # [FIX] Get auth token
):
    """
    Sends a message to an accepted chat.
    The user must be the sender.
    """
    
    # 1. Prepare the new message data
    new_message_data = {
        "chat_id": str(chat_id),
        "sender_id": user_id,
        "encrypted_content": message.encrypted_content,
        "content_type": message.content_type
    }

    # 2. Insert the message
    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        headers = get_supabase_headers(token)

        # [FIX] Manually call the Supabase REST API with the user's token
        response = supabase.postgrest.session.post(
            f"{supabase_url}/rest/v1/messages",
            headers=headers,
            data=json.dumps(new_message_data)
        )

        response.raise_for_status()
        
        data = response.json()
        if not data:
            raise HTTPException(status_code=500, detail="Could not send message. You may not have permission or the chat is not accepted.")
            
        return data[0]

    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Error from Supabase: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)


@router.get("/{chat_id}/messages", response_model=List[schemas.Message])
async def get_messages(
    chat_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme) # [FIX] Get auth token
):
    """
    Gets all messages from an accepted chat.
    The user must be a participant (sender or receiver) in the chat.
    """
    
    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        headers = {"Authorization": f"Bearer {token}"}
        
        params = {
            "chat_id": f"eq.{str(chat_id)}",
            "select": "*",
            "order": "created_at.asc" # [FIX] Changed to ascending
        }

        # [FIX] Manually call the Supabase REST API with the user's token
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
             error_detail = f"Error from Supabase: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)