from collections import Counter
from typing import Dict, Any, Optional, List

# --- Logique du nouveau fichier ---

# Nettoyage du texte
def nettoyer(texte: str) -> str:
    texte = texte.upper()
    return ''.join([c for c in texte if c.isalpha()])

# Chiffrement César
def cesar_chiffrer(texte: str, cle: int) -> str:
    texte = nettoyer(texte)
    if cle % 26 == 0:
        return texte  # Pas de chiffrement
    resultat = ""
    for c in texte:
        code = (ord(c) - ord('A') + cle) % 26
        resultat += chr(ord('A') + code)
    return resultat

# Déchiffrement César
def cesar_dechiffrer(texte: str, cle: int) -> str:
    return cesar_chiffrer(texte, -cle)

# Analyse des failles
def get_flaws_cesar(cle: int, texte_clair: Optional[str] = None, texte_chiffre: Optional[str] = None) -> List[str]:
    flaws = []

    if cle in [0, 26]:
        flaws.append("Clé 0 ou 26 : aucun chiffrement, texte en clair.")
    if cle in [1, 3, 13]:
        flaws.append(f"Clé {cle} : souvent testée en premier par les attaquants.")
    if cle == 13:
        flaws.append("Clé 13 : auto-inverse, même clé pour chiffrer et déchiffrer.")

    if texte_clair and texte_chiffre:
        try:
            freq_clair = Counter(texte_clair)
            freq_chiffre = Counter(texte_chiffre)
            lettre_freq_clair = freq_clair.most_common(1)[0][0]
            lettre_freq_chiffre = freq_chiffre.most_common(1)[0][0]
            delta = (ord(lettre_freq_chiffre) - ord(lettre_freq_clair)) % 26
            flaws.append(f"Analyse fréquentielle : lettre '{lettre_freq_clair}' → '{lettre_freq_chiffre}' ⇒ décalage probable de {delta}.")
        except IndexError:
            # Se produit si le texte est vide ou non alphabétique
            pass

    return flaws

# --- Fonctions Wrapper pour la compatibilité API ---
# Les endpoints API (crypto.py, visualize.py) appellent 'encrypt' et 'decrypt'

def encrypt(plain_text: str, shift: int) -> str:
    """
    Wrapper pour le chiffrement César.
    """
    if not isinstance(shift, int):
        raise ValueError("La clé (shift) doit être un entier.")
    return cesar_chiffrer(plain_text, shift)

def decrypt(cipher_text: str, shift: int) -> str:
    """
    Wrapper pour le déchiffrement César.
    """
    if not isinstance(shift, int):
        raise ValueError("La clé (shift) doit être un entier.")
    return cesar_dechiffrer(cipher_text, shift)

def get_flaws() -> Dict[str, str]:
    """
    Fournit une analyse statique des failles pour l'API (si nécessaire).
    Pour une analyse dynamique, utilisez get_flaws_cesar.
    """
    return {
        "flaw": "Attaque par Force Brute & Analyse Fréquentielle",
        "description": "Le chiffrement de César n'a que 25 clés possibles. Une attaque par force brute est triviale. De plus, il préserve la fréquence des lettres (par exemple, 'E' devient 'H' avec une clé de 3), le rendant vulnérable à l'analyse fréquentielle.",
        "solution": "Ne jamais utiliser ce chiffrement pour des données sensibles. Utiliser un chiffrement polyalphabétique (comme Vigenère) ou, mieux, un standard moderne (AES)."
    }
