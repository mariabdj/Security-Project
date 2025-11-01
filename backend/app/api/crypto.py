from fastapi import APIRouter, HTTPException, Body
from ..models import schemas
# [MODIFIÉ] Vos nouveaux fichiers d'algorithmes
from ..security.crypto_algorithms import caesar, playfair, hill 

router = APIRouter(
    prefix="/crypto",
    tags=["Crypto Operations"]
)

@router.post("/encrypt", response_model=schemas.CryptoResponse)
async def simple_encrypt(request: schemas.CryptoRequest):
    """
    Chiffre le texte en clair en utilisant la méthode et les paramètres spécifiés.
    """
    try:
        if request.method == "caesar":
            if request.shift is None:
                raise ValueError("Un décalage (shift) est requis pour César.")
            res = caesar.encrypt(request.text, request.shift)
            return {"result_text": res}
        
        elif request.method == "playfair":
            # [MODIFIÉ] Playfair a maintenant besoin d'une clé ET d'une taille
            if request.key is None or request.size is None:
                raise ValueError("Une clé (key) et une taille (size) [5 ou 6] sont requises pour Playfair.")
            if request.size not in [5, 6]:
                raise ValueError("La taille pour Playfair doit être 5 ou 6.")
            
            res = playfair.encrypt(request.text, request.key, request.size)
            return {"result_text": res}
            
        elif request.method == "hill":
            if request.key is None or request.size is None:
                raise ValueError("Une clé (key) et une taille (size) [2 ou 3] sont requises pour Hill.")
            if request.size not in [2, 3]:
                raise ValueError("La taille pour Hill doit être 2 ou 3.")

            res = hill.encrypt(request.text, request.key, request.size)
            return {"result_text": res}
            
        else:
            raise HTTPException(status_code=400, detail="Méthode invalide. Doit être 'caesar', 'playfair', ou 'hill'.")
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Une erreur est survenue: {str(e)}")


@router.post("/decrypt", response_model=schemas.CryptoResponse)
async def simple_decrypt(request: schemas.CryptoRequest):
    """
    Déchiffre le texte chiffré en utilisant la méthode et les paramètres spécifiés.
    """
    try:
        if request.method == "caesar":
            if request.shift is None:
                raise ValueError("Un décalage (shift) est requis pour César.")
            res = caesar.decrypt(request.text, request.shift)
            return {"result_text": res}
        
        elif request.method == "playfair":
            # [MODIFIÉ] Playfair a maintenant besoin d'une clé ET d'une taille
            if request.key is None or request.size is None:
                raise ValueError("Une clé (key) et une taille (size) [5 ou 6] sont requises pour Playfair.")
            if request.size not in [5, 6]:
                raise ValueError("La taille pour Playfair doit être 5 ou 6.")

            res = playfair.decrypt(request.text, request.key, request.size)
            return {"result_text": res}
            
        elif request.method == "hill":
            if request.key is None or request.size is None:
                raise ValueError("Une clé (key) et une taille (size) [2 ou 3] sont requises pour Hill.")
            if request.size not in [2, 3]:
                raise ValueError("La taille pour Hill doit être 2 ou 3.")

            res = hill.decrypt(request.text, request.key, request.size)
            return {"result_text": res}
            
        else:
            raise HTTPException(status_code=400, detail="Méthode invalide. Doit être 'caesar', 'playfair', ou 'hill'.")
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Une erreur est survenue: {str(e)}")