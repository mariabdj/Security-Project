# backend/app/api/users.py

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials
import os
from typing import List
from ..core.supabase_client import supabase
from ..security.security import get_current_user_id, oauth2_scheme # Import new deps
from ..models import schemas

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

# --- HELPER FUNCTION ---
def get_supabase_url():
    """Gets the Supabase URL from environment variables."""
    url = os.environ.get("SUPABASE_URL")
    if not url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")
    return url
# --- END HELPER ---


@router.get("/search", response_model=List[schemas.User])
async def search_users(
    query: str = Query(..., min_length=1, description="Search term for username"),
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme) # [FIX] Get auth token
):
    """
    Searches for users by username.
    - Must be logged in to use.
    - Excludes the user who is performing the search.
    - Performs a case-insensitive "contains" search.
    """
    try:
        supabase_url = get_supabase_url()
        token = creds.credentials
        headers = {"Authorization": f"Bearer {token}"}
        
        # [FIX] Build query parameters
        params = {
            "select": "id,username",
            "id": f"neq.{user_id}", # Don't include the logged-in user
            "username": f"ilike.%{query}%", # Case-insensitive "contains"
            "limit": "10"
        }

        # [FIX] Manually call the Supabase REST API with the user's token
        response = supabase.postgrest.session.get(
            f"{supabase_url}/rest/v1/users",
            headers=headers,
            params=params
        )

        response.raise_for_status()
        
        data = response.json()
        if not data:
            return []
            
        return data
        
    except Exception as e:
        error_detail = f"An error occurred: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Error from Supabase: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)