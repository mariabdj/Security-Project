import time
from ...core.supabase_client import supabase

def run_attack(target_username: str, dictionary_content: str):
    """
    [CORRIGÉ]
    Exécute une attaque par dictionnaire.
    Utilise .strip() pour garantir une comparaison correcte.
    """
    # 1. Obtenir le vrai mot de passe (en clair)
    try:
        response = supabase.table("users").select("password_hash").eq("username", target_username).execute()
        if not response.data:
            raise ValueError("Utilisateur cible non trouvé.")
        # [FIX] Utiliser .strip() pour enlever les espaces blancs accidentels
        real_password = response.data[0]['password_hash'].strip() 
    except Exception as e:
        raise ValueError(f"Erreur Supabase: {str(e)}")

    # 2. Diviser le dictionnaire en une liste de mots
    word_list = dictionary_content.splitlines()
    
    # 3. Lancer l'attaque
    start_time = time.time()
    attempts = 0
    found_password = None

    for word in word_list:
        attempts += 1
        # [FIX] Utiliser .strip() pour nettoyer les mots du dictionnaire
        if word.strip() == real_password:
            found_password = word.strip()
            break # Arrêter dès que le mot est trouvé

    end_time = time.time()

    # 4. Retourner le résultat
    if found_password:
        return {
            "found": True,
            "password": found_password, # Renvoyer le mot de passe trouvé
            "attempts": attempts,
            "time_taken": round(end_time - start_time, 4)
        }
    else:
        return {
            "found": False,
            "message": "Mot de passe non trouvé dans le dictionnaire.",
            "attempts": attempts,
            "time_taken": round(end_time - start_time, 4)
        }

