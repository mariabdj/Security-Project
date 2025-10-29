from fastapi import APIRouter, HTTPException, Body
from ..models import schemas
from ..security.crypto_algorithms import caesar, playfair, hill

router = APIRouter(
    prefix="/crypto",
    tags=["Crypto Operations"]
)

@router.post("/encrypt", response_model=schemas.CryptoResponse)
async def simple_encrypt(request: schemas.CryptoRequest):
    """
    Encrypts plain text using the specified method and parameters.
    """
    try:
        if request.method == "caesar":
            if request.shift is None:
                raise ValueError("Shift is required for Caesar.")
            # Use your pure function
            res = caesar.encrypt(request.text, request.shift)
            return {"result_text": res}
        
        elif request.method == "playfair":
            if request.key is None:
                raise ValueError("Key is required for Playfair.")
            # Use your pure function
            res = playfair.encrypt(request.text, request.key)
            return {"result_text": res}
            
        elif request.method == "hill":
            if request.key is None or request.size is None:
                raise ValueError("Key and size are required for Hill.")
            # Use your pure function
            res = hill.encrypt(request.text, request.key, request.size)
            return {"result_text": res}
            
        else:
            raise HTTPException(status_code=400, detail="Invalid method. Must be 'caesar', 'playfair', or 'hill'.")
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.post("/decrypt", response_model=schemas.CryptoResponse)
async def simple_decrypt(request: schemas.CryptoRequest):
    """
    Decrypts cipher text using the specified method and parameters.
    """
    try:
        if request.method == "caesar":
            if request.shift is None:
                raise ValueError("Shift is required for Caesar.")
            # Use your pure function
            res = caesar.decrypt(request.text, request.shift)
            return {"result_text": res}
        
        elif request.method == "playfair":
            if request.key is None:
                raise ValueError("Key is required for Playfair.")
            # Use your pure function
            res = playfair.decrypt(request.text, request.key)
            return {"result_text": res}
            
        elif request.method == "hill":
            if request.key is None or request.size is None:
                raise ValueError("Key and size are required for Hill.")
            # Use your pure function
            res = hill.decrypt(request.text, request.key, request.size)
            return {"result_text": res}
            
        else:
            raise HTTPException(status_code=400, detail="Invalid method. Must be 'caesar', 'playfair', or 'hill'.")
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")