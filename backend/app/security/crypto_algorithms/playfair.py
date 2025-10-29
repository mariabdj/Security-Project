# backend/app/security/crypto_algorithms/playfair.py

def generate_key_matrix(key: str) -> list[list[str]]:
    """Creates the 5x5 Playfair key matrix."""
    if not key or not key.isalpha():
        raise ValueError("Key must be a non-empty alphabetic string.")

    matrix = []
    # Use key.upper() + ALPHABET. 'I' and 'J' are treated as one.
    alphabet = "ABCDEFGHIKLMNOPQRSTUVWXYZ" # 'J' is omitted
    key_square_string = ""

    # Add unique letters from the key
    for char in key.upper():
        if char == 'J':
            char = 'I'
        if char not in key_square_string and char in alphabet:
            key_square_string += char
            
    # Add remaining letters from the alphabet
    for char in alphabet:
        if char not in key_square_string:
            key_square_string += char
            
    # Convert the 5x5 string into a 2D list
    matrix = []
    for i in range(0, 25, 5):
        matrix.append(list(key_square_string[i:i+5]))
        
    return matrix

def prepare_text(plain_text: str) -> list[str]:
    """Prepares text for Playfair encryption."""
    processed_text = ""
    for char in plain_text.upper():
        if 'A' <= char <= 'Z':
            if char == 'J':
                processed_text += 'I'
            else:
                processed_text += char
    
    # Split into digraphs and handle double letters
    digraphs = []
    i = 0
    while i < len(processed_text):
        if i == len(processed_text) - 1:
            # Odd length, pad with 'X'
            digraphs.append(processed_text[i] + 'X')
            i += 1
        elif processed_text[i] == processed_text[i+1]:
            # Double letter, insert 'X'
            digraphs.append(processed_text[i] + 'X')
            i += 1
        else:
            # Normal digraph
            digraphs.append(processed_text[i:i+2])
            i += 2
            
    return digraphs

def find_position(matrix: list[list[str]], char: str) -> tuple[int, int]:
    """Finds the (row, col) of a character in the matrix."""
    for r in range(5):
        for c in range(5):
            if matrix[r][c] == char:
                return r, c
    return -1, -1 # Should not happen if text is prepared

def encrypt_digraph(matrix: list[list[str]], digraph: str) -> str:
    """Encrypts a single digraph."""
    char1, char2 = digraph[0], digraph[1]
    r1, c1 = find_position(matrix, char1)
    r2, c2 = find_position(matrix, char2)
    
    if r1 == r2: # Same row
        return matrix[r1][(c1 + 1) % 5] + matrix[r2][(c2 + 1) % 5]
    elif c1 == c2: # Same column
        return matrix[(r1 + 1) % 5][c1] + matrix[(r2 + 1) % 5][c2]
    else: # Rectangle
        return matrix[r1][c2] + matrix[r2][c1]

def decrypt_digraph(matrix: list[list[str]], digraph: str) -> str:
    """Decrypts a single digraph."""
    char1, char2 = digraph[0], digraph[1]
    r1, c1 = find_position(matrix, char1)
    r2, c2 = find_position(matrix, char2)
    
    if r1 == r2: # Same row
        return matrix[r1][(c1 - 1) % 5] + matrix[r2][(c2 - 1) % 5]
    elif c1 == c2: # Same column
        return matrix[(r1 - 1) % 5][c1] + matrix[(r2 - 1) % 5][c2]
    else: # Rectangle
        return matrix[r1][c2] + matrix[r2][c1]

def encrypt(plain_text: str, key: str) -> str:
    """Encrypts text using the Playfair cipher."""
    matrix = generate_key_matrix(key)
    digraphs = prepare_text(plain_text)
    cipher_text = ""
    for digraph in digraphs:
        cipher_text += encrypt_digraph(matrix, digraph)
    return cipher_text

def decrypt(cipher_text: str, key: str) -> str:
    """Decrypts text from the Playfair cipher."""
    matrix = generate_key_matrix(key)
    # Cipher text is already in digraphs
    digraphs = [cipher_text[i:i+2] for i in range(0, len(cipher_text), 2)]
    plain_text = ""
    for digraph in digraphs:
        plain_text += decrypt_digraph(matrix, digraph)
    return plain_text

# --- Handling Security Flaws ---

def get_flaws() -> dict:
    """
    Returns the flaws of the Playfair cipher and their solutions.
    """
    return {
        "flaw": "Digraph Frequency Analysis",
        "description": "Playfair is a monoalphabetic substitution cipher, but on digraphs (pairs) instead of single letters. It still preserves the underlying frequency statistics of letter pairs. For example, 'TH' is very common in English, so the encrypted version of 'TH' will also appear frequently. An attacker can use this to break the cipher.",
        "solution": "The cipher is vulnerable because the key matrix is static. A solution would be to use a polyalphabetic cipher (like Vigenere) or, more securely, a modern algorithm (like AES) that uses a much larger key and complex substitution/permutation rounds."
    }