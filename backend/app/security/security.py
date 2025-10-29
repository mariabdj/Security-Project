import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from dotenv import load_dotenv

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..core.supabase_client import supabase

load_dotenv()

# --- DANGER: Plain-text password handling ---
def verify_password(plain_password: str, stored_password: str) -> bool:
    return plain_password == stored_password

def get_password_hash(password: str) -> str:
    return password

# --- JWT (Token) Creation ---
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise ValueError("No JWT_SECRET_KEY set in .env file")
    
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    if 'id' in to_encode:
        to_encode['sub'] = str(to_encode['id'])
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- DEPENDENCY FOR PROTECTED ROUTES ---
oauth2_scheme = HTTPBearer()

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

# [FIX] Get the service key from the environment to reset the client
# This assumes your .env file has SUPABASE_KEY as the service_role key
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_KEY")

def get_current_user_id(creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)) -> str:
    """
    Dependency to get the current user's ID from their token.
    This also AUTHENTICATES the global supabase DATABASE client for the request.
    
    [FIXED] This function now uses a try...finally block to ensure
    the supabase client auth is ALWAYS reset back to the service key,
    even if the user's token is expired or invalid.
    """
    token = creds.credentials
    
    # We must store the original auth to reset it
    # The default auth is the service role key
    original_auth = SUPABASE_SERVICE_KEY 
    
    try:
        # 1. Arm the DATABASE client with the user's token
        # This is necessary for RLS policies in the database
        supabase.postgrest.auth(token)

        # 2. Decode the token to get the user ID and validate it
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise credentials_exception
            
        return user_id
        
    except JWTError:
        # This triggers if the token is expired, invalid, etc.
        raise credentials_exception
    
    finally:
        # [THE FIX] This block runs NO MATTER WHAT.
        # It resets the global supabase client back to using the
        # powerful service key, so public endpoints (like /login)
        # don't fail.
        supabase.postgrest.auth(original_auth)