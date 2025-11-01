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

router = APIRouter(
    prefix="/chats",
    tags=["Chats"]
)

# --- Fonctions d'aide (Inchangées) ---

def get_supabase_headers(token: str, content_type: str = "application/json"):
    """Crée les en-têtes standard pour une requête Supabase authentifiée."""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": content_type,
        "Prefer": "return=representation" 
    }

def get_supabase_url():
    """Récupère l'URL Supabase depuis les variables d'environnement."""
    url = os.environ.get("SUPABASE_URL")
    if not url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL non configuré")
    return url

# --- [MODIFIÉ] Endpoint de Création de Demande ---

@router.post("/request", response_model=schemas.ChatRequest)
async def create_chat_request(
    request_data: schemas.ChatRequestCreate,
    sender_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Envoie une demande de chat à un autre utilisateur.
    """
    
    sender_uuid = uuid.UUID(sender_id)
    
    # 1. Vérifier si l'utilisateur essaie de chatter avec lui-même
    if sender_uuid == request_data.receiver_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas vous envoyer une demande de chat."
        )

    # 2. [MODIFIÉ] Valider les 'encryption_params' en fonction de la méthode
    params = request_data.encryption_params
    method = request_data.encryption_method

    try:
        if method == "caesar":
            if "shift" not in params or not isinstance(params["shift"], int):
                raise ValueError("Le paramètre 'shift' (entier) est requis pour César.")
        elif method == "playfair":
            if "key" not in params or not isinstance(params["key"], str):
                raise ValueError("Le paramètre 'key' (chaîne) est requis pour Playfair.")
            if "size" not in params or not isinstance(params["size"], int):
                raise ValueError("Le paramètre 'size' (entier) est requis for Playfair.")
            if params["size"] not in [5, 6]:
                raise ValueError("La taille pour Playfair doit être 5 ou 6.")
        elif method == "hill":
            if "key" not in params or not isinstance(params["key"], str):
                raise ValueError("Le paramètre 'key' (chaîne) est requis pour Hill.")
            if "size" not in params or not isinstance(params["size"], int):
                raise ValueError("Le paramètre 'size' (entier) est requis pour Hill.")
            if params["size"] not in [2, 3]:
                raise ValueError("La taille pour Hill doit être 2 ou 3.")
        else:
            raise ValueError(f"Méthode de chiffrement '{method}' non supportée.")
            
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Paramètres d'encryption invalides: {e}")


    # 3. Préparer la nouvelle demande pour la base de données
    new_request_data = {
        "sender_id": sender_id,
        "receiver_id": str(request_data.receiver_id),
        "encryption_method": method,
        "encryption_params": params, # 'params' a été validé
        "status": "pending"
    }

    # 4. Insérer la nouvelle demande de chat
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
        error_detail = f"Une erreur est survenue: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Erreur de Supabase: {e.response.text}"
             if "unique_chat_request" in e.response.text:
                 raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Une demande de chat à cet utilisateur existe déjà."
                 )
        
        raise HTTPException(status_code=500, detail=error_detail)
    

# --- Autres Endpoints (Inchangés) ---

@router.get("/requests", response_model=List[schemas.ChatRequestDetails])
async def get_chat_requests(
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Récupère toutes les demandes de chat pour l'utilisateur connecté.
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

        # Reformater les données pour correspondre au schéma ChatRequestDetails
        formatted_data = []
        for item in response.json():
            sender_username = item.get('sender', {}).get('username', 'Inconnu')
            receiver_username = item.get('receiver', {}).get('username', 'Inconnu')

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
        error_detail = f"Une erreur est survenue: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Erreur de Supabase: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)


@router.put("/requests/{request_id}", response_model=schemas.ChatRequest)
async def respond_to_chat_request(
    request_id: uuid.UUID,
    response_data: schemas.ChatRequestUpdate,
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Permet à un utilisateur d'accepter ou de rejeter une demande de chat.
    """
    
    new_status = response_data.status
    if new_status not in ["accepted", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le statut doit être 'accepted' ou 'rejected'"
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
                detail="Demande en attente non trouvée ou permission refusée."
            )
            
        return data[0]

    except Exception as e:
        error_detail = f"Une erreur est survenue: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Erreur de Supabase: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)
    

@router.post("/{chat_id}/messages", response_model=schemas.Message)
async def send_message(
    chat_id: uuid.UUID,
    message: schemas.MessageCreate,
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Envoie un message à un chat accepté.
    """
    
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
            raise HTTPException(status_code=500, detail="Impossible d'envoyer le message.")
            
        return data[0]

    except Exception as e:
        error_detail = f"Une erreur est survenue: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Erreur de Supabase: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)


@router.get("/{chat_id}/messages", response_model=List[schemas.Message])
async def get_messages(
    chat_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    """
    Récupère tous les messages d'un chat accepté.
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
        error_detail = f"Une erreur est survenue: {str(e)}"
        if hasattr(e, 'response'):
             error_detail = f"Erreur de Supabase: {e.response.text}"
        raise HTTPException(status_code=500, detail=error_detail)