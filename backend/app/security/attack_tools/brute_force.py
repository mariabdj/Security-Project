# backend/app/security/attack_tools/brute_force.py
import itertools
import string
import time
from ...core.supabase_client import supabase

def run_attack(target_username: str, charset_type: str, max_length: int):
    """
    Performs a brute-force attack on a user's plain-text password.
    WARNING: This is for academic purposes and will be VERY slow.
    """
    # 1. Get the target's real password (in plain text)
    response = supabase.table("users").select("password_hash").eq("username", target_username).execute()
    if not response.data:
        raise ValueError("Target user not found.")
    real_password = response.data[0]['password_hash']

    # 2. Define the character set for the attack
    if charset_type == 'type1': # 3 chars [2, 3, 4]
        charset = ['2', '3', '4']
        lengths = [3]
    elif charset_type == 'type2': # 5 chars [0-9]
        charset = string.digits
        lengths = [5]
    elif charset_type == 'type3': # 6 chars complex
        charset = string.ascii_letters + string.digits + "+*@!#$%"
        lengths = [6]
    elif charset_type == 'numeric': # General numeric
        charset = string.digits
        lengths = range(1, max_length + 1)
    else: # General alphanumeric
        charset = string.ascii_letters + string.digits
        lengths = range(1, max_length + 1)

    # 3. Run the attack
    start_time = time.time()
    attempts = 0
    for length in lengths:
        # Generate all possible passwords of this length
        guesses = itertools.product(charset, repeat=length)
        for guess_tuple in guesses:
            guess = "".join(guess_tuple)
            attempts += 1
            
            # Check for a match
            if guess == real_password:
                end_time = time.time()
                return {
                    "found": True,
                    "password": guess,
                    "attempts": attempts,
                    "time_taken": round(end_time - start_time, 4)
                }
            
            # Safety break to prevent server timeout
            if attempts > 5_000_000:
                end_time = time.time()
                return {
                    "found": False,
                    "message": "Attack stopped after 5 million attempts.",
                    "attempts": attempts,
                    "time_taken": round(end_time - start_time, 4)
                }

    end_time = time.time()
    return {
        "found": False,
        "message": "Password not found within the given constraints.",
        "attempts": attempts,
        "time_taken": round(end_time - start_time, 4)
    }