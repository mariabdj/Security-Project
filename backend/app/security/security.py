import os
import hashlib  # <-- IMPORTED
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from dotenv import load_dotenv

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..core.supabase_client import supabase

load_dotenv()

# --- [FIXED] Secure Password Hashing ---

def verify_password(password_from_client: str, stored_hash: str) -> bool:
    """
    Verifies a client-hashed password against a stored hash.
    - auth.js sends a SHA-256 hash.
    - The database stores a SHA-256 hash.
    - We just compare them.
    """
    return password_from_client == stored_hash

def get_password_hash(password: str) -> str:
    """
    Hashes a *plaintext* password for storage (e.g., during signup).
    Uses SHA-256.
    """
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

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

SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_KEY")

def get_current_user_id(creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)) -> str:
    """
    Dependency to get the current user's ID from their token.
    This also AUTHENTICATES the global supabase DATABASE client for the request.
    """
    token = creds.credentials
    
    original_auth = SUPABASE_SERVICE_KEY 
    
    try:
        supabase.postgrest.auth(token)
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise credentials_exception
            
        return user_id
        
    except JWTError:
        raise credentials_exception
    
    finally:
        supabase.postgrest.auth(original_auth)
