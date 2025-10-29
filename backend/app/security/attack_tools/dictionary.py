# backend/app/security/attack_tools/dictionary.py
import time
from ...core.supabase_client import supabase

def run_attack(target_username: str, dictionary_content: str):
    """
    Performs a dictionary attack on a user's plain-text password.
    """
    # 1. Get the target's real password (in plain text)
    response = supabase.table("users").select("password_hash").eq("username", target_username).execute()
    if not response.data:
        raise ValueError("Target user not found.")
    real_password = response.data[0]['password_hash']

    # 2. Split dictionary content into a list of words
    word_list = dictionary_content.splitlines()
    
    # 3. Run the attack
    start_time = time.time()
    attempts = 0
    for word in word_list:
        attempts += 1
        # Check for a match
        if word == real_password:
            end_time = time.time()
            return {
                "found": True,
                "password": word,
                "attempts": attempts,
                "time_taken": round(end_time - start_time, 4)
            }

    end_time = time.time()
    return {
        "found": False,
        "message": "Password not found in the dictionary.",
        "attempts": attempts,
        "time_taken": round(end_time - start_time, 4)
    }