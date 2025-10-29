# backend/app/security/crypto_algorithms/hill.py
import numpy as np
from typing import Optional

# --- Helper Functions ---

def char_to_num(char: str) -> int:
    """Converts a character (A-Z) to a number (0-25)."""
    return ord(char.upper()) - ord('A')

def num_to_char(num: int) -> str:
    """Converts a number (0-25) to a character (A-Z)."""
    return chr((num % 26) + ord('A'))

def mod_inv(a: int, m: int) -> Optional[int]:
    """Finds the modular multiplicative inverse of a mod m."""
    a = a % m
    for x in range(1, m):
        if (a * x) % m == 1:
            return x
    return None # No inverse exists

def create_key_matrix_from_string(key: str, size: int) -> Optional[np.ndarray]:
    """
    Converts a key string (like "GYBN") and a size (like 2)
    into a NumPy matrix (e.g., [[6, 24], [1, 13]]).
    """
    if not key.isalpha() or len(key) != size * size:
        raise ValueError(f"Key must be {size*size} alphabetic characters.")
        
    nums = [char_to_num(char) for char in key]
    matrix = np.array(nums).reshape(size, size)
    return matrix

def prepare_text(text: str, size: int) -> str:
    """Prepares text by removing non-alpha, uppercasing, and padding."""
    clean_text = "".join(filter(str.isalpha, text)).upper()
    
    # Pad with 'X' if length is not a multiple of size
    remainder = len(clean_text) % size
    if remainder != 0:
        clean_text += "X" * (size - remainder)
        
    return clean_text

def get_decryption_matrix(key_matrix: np.ndarray) -> np.ndarray:
    """Calculates the modular inverse of the key matrix."""
    size = key_matrix.shape[0]
    
    # 1. Calculate determinant
    det = int(round(np.linalg.det(key_matrix)))
    det_mod26 = det % 26
    
    # 2. Find modular inverse of determinant
    det_inv = mod_inv(det_mod26, 26)
    
    if det_inv is None:
        raise ValueError("Key matrix is not invertible (mod 26). GCD(det, 26) != 1.")
        
    # 3. Calculate inverse matrix
    inv_matrix = np.linalg.inv(key_matrix)
    
    # 4. Calculate adjugate * determinant
    adjugate_det = inv_matrix * det
    
    # 5. Multiply by modular inverse of determinant and take mod 26
    decryption_matrix = (adjugate_det * det_inv) % 26
    
    # Round to nearest integer and convert to int type
    return np.round(decryption_matrix).astype(int)


# --- Core Functions ---

def encrypt(plain_text: str, key: str, size: int) -> str:
    """Encrypts text using the Hill cipher."""
    try:
        key_matrix = create_key_matrix_from_string(key, size)
        # Check for invertibility before encrypting
        get_decryption_matrix(key_matrix)
    except ValueError as e:
        raise ValueError(f"Invalid Key: {e}")
        
    text = prepare_text(plain_text, size)
    cipher_text = ""
    
    for i in range(0, len(text), size):
        # Get a block of text
        block = text[i:i+size]
        # Convert to vector (column matrix)
        vector = np.array([char_to_num(char) for char in block]).reshape(size, 1)
        
        # Matrix multiplication
        encrypted_vector = np.dot(key_matrix, vector)
        
        # Take mod 26
        encrypted_vector_mod26 = encrypted_vector % 26
        
        # Convert back to chars
        for num in encrypted_vector_mod26.flatten():
            cipher_text += num_to_char(num)
            
    return cipher_text

def decrypt(cipher_text: str, key: str, size: int) -> str:
    """Decrypts text from the Hill cipher."""
    try:
        key_matrix = create_key_matrix_from_string(key, size)
        decryption_matrix = get_decryption_matrix(key_matrix)
    except ValueError as e:
        raise ValueError(f"Invalid Key: {e}")

    # Cipher text should already be padded
    text = "".join(filter(str.isalpha, cipher_text)).upper()
    plain_text = ""
    
    for i in range(0, len(text), size):
        # Get a block of text
        block = text[i:i+size]
        # Convert to vector
        vector = np.array([char_to_num(char) for char in block]).reshape(size, 1)
        
        # Matrix multiplication with decryption key
        decrypted_vector = np.dot(decryption_matrix, vector)
        
        # Take mod 26
        decrypted_vector_mod26 = decrypted_vector % 26
        
        # Convert back to chars
        for num in decrypted_vector_mod26.flatten():
            plain_text += num_to_char(num)
            
    return plain_text

# --- Handling Security Flaws ---

def get_flaws() -> dict:
    """
    Returns the flaws of the Hill cipher and their solutions.
    """
    return {
        "flaw": "Known-Plaintext Attack",
        "description": "The Hill cipher is a linear cipher, meaning its encryption process is a set of linear equations. If an attacker knows a small amount of plaintext and its corresponding ciphertext (e.g., 'HELLO' encrypts to 'QWERT'), they can set up a system of linear equations to solve for the key matrix. For a 2x2 matrix, they only need 4 characters (2 digraphs) of known plaintext.",
        "solution": "The linearity is the core weakness. This is solved by modern ciphers (like AES) which introduce non-linearity (e.g., S-boxes) and multiple rounds of substitution and permutation, making it impossible to solve for the key using simple linear algebra."
    }