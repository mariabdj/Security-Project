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

# --- Password Generation Endpoint ---

@router.get("/generate-password", response_model=schemas.GeneratedPassword)
async def generate_new_password(password_type: int):
    """
    Generates a password based on the teacher's rules.
    - Type 1: 3 chars [2, 3, 4]
    - Type 2: 5 chars [0-9]
    - Type 3: 6 chars [a-z, A-Z, 0-9, +*@!#$%]
    """
    try:
        password = password_gen.generate_password(password_type)
        return {"password_type": password_type, "generated_password": password}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Attack Endpoints ---

@router.post("/attack/dictionary", response_model=schemas.AttackResult)
async def attack_dictionary(
    dictionary_file: UploadFile = File(...),
    target_username: str = Body(...),
    user_id: str = Depends(get_current_user_id) # Protected route
):
    """
    Performs a dictionary attack against a user.
    Requires a .txt dictionary file.
    """
    if dictionary_file.content_type != 'text/plain':
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .txt file.")
        
    try:
        # Read the file content
        content_bytes = await dictionary_file.read()
        content = content_bytes.decode('utf-8')
        
        # Run the attack logic
        result = dictionary.run_attack(target_username, content)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.post("/attack/bruteforce", response_model=schemas.AttackResult)
async def attack_brute_force(
    request: schemas.BruteForceRequest,
    user_id: str = Depends(get_current_user_id) # Protected route
):
    """
    Performs a brute-force attack against a user.
    - charset_type: 'type1', 'type2', 'type3', 'numeric', 'alpha'
    - max_length: Max length for 'numeric' or 'alpha' (e.g., 8)
    """
    try:
        result = brute_force.run_attack(
            request.target_username,
            request.charset_type,
            request.max_length
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

# --- MiTM Explanation Endpoint ---

@router.get("/attack/mitm", response_model=schemas.MitmExplanation)
async def explain_mitm():
    """
    Explains the Man-in-the-Middle (MiTM) attack.
    This attack is a network vulnerability, not a code exploit.
    """
    return {
        "attack_name": "Man-in-the-Middle (MiTM)",
        "description": "A MiTM attack is when an attacker secretly positions themselves between a user and a server (like this one). The attacker can intercept, read, and even modify all communication between the two.",
        "vulnerability": "This API is currently running on HTTP, which is unencrypted plain text. A MiTM attacker on the same Wi-Fi network could easily see the passwords and tokens being sent.",
        "solution": "The one and only solution is **HTTPS (SSL/TLS)**. HTTPS encrypts all traffic between the user's browser and the server. Even if an attacker intercepts the data, it's just meaningless encrypted text to them.",
        "demo": "To demonstrate, an attacker would use a tool like Wireshark on the same network to 'sniff' the packets. They would see the 'Authorization: Bearer <token...>' and password JSON in plain text. Deploying this site with an SSL certificate (like from Let's Encrypt) would fix this vulnerability."
    }