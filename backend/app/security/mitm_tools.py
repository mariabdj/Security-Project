# This is a new file you must create: backend/app/security/mitm_tools.py

import hashlib
from ..core.supabase_client import supabase
from typing import List, Dict, Any

def hash_data(data: Any) -> str:
    """
    Simulates hashing for the MiTM demo.
    Converts any data to string and hashes it.
    """
    return hashlib.sha256(str(data).encode('utf-8')).hexdigest()

def get_listeners() -> List[str]:
    """
    Fetches all active MiTM attacker usernames.
    """
    try:
        response = supabase.table("mitm_listeners").select("attacker_username").eq("status", "listening").execute()
        if response.data:
            return [row['attacker_username'] for row in response.data]
    except Exception as e:
        print(f"Error fetching MiTM listeners: {e}")
    return []

def capture_packet(packet_type: str, data: Dict[str, Any], listeners: List[str]):
    """
    Inserts an intercepted packet for each active listener.
    """
    if not listeners:
        return

    try:
        rows_to_insert = [
            {
                "target_attacker": listener_username,
                "packet_type": packet_type,
                "data": data 
            }
            for listener_username in listeners
        ]
        
        supabase.table("intercepted_packets").insert(rows_to_insert).execute()
        
    except Exception as e:
        # We don't want to fail the main request if MiTM capture fails
        print(f"Error capturing MiTM packet: {e}")
