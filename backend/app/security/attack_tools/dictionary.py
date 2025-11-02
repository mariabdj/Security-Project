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
            raise ValueError("Target user not found.") 
        real_password = response.data[0]['password_hash'].strip() 
    except Exception as e:
        raise ValueError(f"Supabase error: {str(e)}")

    word_list = dictionary_content.splitlines()
    
    start_time = time.time()
    attempts = 0
    found_password = None

    for word in word_list:
        
        # --- [MODIFIED] ---
        # Add a small delay to simulate a real-world request
        # This demonstrates how rate limiting slows down an attack.
        time.sleep(0.05) # 50 millisecond delay per attempt
        # --- [END MODIFICATION] ---

        attempts += 1
        if word.strip() == real_password:
            found_password = word.strip()
            break 

    end_time = time.time()

    if found_password:
        return {
            "found": True,
            "password": found_password, 
            "attempts": attempts,
            "time_taken": round(end_time - start_time, 4)
        }
    else:
        return {
            "found": False,
            "message": "Password not found in the dictionary.", 
            "attempts": attempts,
            "time_taken": round(end_time - start_time, 4)
        }
