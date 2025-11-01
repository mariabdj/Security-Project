import time
import string
from ...core.supabase_client import supabase

# [CORRIGÉ] Utilisation d'une classe pour encapsuler l'état de l'attaque.
# Cela garantit qu'il n'y a AUCUNE variable globale et que chaque
# requête est 100% indépendante et "thread-safe".

class BruteForceAttacker:
    def __init__(self, alphabet: list, longueur: int, mot_de_passe_cible: str):
        self.alphabet_attack = alphabet
        self.longueur = longueur
        self.mot_de_passe_cible = mot_de_passe_cible
        self.essais = 0
        self.mot_trouve = False
        self.mot_de_passe_trouve = None # Stocker le mot de passe ici

    def _generer(self, prefixe: str, profondeur: int):
        """Fonction récursive privée."""
        # Si le mot est trouvé par une autre branche, arrêter
        if self.mot_trouve:
            return

        # Cas de base: nous avons un mot complet à tester
        if profondeur == 0:
            self.essais += 1
            if prefixe == self.mot_de_passe_cible:
                self.mot_trouve = True
                self.mot_de_passe_trouve = prefixe
            return
        
        # Cas récursif: continuer à construire le mot
        for caractere in self.alphabet_attack:
            if not self.mot_trouve:
                self._generer(prefixe + caractere, profondeur - 1)

    def run(self):
        """Lance l'attaque et retourne le résultat."""
        debut_ns = time.perf_counter_ns()
        self._generer("", self.longueur) # Démarrer la récursion
        fin_ns = time.perf_counter_ns()
        
        duree_ms = (fin_ns - debut_ns) / 1_000_000
        duree_s = duree_ms / 1000.0

        if self.mot_trouve:
            return {
                "found": True,
                "password": self.mot_de_passe_trouve, # Renvoyer le mot de passe
                "attempts": self.essais,
                "time_taken": round(duree_s, 6)
            }
        else:
            return {
                "found": False,
                "message": "Mot de passe non trouvé.",
                "attempts": self.essais,
                "time_taken": round(duree_s, 6)
            }

# Fonction principale appelée par l'API
def run_attack(target_username: str, charset_type: str, max_length: int = 0): # max_length est ignoré
    """
    [CORRIGÉ]
    Fonction principale appelée par l'API pour lancer l'attaque brute force.
    """
    
    # 1. Récupérer le mot de passe cible
    try:
        response = supabase.table("users").select("password_hash").eq("username", target_username).execute()
        if not response.data:
            raise ValueError("Utilisateur cible non trouvé.")
        # [FIX] Utiliser .strip() pour enlever les espaces blancs accidentels
        mot_de_passe_cible = response.data[0]['password_hash'].strip() 
    except Exception as e:
        raise ValueError(f"Erreur Supabase: {str(e)}")
    
    # 2. Définir l'alphabet et la longueur
    if charset_type == 'type1': # Cas A
        alphabet_attack = ['2', '3', '4']
        longueur = 3
    elif charset_type == 'type2': # Cas B
        alphabet_attack = [str(i) for i in range(10)]
        longueur = 5
    elif charset_type == 'type3': # Cas C
        alphabet_attack = list("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+*#@!?")
        longueur = 6
    else:
        raise ValueError(f"Le type de charset '{charset_type}' n'est pas supporté.")

    # 3. Créer une instance d'attaquant et lancer l'attaque
    attacker = BruteForceAttacker(alphabet_attack, longueur, mot_de_passe_cible)
    result = attacker.run()
    
    return result

