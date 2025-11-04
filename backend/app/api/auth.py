# backend/app/api/auth.py
from fastapi import APIRouter, HTTPException, status
from ..models import schemas
from ..core.supabase_client import supabase
from ..security.security import get_password_hash, verify_password, create_access_token
import os
import httpx
from datetime import datetime, timedelta, timezone

# --- [NEW] MiTM Imports ---
from ..security.mitm_tools import get_listeners, capture_packet, hash_data
# --- End MiTM Imports ---

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

RECAPTCHA_SECRET_KEY = os.environ.get("RECAPTCHA_SECRET_KEY")
CAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"

async def verify_captcha(token: str) -> bool:
    """Helper function to verify a reCAPTCHA token."""
    if not RECAPTCHA_SECRET_KEY:
        print("Warning: RECAPTCHA_SECRET_KEY is not set. Skipping CAPTCHA verification.")
        return True 
        
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                CAPTCHA_VERIFY_URL,
                data={"secret": RECAPTCHA_SECRET_KEY, "response": token}
            )
            response.raise_for_status()
            return response.json().get("success", False)
        except Exception as e:
            print(f"CAPTCHA verification HTTP request failed: {e}")
            return False

@router.post("/signup", response_model=schemas.User)
async def signup(user: schemas.UserCreate):
    
    # --- [NEW] MiTM Capture for Signup ---
    # We capture the *plaintext* password here as it's what's sent over the network
    # But we hash it for the demo, as requested by the user.
    try:
        listeners = get_listeners()
        if listeners:
            hashed_pass_for_mitm = hash_data(user.password) # Hash plaintext for demo
            mitm_data = {"username": user.username, "password_hash_capture": hashed_pass_for_mitm}
            capture_packet(packet_type="signup", data=mitm_data, listeners=listeners)
    except Exception as e:
        print(f"MiTM Signup Capture Error: {e}") # Don't fail signup if MiTM fails
    # --- End MiTM Capture ---

    # 1. Check if username already exists
    response = supabase.table("users").select("id").eq("username", user.username).execute()
    if response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # 2. Hash the password (using the *fixed* security function)
    hashed_password = get_password_hash(user.password)

    # 3. Insert the new user into the public.users table
    new_user_data = {
        "username": user.username,
        "password_hash": hashed_password, # Store the secure hash
        "failed_login_attempts": 0,
        "lockout_until": None
    }
    
    try:
        insert_response = supabase.table("users").insert(new_user_data).execute()
        if not insert_response.data:
            raise HTTPException(status_code=500, detail="Could not create user.")
            
        created_user = insert_response.data[0]
        return schemas.User(id=created_user['id'], username=created_user['username'])

    except Exception as e:
        if "username_length_check" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be at least 3 characters long.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )


@router.post("/login", response_model=schemas.Token)
async def login(form_data: schemas.UserLogin):
    
    # --- [NEW] MiTM Capture for Login ---
    # form_data.password is *already hashed* by the client (as per auth.js)
    # This is perfect for the demo.
    try:
        listeners = get_listeners()
        if listeners:
            mitm_data = {"username": form_data.username, "password_hash_capture": form_data.password}
            capture_packet(packet_type="login", data=mitm_data, listeners=listeners)
    except Exception as e:
        print(f"MiTM Login Capture Error: {e}") # Don't fail login if MiTM fails
    # --- End MiTM Capture ---

    # --- Part 1: CAPTCHA Verification ---
    if not form_data.captcha_token:
        raise HTTPException(status_code=400, detail="CAPTCHA token is required.")
        
    is_captcha_valid = await verify_captcha(form_data.captcha_token)
    if not is_captcha_valid:
        raise HTTPException(status_code=400, detail="CAPTCHA verification failed. Please try again.")
    
    # --- Part 2: Rate Limiting and Login Logic ---
    
    # 1. Find the user
    try:
        response = supabase.table("users").select(
            "id, username, password_hash, failed_login_attempts, lockout_until"
        ).eq("username", form_data.username).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    
    if not response.data:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
    
    user_data = response.data[0]
    now = datetime.now(timezone.utc)

    # 2. Check for existing lockout
    if user_data.get("lockout_until"):
        try:
            lockout_time = datetime.fromisoformat(user_data["lockout_until"])
        except ValueError:
            lockout_time = now - timedelta(seconds=1)

        if lockout_time > now:
            wait_seconds = (lockout_time - now).total_seconds()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed attempts. Please wait {int(wait_seconds)} seconds."
            )

    # 3. Verify the password (using the *fixed* security function)
    # form_data.password is the hash from the client
    # user_data["password_hash"] is the hash from the DB
    is_password_correct = verify_password(form_data.password, user_data["password_hash"])
    
    if not is_password_correct:
        # --- Password is WRONG: Apply lockout ---
        
        current_attempts = user_data.get("failed_login_attempts", 0) + 1
        lockout_duration_seconds = 0
        
        if current_attempts == 1:
            lockout_duration_seconds = 30
        elif current_attempts == 2:
            lockout_duration_seconds = 60
        else:
            lockout_duration_seconds = 300
            
        new_lockout_until = now + timedelta(seconds=lockout_duration_seconds)
        
        try:
            supabase.table("users").update({
                "failed_login_attempts": current_attempts,
                "lockout_until": new_lockout_until.isoformat()
            }).eq("id", user_data["id"]).execute()
        except Exception as e:
            print(f"Failed to update lockout: {e}")

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Incorrect username or password. Please wait {lockout_duration_seconds} seconds."
        )

    # 4. Password is CORRECT: Reset attempts and create token
    try:
        if user_data.get("failed_login_attempts", 0) > 0 or user_data.get("lockout_until") is not None:
            supabase.table("users").update({
                "failed_login_attempts": 0,
                "lockout_until": None
            }).eq("id", user_data["id"]).execute()
    except Exception as e:
        print(f"Failed to reset lockout on success: {e}")

    token_data = {"id": str(user_data["id"]), "username": user_data["username"]}
    access_token = create_access_token(data=token_data)

    return {"access_token": access_token, "token_type": "bearer"}
