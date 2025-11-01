import sys
import re
from typing import List, Tuple, Dict

# --- Logique du nouveau fichier ---

# Nettoyage manuel du texte
def nettoyer(texte: str, taille: int) -> str:
    texte = texte.lower()
    texte = texte.replace("é", "e").replace("è", "e").replace("ê", "e")
    texte = texte.replace("à", "a").replace("â", "a").replace("ç", "c")
    texte = re.sub(r"[’'.,!? ]", "", texte)
    texte = texte.upper()

    lettres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    chiffres = "0123456789"
    texte_nettoye = ""

    if taille == 5:
        lettres = lettres.replace("J", "")  # J exclu
        for c in texte:
            if c in lettres:
                texte_nettoye += c
    elif taille == 6:
        for c in texte:
            if c in lettres + chiffres:
                texte_nettoye += c

    return texte_nettoye

# Vérification stricte de la clé (Modifiée pour lever des erreurs)
def verifier_cle(cle: str, taille: int):
    cle = cle.upper()
    if len(cle) < 5:
        raise ValueError("Clé trop courte : minimum 5 caractères.")
    if cle in ["ABCD", "MOTDEPASSE", "PASSWORD", "SECRET"]:
        raise ValueError("Clé trop prévisible ou dictionnaire.")
    # Note: Les faiblesses (lettres répétées) sont autorisées mais déconseillées
    if taille == 6 and not any(c.isdigit() for c in cle):
        raise ValueError("Clé 6x6 doit contenir au moins un chiffre.")

# Création de la grille
def creer_grille(cle: str, taille: int) -> List[str]:
    # Note : Le nettoyage de la clé se produit ici, pas besoin de le faire avant.
    cle_nettoyee = nettoyer(cle, taille)
    # Vérifier la clé *originale* pour les failles (dictionnaire, etc.)
    verifier_cle(cle, taille)
    
    grille = []
    deja_vu = ""
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if taille == 5:
        alphabet = alphabet.replace("J", "I") # I/J sont fusionnés
    else:
        alphabet += "0123456789"

    # Utiliser la clé nettoyée pour construire la grille
    for c in cle_nettoyee + alphabet:
        if c not in deja_vu:
            # Gérer I/J pour la grille 5x5
            if c == 'J' and taille == 5:
                continue
            if c == 'I' and taille == 5 and 'I' in deja_vu:
                continue
                
            grille.append(c)
            deja_vu += c
    return grille

# Trouver position dans la grille
def position(grille: List[str], lettre: str, taille: int) -> Tuple[int, int]:
    # Gérer le cas où 'J' est dans le texte mais la grille est 5x5
    if lettre == 'J' and taille == 5:
        lettre = 'I'
        
    try:
        index = grille.index(lettre)
        return index // taille, index % taille
    except ValueError:
        # Caractère non trouvé (ne devrait pas arriver avec 'nettoyer')
        raise ValueError(f"Caractère '{lettre}' non trouvé dans la grille. Clé ou taille invalide ?")


# Former les digrammes
def paires(texte: str) -> List[Tuple[str, str]]:
    resultat = []
    i = 0
    while i < len(texte):
        a = texte[i]
        b = texte[i+1] if i+1 < len(texte) else 'X'
        if a == b:
            resultat.append((a, 'X'))
            i += 1
        else:
            resultat.append((a, b))
            i += 2
    return resultat

# Chiffrer une paire
def chiffrer(grille: List[str], a: str, b: str, taille: int) -> str:
    r1, c1 = position(grille, a, taille)
    r2, c2 = position(grille, b, taille)
    if r1 == r2:
        return grille[r1 * taille + (c1 + 1) % taille] + grille[r2 * taille + (c2 + 1) % taille]
    elif c1 == c2:
        return grille[((r1 + 1) % taille) * taille + c1] + grille[((r2 + 1) % taille) * taille + c2]
    else:
        return grille[r1 * taille + c2] + grille[r2 * taille + c1]

# Déchiffrer une paire
def dechiffrer(grille: List[str], a: str, b: str, taille: int) -> str:
    r1, c1 = position(grille, a, taille)
    r2, c2 = position(grille, b, taille)
    if r1 == r2:
        return grille[r1 * taille + (c1 - 1) % taille] + grille[r2 * taille + (c2 - 1) % taille]
    elif c1 == c2:
        return grille[((r1 - 1) % taille) * taille + c1] + grille[((r2 - 1) % taille) * taille + c2]
    else:
        return grille[r1 * taille + c2] + grille[r2 * taille + c1]

# Analyse pédagogique des failles
def get_flaws(cle: str, taille: int) -> List[str]:
    cle = cle.upper()
    flaws = []
    if len(cle) < 5:
        flaws.append("Clé trop courte : faible confusion.")
    if cle in ["ABCD", "MOTDEPASSE", "PASSWORD", "SECRET"]:
        flaws.append("Clé prévisible ou dictionnaire.")
    if any(cle.count(c) > 1 for c in cle):
        flaws.append("Lettres répétées : affaiblissement de la grille.")
    if "Z" in cle or "Q" in cle:
        flaws.append("Lettres isolées dans les coins (Z, Q) facilement repérables.")
    return flaws


# --- Fonctions Wrapper pour la compatibilité API ---

def encrypt(plain_text: str, key: str, size: int = 5) -> str:
    """
    Wrapper pour le chiffrement Playfair.
    'size' est le nouveau paramètre (5 ou 6).
    """
    texte_nettoye = nettoyer(plain_text, size)
    grille = creer_grille(key, size)
    liste_paires = paires(texte_nettoye)

    chiffre = ""
    for a, b in liste_paires:
        chiffre += chiffrer(grille, a, b, size)
    return chiffre

def decrypt(cipher_text: str, key: str, size: int = 5) -> str:
    """
    Wrapper pour le déchiffrement Playfair.
    'size' est le nouveau paramètre (5 ou 6).
    """
    # Le texte chiffré ne doit pas contenir d'espaces
    texte_chiffre_nettoye = nettoyer(cipher_text, size)
    grille = creer_grille(key, size)
    
    # Doit former des paires du texte chiffré
    # Note : la fonction 'paires' gère les 'X' pour le chiffrement,
    # pour le déchiffrement, nous supposons des paires valides.
    liste_chiffre = []
    i = 0
    while i < len(texte_chiffre_nettoye):
        # S'assurer qu'il y a une paire
        if i + 1 < len(texte_chiffre_nettoye):
            liste_chiffre.append((texte_chiffre_nettoye[i], texte_chiffre_nettoye[i+1]))
            i += 2
        else:
            # Caractère isolé à la fin ? Ignorer ou gérer.
            # Pour la robustesse, nous l'ignorons.
            i += 1 

    dechiffre = ""
    for a, b in liste_chiffre:
        dechiffre += dechiffrer(grille, a, b, size)
    return dechiffre
