import time
import string
from ...core.supabase_client import supabase

class BruteForceAttacker:
    def __init__(self, alphabet: list, longueur: int, mot_de_passe_cible: str):
        self.alphabet_attack = alphabet
        self.longueur = longueur
        self.mot_de_passe_cible = mot_de_passe_cible
        self.essais = 0
        self.mot_trouve = False
        self.mot_de_passe_trouve = None

    def _generer(self, prefixe: str, profondeur: int):
        """Fonction récursive privée."""
        if self.mot_trouve:
            return

        if profondeur == 0:
            
            # --- [MODIFIED] ---
            # Add a small delay to simulate a real-world request
            # This demonstrates how rate limiting slows down an attack.
            time.sleep(0.01) # 10 millisecond delay per attempt
            # --- [END MODIFICATION] ---
            
            self.essais += 1
            if prefixe == self.mot_de_passe_cible:
                self.mot_trouve = True
                self.mot_de_passe_trouve = prefixe
            return
        
        for caractere in self.alphabet_attack:
            if not self.mot_trouve:
                self._generer(prefixe + caractere, profondeur - 1)

    def run(self):
        """Lance l'attaque et retourne le résultat."""
        debut_ns = time.perf_counter_ns()
        self._generer("", self.longueur) 
        fin_ns = time.perf_counter_ns()
        
        duree_ms = (fin_ns - debut_ns) / 1_000_000
        duree_s = duree_ms / 1000.0

        if self.mot_trouve:
            return {
                "found": True,
                "password": self.mot_de_passe_trouve, 
                "attempts": self.essais,
                "time_taken": round(duree_s, 6)
            }
        else:
            return {
                "found": False,
                "message": "Password not found.",  
                "attempts": self.essais,
                "time_taken": round(duree_s, 6)
            }

def run_attack(target_username: str, charset_type: str, max_length: int = 0):
    try:
        response = supabase.table("users").select("password_hash").eq("username", target_username).execute()
        if not response.data:
            raise ValueError("Target user not found.") 
        mot_de_passe_cible = response.data[0]['password_hash'].strip() 
    except Exception as e:
        raise ValueError(f"Supabase error: {str(e)}")
    
    if charset_type == 'type1':
        alphabet_attack = ['2', '3', '4']
        longueur = 3
    elif charset_type == 'type2':
        alphabet_attack = [str(i) for i in range(10)]
        longueur = 5
    elif charset_type == 'type3':
        alphabet_attack = list("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+*#@!?")
        longueur = 6
    else:
        raise ValueError(f"Charset type '{charset_type}' is not supported.")

    attacker = BruteForceAttacker(alphabet_attack, longueur, mot_de_passe_cible)
    result = attacker.run()
    
    return result
