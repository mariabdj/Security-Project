# backend/app/api/auth.py
from fastapi import APIRouter, HTTPException, status
from ..models import schemas
from ..core.supabase_client import supabase
from ..security.security import get_password_hash, verify_password, create_access_token

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/signup", response_model=schemas.User)
async def signup(user: schemas.UserCreate):
    # 1. Check if username already exists
    response = supabase.table("users").select("id").eq("username", user.username).execute()
    if response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # 2. Hash the password - (CHANGED)
    hashed_password = get_password_hash(user.password)

    # 3. Insert the new user into the public.users table
    new_user_data = {
        "username": user.username,
        "password_hash": hashed_password
    }
    
    try:
        insert_response = supabase.table("users").insert(new_user_data).execute()
        if not insert_response.data:
            raise HTTPException(status_code=500, detail="Could not create user.")
            
        created_user = insert_response.data[0]
        return schemas.User(id=created_user['id'], username=created_user['username'])

    except Exception as e:
        if "username_length_check" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be at least 3 characters long.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )


@router.post("/login", response_model=schemas.Token)
async def login(form_data: schemas.UserLogin):
    # 1. Find the user by username
    response = supabase.table("users").select("id, username, password_hash").eq("username", form_data.username).execute()
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incorrect username or password"
        )
    
    user_data = response.data[0]

    # 2. Verify the password - (CHANGED)
    is_password_correct = verify_password(form_data.password, user_data["password_hash"])
    
    if not is_password_correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Create the access token - (CHANGED)
    # The 'id' becomes the 'sub' (subject) in the token
    token_data = {"id": str(user_data["id"]), "username": user_data["username"]}
    access_token = create_access_token(data=token_data)

    return {"access_token": access_token, "token_type": "bearer"}