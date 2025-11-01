from fastapi import APIRouter, HTTPException, Body
import numpy as np
from ..models import schemas
# [MODIFIÉ] Import des nouveaux fichiers d'algorithmes
from ..security.crypto_algorithms import caesar, playfair, hill

router = APIRouter(
    prefix="/visualize",
    tags=["Visualization"]
)

@router.post("/encrypt", response_model=schemas.VisualizationResponse)
async def visualize_encryption(request: schemas.VisualizeRequest = Body(...)):
    """
    Fournit une décomposition étape par étape d'un processus de chiffrement.
    - Pour 'caesar', fournir 'text' et 'shift'.
    - Pour 'playfair', fournir 'text', 'key', et 'size' (5 ou 6).
    - Pour 'hill', fournir 'text', 'key', et 'size' (2 ou 3).
    """
    steps = []
    final_text = ""
    prepared_text_str = None 
    
    # --- Détermination de l'Algorithme ---
    algorithm = ""
    if request.shift is not None and request.text is not None:
        algorithm = "caesar"
    elif request.key is not None and request.size is not None and request.text is not None:
        # Tenter de deviner en fonction de la taille
        if request.size in [2, 3]:
            algorithm = "hill" # Prioriser Hill si taille 2 ou 3
        elif request.size in [5, 6]:
            algorithm = "playfair" # Utiliser Playfair si taille 5 ou 6
        
        # Validation pour Hill
        if algorithm == "hill" and len(request.key) != request.size * request.size:
             raise HTTPException(
                 status_code=400,
                 detail=f"La longueur de la clé Hill doit être de {request.size * request.size} pour une matrice {request.size}x{request.size}."
             )
        # Validation pour Playfair (utilise la nouvelle fonction de vérification)
        elif algorithm == "playfair":
            try:
                playfair.verifier_cle(request.key, request.size)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
    else:
        raise HTTPException(
            status_code=400, 
            detail="Paramètres insuffisants. Fournir 'text' et 'shift' (César), ou 'text', 'key' et 'size' (Playfair/Hill)."
        )

    # --- VISUALISATION CÉSAR (Inchangée, utilise le nouveau module) ---
    if algorithm == "caesar":
        try:
            if not isinstance(request.shift, int):
                raise ValueError("Le décalage (shift) doit être un entier.")

            steps.append(schemas.VisualizationStep(
                step_title="Début: Entrée",
                description=f"Chiffrement de '{request.text}' avec un décalage de {request.shift}.",
                data={"text": request.text, "shift": request.shift, "alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
            ))
            
            encrypted_text = ""
            for i, char in enumerate(request.text):
                if 'a' <= char <= 'z' or 'A' <= char <= 'Z':
                    original_ord = ord(char.upper()) 
                    original_idx = original_ord - ord('A')
                    # Utilise la nouvelle fonction de chiffrement de caesar.py
                    shifted_char = caesar.encrypt(char, request.shift) 
                    shifted_ord = ord(shifted_char.upper())
                    shifted_idx = shifted_ord - ord('A')
                    steps.append(schemas.VisualizationStep(
                        step_title=f"Traitement de '{char}'",
                        description=f"Lettre '{char.upper()}' (index {original_idx}) décalée de {request.shift} devient '{shifted_char.upper()}' (index {shifted_idx}).",
                        data={"char": char.upper(), "idx": original_idx, "new_char": shifted_char.upper(), "new_idx": shifted_idx, "shift": request.shift, "alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
                    ))
                    encrypted_text += shifted_char
                else:
                    steps.append(schemas.VisualizationStep(
                        step_title=f"Ignorer '{char}'",
                        description=f"'{char}' n'est pas une lettre de l'alphabet et reste inchangé.",
                        data={"char": char, "alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
                    ))
                    encrypted_text += char
            final_text = encrypted_text
        except ValueError as e:
             raise HTTPException(status_code=400, detail=str(e))


    # --- [MODIFIÉ] VISUALISATION PLAYFAIR (utilise les nouvelles fonctions) ---
    elif algorithm == "playfair":
        try:
            # Étape 1: Utilise la nouvelle fonction 'creer_grille'
            grille_flat = playfair.creer_grille(request.key, request.size)
            # Convertir la liste plate en matrice pour l'affichage
            matrix = [grille_flat[i:i+request.size] for i in range(0, len(grille_flat), request.size)]
            
            steps.append(schemas.VisualizationStep(
                step_title=f"Étape 1: Générer la Matrice Clé {request.size}x{request.size}",
                description=f"Utilisation de la clé '{request.key.upper()}' pour générer la matrice {request.size}x{request.size}.",
                data={"key": request.key.upper(), "matrix": matrix, "size": request.size}
            ))
            
            # Étape 2: Utilise les nouvelles fonctions 'nettoyer' et 'paires'
            prepared_text = playfair.nettoyer(request.text, request.size)
            prepared_text_str = prepared_text # Sauvegarder pour l'étape finale
            digraphs_list = playfair.paires(prepared_text) # Renvoie une liste de tuples
            digraphs_str_list = ["".join(t) for t in digraphs_list] # Convertir les tuples en chaînes

            steps.append(schemas.VisualizationStep(
                step_title="Étape 2: Préparer le Texte",
                description=f"Texte nettoyé, converti en majuscules, 'J' devient 'I' (si 5x5), divisé en digrammes. 'X' utilisé pour les doublons et le bourrage.",
                data={"original": request.text, "prepared": prepared_text_str, "digraphs": digraphs_str_list}
            ))
            
            encrypted_text = ""
            for i, (c1, c2) in enumerate(digraphs_list):
                # Utilise la nouvelle fonction 'position'
                r1, c1_col = playfair.position(grille_flat, c1, request.size)
                r2, c2_col = playfair.position(grille_flat, c2, request.size)
                
                new_pos1, new_pos2 = [], []
                rule = ""
                
                # [MODIFIÉ] Utilise request.size au lieu de '5'
                if r1 == r2: # Même ligne
                    rule = "Même Ligne"
                    new_pos1 = [r1, (c1_col + 1) % request.size]
                    new_pos2 = [r2, (c2_col + 1) % request.size]
                elif c1_col == c2_col: # Même colonne
                    rule = "Même Colonne"
                    new_pos1 = [(r1 + 1) % request.size, c1_col]
                    new_pos2 = [(r2 + 1) % request.size, c2_col]
                else: # Rectangle
                    rule = "Rectangle"
                    new_pos1 = [r1, c2_col]
                    new_pos2 = [r2, c1_col]

                encrypted_digraph = matrix[new_pos1[0]][new_pos1[1]] + matrix[new_pos2[0]][new_pos2[1]]
                current_digraph_str = f"{c1}{c2}"

                steps.append(schemas.VisualizationStep(
                    step_title=f"Étape {3+i}: Chiffrer le Digramme '{current_digraph_str}'",
                    description=f"'{c1}' à ({r1},{c1_col}) et '{c2}' à ({r2},{c2_col}). Application de la règle '{rule}' donne '{encrypted_digraph}'.",
                    data={
                        "matrix": matrix,
                        "size": request.size,
                        "digraph": current_digraph_str, 
                        "pos1": [r1, c1_col], 
                        "pos2": [r2, c2_col], 
                        "rule": rule, 
                        "new_pos1": new_pos1, 
                        "new_pos2": new_pos2, 
                        "new_digraph": encrypted_digraph
                    }
                ))
                encrypted_text += encrypted_digraph
            final_text = encrypted_text
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        
    # --- [MODIFIÉ] VISUALISATION HILL (utilise les nouvelles fonctions) ---
    elif algorithm == "hill":
        try:
            # Étape 1: Utilise la nouvelle fonction 'get_key_matrix'
            key_matrix = hill.get_key_matrix(request.key, request.size)
            # Tenter d'obtenir l'inverse tôt pour valider la clé
            hill.get_modular_inverse_matrix(key_matrix, request.size) 
            
            steps.append(schemas.VisualizationStep(
                step_title="Étape 1: Générer la Matrice Clé (K)",
                description=f"La chaîne clé '{request.key.upper()}' devient une matrice {request.size}x{request.size} (A=0...).",
                data={"key": request.key.upper(), "matrix": key_matrix.tolist()}
            ))

            # Étape 2: Préparer le texte (Nettoyage + Bourrage)
            prepared_text_str = "".join(c for c in request.text.upper() if c.isalpha())
            # [CORRIGÉ] Remplacement de 'd' par 'request.size'
            padding_needed = request.size - (len(prepared_text_str) % request.size) if len(prepared_text_str) % request.size != 0 else 0
            if padding_needed > 0:
                prepared_text_str += 'X' * padding_needed
            
            steps.append(schemas.VisualizationStep(
                step_title="Étape 2: Préparer le Texte",
                description=f"Texte nettoyé, en majuscules, et bourré avec 'X' pour être un multiple de {request.size}.",
                data={"original": request.text, "prepared": prepared_text_str}
            ))

            encrypted_text = ""
            for i in range(0, len(prepared_text_str), request.size):
                block = prepared_text_str[i:i+request.size]
                # Utilise la nouvelle fonction 'text_to_numbers'
                vector_list = hill.text_to_numbers(block)
                vector = np.array(vector_list).reshape(request.size, 1)
                
                calculation_steps = []
                result_vector_raw = np.dot(key_matrix, vector)
                
                calc_str_parts = []
                for r in range(request.size):
                    row_vals = key_matrix[r, :]
                    col_vals = vector[:, 0]
                    dot_product = np.dot(row_vals, col_vals)
                    calc_str_parts.append(f"Ligne {r}: ({' + '.join([f'{kr}*{pv}' for kr, pv in zip(row_vals, col_vals)])}) = {dot_product}")
                calculation_steps.append("\n".join(calc_str_parts))
                
                calculation_steps.append(f"Vecteur Résultat (Brut): {result_vector_raw.flatten().tolist()}")

                result_vector_mod26 = result_vector_raw % 26
                calculation_steps.append(f"Vecteur Résultat (mod 26): {result_vector_mod26.flatten().tolist()}")

                # Utilise la nouvelle fonction 'numbers_to_text'
                encrypted_block = hill.numbers_to_text([int(num) for num in result_vector_mod26.flatten()])
                calculation_steps.append(f"Bloc Chiffré: '{encrypted_block}'")

                steps.append(schemas.VisualizationStep(
                    step_title=f"Étape {3 + i // request.size}: Chiffrer le Bloc '{block}'",
                    description=f"Bloc '{block}' (vecteur P) est multiplié par la matrice clé K: C = (K * P) mod 26.",
                    data={
                        "matrix": key_matrix.tolist(), 
                        "block": block,
                        "vector": vector.flatten().tolist(), 
                        "calculation_steps": calculation_steps, 
                        "result_vector": [int(n) for n in result_vector_mod26.flatten()], 
                        "new_block": encrypted_block
                    }
                ))
                encrypted_text += encrypted_block
            final_text = encrypted_text
        except ValueError as e: 
            raise HTTPException(status_code=400, detail=f"Erreur Chiffre de Hill: {str(e)}")

    # --- Étape Finale (Inchangée) ---
    steps.append(schemas.VisualizationStep(
        step_title="Résultat Final",
        description="Le processus de chiffrement est terminé.",
        data={
            "original": request.text,
            "prepared": prepared_text_str, 
            "final": final_text
        }
    ))

    return schemas.VisualizationResponse(
        algorithm=algorithm,
        original_text=request.text,
        final_text=final_text,
        steps=steps
    )