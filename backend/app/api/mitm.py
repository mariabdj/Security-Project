# backend/app/api/mitm.py
# This file is NEW. You must create it.
# It handles the "Start Attack" and "Stop Attack" buttons
# and adds the new /packets endpoint for polling.

from fastapi import APIRouter, Depends, HTTPException, Body
from ..core.supabase_client import supabase
from ..security.security import get_current_user_id, oauth2_scheme
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List
import os

router = APIRouter(
    prefix="/mitm",
    tags=["MiTM Attack"]
)

class MitmToggleRequest(BaseModel):
    attacker_username: str

@router.post("/start")
async def start_mitm_attack(
    request: MitmToggleRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Registers the current user as an active attacker in the 'mitm_listeners' table.
    """
    try:
        response = supabase.table("mitm_listeners").upsert(
            {"attacker_username": request.attacker_username, "status": "listening"},
            on_conflict="attacker_username" 
        ).execute()
        
        if response.data:
            return {"status": "success", "message": "MiTM attack listener started."}
        else:
            raise HTTPException(status_code=500, detail="Failed to start listener.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
async def stop_mitm_attack(
    request: MitmToggleRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    De-registers the current user as an attacker by deleting them from the table.
    """
    try:
        response = supabase.table("mitm_listeners").delete().eq(
            "attacker_username", request.attacker_username
        ).execute()
        
        return {"status": "success", "message": "MiTM attack listener stopped."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- [NEW] POLLING ENDPOINT ---
# This replaces the need for Supabase Realtime
@router.get("/packets")
async def get_mitm_packets(
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Fetches all intercepted packets for the current user and then
    deletes them to ensure they are only delivered once.
    This is used for polling instead of a realtime websocket.
    """
    try:
        # 1. Get the current user's username
        supabase_url = os.environ.get("SUPABASE_URL")
        token = creds.credentials
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        
        user_response = supabase.postgrest.session.get(
            f"{supabase_url}/rest/v1/users?id=eq.{user_id}&select=username",
            headers=headers
        )
        user_response.raise_for_status()
        user_data = user_response.json()
        
        if not user_data:
            raise HTTPException(status_code=404, detail="Attacker user not found.")
        
        attacker_username = user_data[0]['username']

        # 2. Fetch packets targeted at this attacker
        # We must use the service key for this, so we reset auth
        service_key = os.environ.get("SUPABASE_KEY")
        supabase.postgrest.auth(service_key)
        
        packets_response = supabase.table("intercepted_packets").select("*").eq(
            "target_attacker", attacker_username
        ).order("created_at", desc=True).execute()
        
        packets = packets_response.data
        if not packets:
            return [] # No packets found, return empty list

        # 3. Delete the packets we just fetched
        packet_ids = [p['id'] for p in packets]
        supabase.table("intercepted_packets").delete().in_("id", packet_ids).execute()

        # 4. Return the packets
        return packets

    except Exception as e:
        supabase.postgrest.auth(os.environ.get("SUPABASE_KEY")) # Reset auth on failure
        raise HTTPException(status_code=500, detail=f"Error fetching packets: {str(e)}")
    finally:
        # Always reset auth to service key for other operations
        supabase.postgrest.auth(os.environ.get("SUPABASE_KEY"))

