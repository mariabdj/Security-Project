# backend/app/api/attacks.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Body
from typing import Optional
from ..security.security import get_current_user_id
from ..security import password_gen
from ..security.attack_tools import dictionary, brute_force
from ..models import schemas

router = APIRouter(
    prefix="/passwords-and-attacks",
    tags=["Passwords & Attacks"]
)

# --- Endpoint de Génération de Mot de Passe (Inchangé) ---

@router.get("/generate-password", response_model=schemas.GeneratedPassword)
async def generate_new_password(password_type: int):
    """
    Génère un mot de passe basé sur les règles du professeur.
    - Type 1: 3 car. [2, 3, 4]
    - Type 2: 5 car. [0-9]
    - Type 3: 6 car. [a-z, A-Z, 0-9, +*@!#$%]
    """
    try:
        password = password_gen.generate_password(password_type)
        return {"password_type": password_type, "generated_password": password}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Endpoint d'Attaque par Dictionnaire (Inchangé) ---

@router.post("/attack/dictionary", response_model=schemas.AttackResult)
async def attack_dictionary(
    dictionary_file: UploadFile = File(...),
    target_username: str = Body(...),
    user_id: str = Depends(get_current_user_id)
):
    """
    Exécute une attaque par dictionnaire contre un utilisateur.
    Nécessite un fichier dictionnaire .txt.
    """
    if dictionary_file.content_type != 'text/plain':
        raise HTTPException(status_code=400, detail="Type de fichier invalide. Veuillez uploader un .txt.")
        
    try:
        content_bytes = await dictionary_file.read()
        # Décode le contenu en utf-8, en ignorant les erreurs
        content = content_bytes.decode('utf-8', errors='ignore') 
        
        result = dictionary.run_attack(target_username, content)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Une erreur est survenue: {str(e)}")


# --- [CORRIGÉ] Endpoint d'Attaque Brute Force ---

@router.post("/attack/bruteforce", response_model=schemas.AttackResult)
async def attack_brute_force(
    # [FIX] Utilise le nouveau schéma BruteForceRequest (sans max_length)
    request: schemas.BruteForceRequest, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Exécute une attaque brute force contre un utilisateur.
    - charset_type: 'type1', 'type2', ou 'type3'
    """
    try:
        # [FIX] Appel de la nouvelle fonction 'run_attack'
        # Le 'max_length=0' est un placeholder, il sera ignoré
        result = brute_force.run_attack(
            request.target_username,
            request.charset_type,
            0 # 'max_length' n'est plus utilisé par la nouvelle logique
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Une erreur est survenue: {str(e)}")

# --- Endpoint MiTM (Inchangé) ---

@router.get("/attack/mitm", response_model=schemas.MitmExplanation)
async def explain_mitm():
    """
    Explique l'attaque Man-in-the-Middle (MiTM).
    """
    return {
        "attack_name": "Man-in-the-Middle (MiTM)",
        "description": "Une attaque MiTM se produit lorsqu'un attaquant se positionne secrètement entre un utilisateur et un serveur. L'attaquant peut intercepter, lire et même modifier toute la communication.",
        "vulnerability": "Cette API fonctionne actuellement en HTTP, qui n'est pas chiffré. Un attaquant sur le même réseau Wi-Fi pourrait facilement voir les mots de passe et les tokens envoyés.",
        "solution": "La seule solution est **HTTPS (SSL/TLS)**. HTTPS chiffre tout le trafic. Même si un attaquant intercepte les données, elles sont illisibles.",
        "demo": "Pour démontrer, un attaquant utiliserait un outil comme Wireshark sur le même réseau pour 'sniffer' les paquets. Il verrait 'Authorization: Bearer <token...>' et le JSON du mot de passe en clair."
    }

