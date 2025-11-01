import numpy as np
import math
import sys
from typing import List, Optional, Dict # <- CORRECTION ICI

# --- Fonctions utilitaires pour la cryptographie (Mod 26) ---

def mod_inverse(a: int, m: int) -> Optional[int]:
    """
    Calcule l'inverse modulaire de 'a' modulo 'm'.
    Nécessaire pour le déterminant lors du déchiffrement.
    """
    a = a % m
    for x in range(1, m):
        if (a * x) % m == 1:
            return x
    return None # Non inversible

def text_to_numbers(text: str) -> List[int]:
    """Convertit une chaîne de caractères (nettoyée) en liste de nombres (A=0, Z=25)."""
    text = text.upper()
    numbers = []
    for char in text:
        if 'A' <= char <= 'Z':
            numbers.append(ord(char) - ord('A'))
    return numbers

def numbers_to_text(numbers: List[int]) -> str:
    """Convertit une liste de nombres en chaîne de caractères."""
    text = ""
    for num in numbers:
        # np.round(num) est utilisé pour gérer les très petites erreurs de flottants
        text += chr(int(round(num)) + ord('A'))
    return text

def get_key_matrix(key_string: str, d: int) -> np.ndarray:
    """Crée la matrice clé et vérifie sa taille."""
    numbers = text_to_numbers(key_string)
    if len(numbers) != d * d:
        raise ValueError(f"La clé doit contenir exactement {d*d} lettres pour une matrice {d}x{d}.")
    
    key_matrix = np.array(numbers).reshape(d, d)
    return key_matrix

# --- Fonctions pour le calcul de l'inverse modulaire ---

def get_modular_inverse_matrix(matrix: np.ndarray, d: int) -> np.ndarray:
    """
    Calcule l'inverse de la matrice modulo 26.
    Inclut la vérification d'inversibilité, solution à la Faible Clé.
    """
    m = 26
    
    # Étape 1: Calcul du Déterminant Modulo 26
    det = int(round(np.linalg.det(matrix))) % m

    # Étape 2: Calcul de l'Inverse Modulaire du Déterminant
    det_inv = mod_inverse(det, m)
    if det_inv is None:
        raise ValueError(
            f"La matrice de clé n'est pas inversible mod 26. "
            f"Déterminant = {det}. gcd({det}, 26) != 1. "
            f"Chiffrement/Déchiffrement impossible."
        )

    # Étape 3: Calcul de la Matrice Adjointe (Adj(K))
    if d == 2:
        # Adj(K) pour 2x2: [[d, -b], [-c, a]]
        a, b = matrix[0, 0], matrix[0, 1]
        c, d_val = matrix[1, 0], matrix[1, 1]
        adjugate_matrix = np.array([
            [d_val, -b],
            [-c, a]
        ])
    elif d == 3:
        # Adj(K) pour 3x3: Matrice des cofacteurs transposée
        cofactors = np.zeros((3, 3), dtype=int)
        for i in range(3):
            for j in range(3):
                # Calcul du mineur (déterminant de la sous-matrice 2x2)
                # np.delete supprime la ligne i et la colonne j
                minor_matrix = np.delete(np.delete(matrix, i, axis=0), j, axis=1)
                minor_det = int(round(np.linalg.det(minor_matrix)))
                
                # Le cofacteur Cij est (-1)^(i+j) * det(Mineur)
                cofactor = ((-1)**(i + j)) * minor_det
                cofactors[i, j] = cofactor
        
        # L'adjointe est la transposée de la matrice des cofacteurs
        adjugate_matrix = cofactors.T
    else:
        # Seules les tailles 2x2 et 3x3 sont gérées ici.
        raise ValueError("Taille de matrice non supportée pour l'inverse modulaire.")

    # Étape 4: Calcul de K^(-1) = det_inv * Adj(K) mod 26
    inverse_matrix = (det_inv * adjugate_matrix) % m
    inverse_matrix = np.round(inverse_matrix).astype(int)
    
    # Correction des valeurs négatives si le modulo a laissé des -x
    inverse_matrix[inverse_matrix < 0] += m
    
    return inverse_matrix

