# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.supabase_client import supabase
from .api import auth, users, chats, attacks, storage, visualize, crypto, mitm  # <-- IMPORT MITM

app = FastAPI(
    title="TP1-SSAD Security Framework API",
    description="Backend for the SSAD encryption and security project."
)

# --- CORS Configuration ---
origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://127.0.0.1:5500",
    "null",
    "https://mariabdj.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. INCLUDE ALL YOUR ROUTERS ---
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(chats.router)
app.include_router(attacks.router)
app.include_router(storage.router)
app.include_router(visualize.router)
app.include_router(crypto.router)
app.include_router(mitm.router)  # <-- INCLUDE MITM ROUTER

@app.get("/")
def read_root():
    return {"message": "SEKO Backend is running!"}


@app.get("/test-supabase")
async def test_supabase_connection():
    response = supabase.table("users").select("id, username").limit(1).execute()
    return {"status": "success", "data": response.data}
