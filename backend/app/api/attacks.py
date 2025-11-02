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
    Generates a password based on the professor's 3 rules.
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
    Executes a dictionary attack against a user.
    Requires a .txt dictionary file.
    """
    if dictionary_file.content_type != 'text/plain':
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .txt.") # <-- [FIXED] Translated
        
    try:
        content_bytes = await dictionary_file.read()
        # Décode le contenu en utf-8, en ignorant les erreurs
        content = content_bytes.decode('utf-8', errors='ignore') 
        
        result = dictionary.run_attack(target_username, content)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}") # <-- [FIXED] Translated


# --- [CORRIGÉ] Endpoint d'Attaque Brute Force ---

@router.post("/attack/bruteforce", response_model=schemas.AttackResult)
async def attack_brute_force(
    # [FIX] Utilise le nouveau schéma BruteForceRequest (sans max_length)
    request: schemas.BruteForceRequest, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Executes a brute force attack against a user.
    - charset_type: 'type1', 'type2', or 'type3'
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
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}") # <-- [FIXED] Translated

# --- Endpoint MiTM (Inchangé) ---

@router.get("/attack/mitm", response_model=schemas.MitmExplanation)
async def explain_mitm():
    """
    Explains the Man-in-the-Middle (MiTM) attack.
    """
    return {
        "attack_name": "Man-in-the-Middle (MiTM)",
        "description": "A MiTM attack occurs when an attacker secretly positions themselves between a user and a server. The attacker can intercept, read, and even modify all communication.",
        "vulnerability": "This API currently operates over HTTP, which is unencrypted. An attacker on the same Wi-Fi network could easily see passwords and tokens being sent.",
        "solution": "The only solution is **HTTPS (SSL/TLS)**. HTTPS encrypts all traffic. Even if an attacker intercepts the data, it is unreadable.",
        "demo": "To demonstrate, an attacker would use a tool like Wireshark on the same network to 'sniff' packets. They would see 'Authorization: Bearer <token...>' and the password JSON in plaintext."
    }