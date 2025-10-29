# backend/app/security/password_gen.py
import random
import string

def generate_password(password_type: int) -> str:
    """
    Generates a password based on the teacher's 3 rules.
    """
    if password_type == 1:
        # Rule 1: 3 chars from [2, 3, 4]
        charset = ['2', '3', '4']
        return "".join(random.choice(charset) for _ in range(3))
        
    elif password_type == 2:
        # Rule 2: 5 chars from [0-9]
        charset = string.digits
        return "".join(random.choice(charset) for _ in range(5))
        
    elif password_type == 3:
        # Rule 3: 6 chars (a-z, A-Z, 0-9, +, *, etc.)
        # We'll define "etc." as some common special chars
        charset = string.ascii_letters + string.digits + "+*@!#$%"
        return "".join(random.choice(charset) for _ in range(6))
        
    else:
        raise ValueError("Invalid password type. Must be 1, 2, or 3.")