# --- Fonctions pour l'affichage (Solution à la Faible Présentation) ---
# Note: Celles-ci ne seront pas appelées par l'API, mais conservées pour la complétude.
def print_matrix(title: str, matrix: np.ndarray):
    """Affiche une matrice numpy avec un alignement propre."""
    print(f"\n{title}:")
    print("=" * (len(title) + 2))
    rows, cols = matrix.shape
    
    max_width = 0
    for r in range(rows):
        for c in range(cols):
            max_width = max(max_width, len(str(matrix[r, c])))

    for r in range(rows):
        row_str = "[ "
        for c in range(cols):
            row_str += str(matrix[r, c]).rjust(max_width) + " "
        row_str += "]"
        print(row_str)
    print("=" * (len(title) + 2))

# --- Fonctions principales du chiffrement de Hill ---

def encrypt_hill(plaintext: str, key_matrix: np.ndarray, d: int) -> str:
    """Processus de chiffrement avec gestion du bourrage."""
    
    # 1. Nettoyage du message
    cleaned_text = "".join(c for c in plaintext.upper() if c.isalpha())
    plain_numbers = text_to_numbers(cleaned_text)
    
    # 2. Gestion du Bourrage (Padding)
    padding_char = 'X' 
    padding_needed = d - (len(plain_numbers) % d) if len(plain_numbers) % d != 0 else 0
    
    if padding_needed > 0:
        plain_numbers.extend([ord(padding_char) - ord('A')] * padding_needed)

    ciphertext = []
    
    for i in range(0, len(plain_numbers), d):
        block_numbers = np.array(plain_numbers[i:i+d])
        encrypted_numbers = (key_matrix @ block_numbers) % 26
        ciphertext.extend(encrypted_numbers.tolist())

    return numbers_to_text(ciphertext)

def decrypt_hill(ciphertext: str, key_matrix: np.ndarray, d: int) -> str:
    """Processus de déchiffrement."""
    
    try:
        inverse_key = get_modular_inverse_matrix(key_matrix, d)
    except ValueError as e:
        # Propager l'erreur si la clé n'est pas inversible
        raise e

    cipher_numbers = text_to_numbers(ciphertext)
    plaintext_numbers = []

    for i in range(0, len(cipher_numbers), d):
        block_numbers = np.array(cipher_numbers[i:i+d])
        decrypted_numbers = (inverse_key @ block_numbers) % 26
        plaintext_numbers.extend(decrypted_numbers.tolist())

    plaintext_full = numbers_to_text(plaintext_numbers)
    
    return plaintext_full

# --- Fonctions Wrapper pour la compatibilité API ---

def encrypt(plain_text: str, key: str, size: int) -> str:
    """
    Wrapper pour le chiffrement Hill.
    Prend une chaîne de clé et une taille, crée la matrice et chiffre.
    """
    try:
        key_matrix = get_key_matrix(key, size)
        # Vérification de l'inversibilité ici pour échouer tôt
        get_modular_inverse_matrix(key_matrix, size) 
        return encrypt_hill(plain_text, key_matrix, size)
    except ValueError as e:
        # Transmettre l'erreur (par ex. clé non inversible) à l'API
        raise e

def decrypt(cipher_text: str, key: str, size: int) -> str:
    """
    Wrapper pour le déchiffrement Hill.
    Prend une chaîne de clé et une taille, crée la matrice et déchiffre.
    """
    try:
        key_matrix = get_key_matrix(key, size)
        return decrypt_hill(cipher_text, key_matrix, size)
    except ValueError as e:
        # Transmettre l'erreur (par ex. clé non inversible) à l'API
        raise e

def get_flaws() -> Dict[str, str]:
    """
    Fournit une analyse statique des failles pour l'API.
    """
    return {
        "flaw": "Attaque par Texte Clair Connu (Known-Plaintext Attack)",
        "description": "Le chiffrement de Hill est linéaire. Si un attaquant connaît 'd*d' blocs de texte clair et leur chiffré correspondant (où 'd' est la taille de la matrice), il peut mettre en place un système d'équations linéaires pour résoudre et trouver la matrice clé. Pour une matrice 2x2, seulement 4 caractères (2 paires) sont nécessaires.",
        "solution": "La faiblesse est la linéarité. Les chiffrements modernes comme AES introduisent de la non-linéarité (via les S-boxes) et des tours multiples pour empêcher ce type d'attaque algébrique."
    }