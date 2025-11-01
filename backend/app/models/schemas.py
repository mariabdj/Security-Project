# backend/app/models/schemas.py
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List # Assurez-vous que List est importé
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
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- Schémas Chat (Inchangés) ---

class ChatRequestCreate(BaseModel):
    receiver_id: uuid.UUID
    encryption_method: str
    encryption_params: dict

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
    receiver_id: uuid.UUID
    sender_username: str
    receiver_username: str
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

# --- [CORRIGÉ] Schémas Mots de Passe & Attaques ---

class GeneratedPassword(BaseModel):
    password_type: int
    generated_password: str

class AttackRequest(BaseModel):
    target_username: str

class BruteForceRequest(AttackRequest):
    charset_type: str # 'type1', 'type2', 'type3'
    # max_length a été supprimé

class AttackResult(BaseModel):
    found: bool
    password: Optional[str] = None # Ce champ est la "sortie"
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

# --- Schémas Crypto & Visualisation (Inchangés) ---

class VisualizeRequest(BaseModel):
    text: str
    key: Optional[str] = None
    shift: Optional[int] = None
    size: Optional[int] = None 

class VisualizationStep(BaseModel):
    step_title: str
    description: str
    data: dict

class VisualizationResponse(BaseModel):
    algorithm: str
    original_text: str
    final_text: str
    steps: List[VisualizationStep] # Utiliser List importé

class CryptoRequest(BaseModel):
    text: str
    method: str
    key: Optional[str] = None
    shift: Optional[int] = None
    size: Optional[int] = None

class CryptoResponse(BaseModel):
    result_text: str

