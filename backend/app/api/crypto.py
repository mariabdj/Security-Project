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
    Encrypts the plaintext using the specified method and parameters.
    """
    try:
        if request.method == "caesar":
            if request.shift is None:
                raise ValueError("A 'shift' is required for Caesar.")
            res = caesar.encrypt(request.text, request.shift)
            return {"result_text": res}
        
        elif request.method == "playfair":
            if request.key is None or request.size is None:
                raise ValueError("A 'key' and 'size' [5 or 6] are required for Playfair.")
            if request.size not in [5, 6]:
                raise ValueError("Size for Playfair must be 5 or 6.")
            
            res = playfair.encrypt(request.text, request.key, request.size)
            return {"result_text": res}
            
        elif request.method == "hill":
            if request.key is None or request.size is None:
                raise ValueError("A 'key' and 'size' [2 or 3] are required for Hill.")
            if request.size not in [2, 3]:
                raise ValueError("Size for Hill must be 2 or 3.")

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
    Decrypts the ciphertext using the specified method and parameters.
    """
    try:
        if request.method == "caesar":
            if request.shift is None:
                raise ValueError("A 'shift' is required for Caesar.")
            res = caesar.decrypt(request.text, request.shift)
            return {"result_text": res}
        
        elif request.method == "playfair":
            if request.key is None or request.size is None:
                raise ValueError("A 'key' and 'size' [5 or 6] are required for Playfair.")
            if request.size not in [5, 6]:
                raise ValueError("Size for Playfair must be 5 or 6.")

            res = playfair.decrypt(request.text, request.key, request.size)
            return {"result_text": res}
            
        elif request.method == "hill":
            if request.key is None or request.size is None:
                raise ValueError("A 'key' and 'size' [2 or 3] are required for Hill.")
            if request.size not in [2, 3]:
                raise ValueError("Size for Hill must be 2 or 3.")

            res = hill.decrypt(request.text, request.key, request.size)
            return {"result_text": res}
            
        else:
            raise HTTPException(status_code=400, detail="Invalid method. Must be 'caesar', 'playfair', or 'hill'.")
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
