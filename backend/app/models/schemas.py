# backend/app/models/schemas.py
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import uuid

# --- Schémas Utilisateur & Auth (Inchangés) ---

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

# --- Schémas Chat (Inchangés) ---
# La structure 'encryption_params: dict' est déjà flexible
# et gérera l'ajout de "size" pour Playfair sans modification.

class ChatRequestCreate(BaseModel):
    receiver_id: uuid.UUID
    encryption_method: str
    encryption_params: dict  # e.g., {"shift": 5} or {"key": "KEY", "size": 5}

class ChatRequest(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID
    status: str
    encryption_method: str
    encryption_params: dict
    
    class Config:
        from_attributes = True

class ChatRequestDetails(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID # [FIX de votre original]
    sender_username: str
    receiver_username: str # [FIX de votre original]
    status: str
    encryption_method: str
    encryption_params: dict
    
    class Config:
        from_attributes = True

class ChatRequestUpdate(BaseModel):
    status: str

# --- Schémas Messages (Inchangés) ---

class MessageCreate(BaseModel):
    encrypted_content: str
    content_type: str = "text" 

class Message(BaseModel):
    id: int
    chat_id: uuid.UUID
    sender_id: uuid.UUID
    encrypted_content: str
    content_type: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# --- Schémas Attaques (Inchangés) ---

class GeneratedPassword(BaseModel):
    password_type: int
    generated_password: str

class AttackRequest(BaseModel):
    target_username: str

class BruteForceRequest(AttackRequest):
    charset_type: str 
    max_length: int = 8 

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

# --- Schémas Stockage (Inchangés) ---

class FileUploadResponse(BaseModel):
    file_url: str

# --- [MODIFIÉ] Schémas Crypto & Visualisation ---

class VisualizeRequest(BaseModel):
    """L'entrée pour une demande de visualisation."""
    text: str
    key: Optional[str] = None     # Pour Playfair et Hill
    shift: Optional[int] = None   # Pour Caesar
    size: Optional[int] = None    # [MODIFIÉ] Pour Playfair (5 ou 6) et Hill (2 ou 3)

class VisualizationStep(BaseModel):
    """Une étape générique dans un processus de visualisation."""
    step_title: str
    description: str
    data: dict 

class VisualizationResponse(BaseModel):
    """La réponse complète contenant toutes les étapes."""
    algorithm: str
    original_text: str
    final_text: str
    steps: list[VisualizationStep]

class CryptoRequest(BaseModel):
    """L'entrée pour une opération crypto simple."""
    text: str
    method: str  # 'caesar', 'playfair', 'hill'
    key: Optional[str] = None
    shift: Optional[int] = None
    size: Optional[int] = None    # [MODIFIÉ] Pour Playfair (5 ou 6) et Hill (2 ou 3)

class CryptoResponse(BaseModel):
    result_text: str