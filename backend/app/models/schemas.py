# backend/app/models/schemas.py
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import uuid

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class User(BaseModel):
    id: uuid.UUID
    username: str
    
    class Config:
        from_attributes = True # Pydantic v2

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# backend/app/models/schemas.py

# ... (keep all your existing User/Token schemas) ...

# --- NEW SCHEMAS FOR CHAT REQUESTS ---

class ChatRequestCreate(BaseModel):
    receiver_id: uuid.UUID
    encryption_method: str
    encryption_params: dict  # This will be a JSON object, e.g., {"key": 5}

class ChatRequest(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID
    status: str
    encryption_method: str
    encryption_params: dict
    
    class Config:
        from_attributes = True # Pydantic v2

# backend/app/models/schemas.py

# ... (keep all your existing User/Token/ChatRequest/ChatRequestCreate schemas) ...

# --- NEW SCHEMAS FOR MANAGING CHAT REQUESTS ---

class ChatRequestDetails(BaseModel):
    """A schema that includes the sender's username for display."""
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_username: str  # We will add this manually
    status: str
    encryption_method: str
    encryption_params: dict
    
    class Config:
        from_attributes = True

class ChatRequestUpdate(BaseModel):
    """The simple payload for accepting or rejecting a request."""
    status: str  # Will be "accepted" or "rejected"

# backend/app/models/schemas.py

# ... (keep all your existing schemas) ...

# --- NEW SCHEMAS FOR MESSAGES ---

class MessageCreate(BaseModel):
    """The content a user sends."""
    encrypted_content: str
    content_type: str = "text" # e.g., "text", "steg_image_url"

class Message(BaseModel):
    """The full message object returned from the database."""
    id: int
    chat_id: uuid.UUID
    sender_id: uuid.UUID
    encrypted_content: str
    content_type: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# backend/app/models/schemas.py

# ... (keep all your existing schemas) ...

# --- NEW SCHEMAS FOR PASSWORDS & ATTACKS ---

class GeneratedPassword(BaseModel):
    password_type: int
    generated_password: str

class AttackRequest(BaseModel):
    target_username: str

class BruteForceRequest(AttackRequest):
    charset_type: str # 'type1', 'type2', 'type3', 'numeric', 'alpha'
    max_length: int = 8 # Default max length

class AttackResult(BaseModel):
    found: bool
    password: Optional[str] = None
    attempts: int
    time_taken: float
    message: Optional[str] = None

class MitmExplanation(BaseModel):
    attack_name: str
    description: str
    vulnerability: str
    solution: str
    demo: str

# backend/app/models/schemas.py

# ... (keep all your existing schemas) ...

# --- NEW SCHEMA FOR FILE UPLOADS ---

class FileUploadResponse(BaseModel):
    file_url: str

# backend/app/models/schemas.py

# ... (keep all your existing schemas) ...

# --- NEW SCHEMAS FOR VISUALIZATION ---

# backend/app/models/schemas.py

# ... (keep other schemas) ...

class VisualizeRequest(BaseModel):
    """The input for any visualization request."""
    text: str
    # Make all cipher-specific keys optional
    key: Optional[str] = None # For Playfair and Hill
    shift: Optional[int] = None # For Caesar
    size: Optional[int] = None # For Hill

# ... (keep other schemas) ...

class VisualizationStep(BaseModel):
    """A generic step in a visualization process."""
    step_title: str
    description: str
    data: dict # Flexible data for the frontend to render

class VisualizationResponse(BaseModel):
    """The full response containing all steps."""
    algorithm: str
    original_text: str
    final_text: str
    steps: list[VisualizationStep]

# ... (all your other schemas)

# --- NEW SCHEMAS FOR CRYPTO OPERATIONS ---

class CryptoRequest(BaseModel):
    text: str
    method: str  # 'caesar', 'playfair', 'hill'
    key: Optional[str] = None
    shift: Optional[int] = None
    size: Optional[int] = None

class CryptoResponse(BaseModel):
    result_text: str

