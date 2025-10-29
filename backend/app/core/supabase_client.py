# backend/app/core/supabase_client.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    raise EnvironmentError("SUPABASE_URL and SUPABASE_KEY must be set in .env file")

# Create the Supabase client instance
supabase: Client = create_client(url, key)