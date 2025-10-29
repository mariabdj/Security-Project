# backend/app/security/crypto_algorithms/caesar.py

def encrypt(plain_text: str, shift: int) -> str:
    """
    Encrypts text using a Caesar cipher.
    Handles 'shift Right-Left/ Left-Right by n rank' by accepting
    a positive 'shift' (right) or negative 'shift' (left).
    """
    if not isinstance(shift, int):
        raise ValueError("Shift key must be an integer.")

    encrypted_text = ""
    for char in plain_text:
        if 'a' <= char <= 'z':
            # Handle lowercase letters
            new_ord = ord(char) + (shift % 26)
            if new_ord > ord('z'):
                new_ord -= 26
            elif new_ord < ord('a'):
                new_ord += 26
            encrypted_text += chr(new_ord)
        elif 'A' <= char <= 'Z':
            # Handle uppercase letters
            new_ord = ord(char) + (shift % 26)
            if new_ord > ord('Z'):
                new_ord -= 26
            elif new_ord < ord('A'):
                new_ord += 26
            encrypted_text += chr(new_ord)
        else:
            # Non-alphabetic characters are not changed
            encrypted_text += char
            
    return encrypted_text

def decrypt(cipher_text: str, shift: int) -> str:
    """
    Decrypts text from a Caesar cipher.
    This is just encryption with the opposite shift.
    """
    return encrypt(cipher_text, -shift)

# --- Handling Security Flaws ---

def get_flaws() -> dict:
    """
    Returns the flaws of the Caesar cipher and their solutions.
    """
    return {
        "flaw": "Brute-Force Attack",
        "description": "The cipher only has 25 possible keys (shifts 1-25). An attacker can simply try all 25 decryptions and see which one produces readable text.",
        "solution": "The Caesar cipher is fundamentally insecure for modern use. Its only solution is to use a stronger algorithm, like a polyalphabetic cipher (e.g., Vigenere) or a modern standard (e.g., AES). For this project, we acknowledge it is a 'toy' cipher."
    }

def brute_force_attack(cipher_text: str) -> list:
    """
    Performs a brute-force attack on a Caesar cipher text.
    Returns all 25 possible decryptions.
    """
    possible_decryptions = []
    for shift in range(1, 26):
        possible_decryptions.append({
            "shift_key_used": shift,
            "decrypted_text": decrypt(cipher_text, shift)
        })
    return possible_decryptions