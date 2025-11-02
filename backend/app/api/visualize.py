from fastapi import APIRouter, HTTPException, Body
import numpy as np
from ..models import schemas
from ..security.crypto_algorithms import caesar, playfair, hill

router = APIRouter(
    prefix="/visualize",
    tags=["Visualization"]
)

@router.post("/encrypt", response_model=schemas.VisualizationResponse)
async def visualize_encryption(request: schemas.VisualizeRequest = Body(...)):
    """
    Provides a step-by-step breakdown of an encryption process.
    - For 'caesar', provide 'text' and 'shift'.
    - For 'playfair', provide 'text', 'key', and 'size' (5 or 6).
    - For 'hill', provide 'text', 'key', and 'size' (2 or 3).
    """
    steps = []
    final_text = ""
    prepared_text_str = None 
    
    # --- Algorithm Determination ---
    algorithm = ""
    if request.shift is not None and request.text is not None:
        algorithm = "caesar"
    elif request.key is not None and request.size is not None and request.text is not None:
        if request.size in [2, 3]:
            algorithm = "hill"
        elif request.size in [5, 6]:
            algorithm = "playfair"
        
        if algorithm == "hill" and len(request.key) != request.size * request.size:
             raise HTTPException(
                 status_code=400,
                 detail=f"Hill key length must be {request.size * request.size} for a {request.size}x{request.size} matrix."
             )
        elif algorithm == "playfair":
            try:
                playfair.verifier_cle(request.key, request.size)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
    else:
        raise HTTPException(
            status_code=400, 
            detail="Insufficient parameters. Provide 'text' and 'shift' (Caesar), or 'text', 'key', and 'size' (Playfair/Hill)."
        )

    # --- CAESAR VISUALIZATION ---
    if algorithm == "caesar":
        try:
            if not isinstance(request.shift, int):
                raise ValueError("The 'shift' must be an integer.")

            steps.append(schemas.VisualizationStep(
                step_title="Start: Input",
                description=f"Encrypting '{request.text}' with a shift of {request.shift}.",
                data={"text": request.text, "shift": request.shift, "alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
            ))
            
            encrypted_text = ""
            for i, char in enumerate(request.text):
                if 'a' <= char <= 'z' or 'A' <= char <= 'Z':
                    original_ord = ord(char.upper()) 
                    original_idx = original_ord - ord('A')
                    shifted_char = caesar.encrypt(char, request.shift) 
                    shifted_ord = ord(shifted_char.upper())
                    shifted_idx = shifted_ord - ord('A')
                    steps.append(schemas.VisualizationStep(
                        step_title=f"Processing '{char}'",
                        description=f"Letter '{char.upper()}' (index {original_idx}) shifted by {request.shift} becomes '{shifted_char.upper()}' (index {shifted_idx}).",
                        data={"char": char.upper(), "idx": original_idx, "new_char": shifted_char.upper(), "new_idx": shifted_idx, "shift": request.shift, "alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
                    ))
                    encrypted_text += shifted_char
                else:
                    steps.append(schemas.VisualizationStep(
                        step_title=f"Ignoring '{char}'",
                        description=f"'{char}' is not an alphabet letter and remains unchanged.",
                        data={"char": char, "alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
                    ))
                    encrypted_text += char
            final_text = encrypted_text
        except ValueError as e:
             raise HTTPException(status_code=400, detail=str(e))

    # --- PLAYFAIR VISUALIZATION ---
    elif algorithm == "playfair":
        try:
            grille_flat = playfair.creer_grille(request.key, request.size)
            matrix = [grille_flat[i:i+request.size] for i in range(0, len(grille_flat), request.size)]
            
            steps.append(schemas.VisualizationStep(
                step_title=f"Step 1: Generate {request.size}x{request.size} Key Matrix",
                description=f"Using key '{request.key.upper()}' to generate the {request.size}x{request.size} matrix.",
                data={"key": request.key.upper(), "matrix": matrix, "size": request.size}
            ))
            
            prepared_text = playfair.nettoyer(request.text, request.size)
            prepared_text_str = prepared_text
            digraphs_list = playfair.paires(prepared_text)
            digraphs_str_list = ["".join(t) for t in digraphs_list]

            steps.append(schemas.VisualizationStep(
                step_title="Step 2: Prepare Text",
                description=f"Text cleaned, uppercased, 'J' becomes 'I' (if 5x5), split into digraphs. 'X' used for duplicates and padding.",
                data={"original": request.text, "prepared": prepared_text_str, "digraphs": digraphs_str_list}
            ))
            
            encrypted_text = ""
            for i, (c1, c2) in enumerate(digraphs_list):
                r1, c1_col = playfair.position(grille_flat, c1, request.size)
                r2, c2_col = playfair.position(grille_flat, c2, request.size)
                
                new_pos1, new_pos2 = [], []
                rule = ""
                
                if r1 == r2:
                    rule = "Same Row"
                    new_pos1 = [r1, (c1_col + 1) % request.size]
                    new_pos2 = [r2, (c2_col + 1) % request.size]
                elif c1_col == c2_col:
                    rule = "Same Column"
                    new_pos1 = [(r1 + 1) % request.size, c1_col]
                    new_pos2 = [(r2 + 1) % request.size, c2_col]
                else:
                    rule = "Rectangle"
                    new_pos1 = [r1, c2_col]
                    new_pos2 = [r2, c1_col]

                encrypted_digraph = matrix[new_pos1[0]][new_pos1[1]] + matrix[new_pos2[0]][new_pos2[1]]
                current_digraph_str = f"{c1}{c2}"

                steps.append(schemas.VisualizationStep(
                    step_title=f"Step {3+i}: Encrypt Digraph '{current_digraph_str}'",
                    description=f"'{c1}' at ({r1},{c1_col}) and '{c2}' at ({r2},{c2_col}). Applying '{rule}' rule gives '{encrypted_digraph}'.",
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
        
    # --- HILL VISUALIZATION ---
    elif algorithm == "hill":
        try:
            key_matrix = hill.get_key_matrix(request.key, request.size)
            hill.get_modular_inverse_matrix(key_matrix, request.size) 
            
            steps.append(schemas.VisualizationStep(
                step_title="Step 1: Generate Key Matrix (K)",
                description=f"The key string '{request.key.upper()}' becomes a {request.size}x{request.size} matrix (A=0...).",
                data={"key": request.key.upper(), "matrix": key_matrix.tolist()}
            ))

            prepared_text_str = "".join(c for c in request.text.upper() if c.isalpha())
            padding_needed = request.size - (len(prepared_text_str) % request.size) if len(prepared_text_str) % request.size != 0 else 0
            if padding_needed > 0:
                prepared_text_str += 'X' * padding_needed
            
            steps.append(schemas.VisualizationStep(
                step_title="Step 2: Prepare Text",
                description=f"Text cleaned, uppercased, and padded with 'X' to be a multiple of {request.size}.",
                data={"original": request.text, "prepared": prepared_text_str}
            ))

            encrypted_text = ""
            for i in range(0, len(prepared_text_str), request.size):
                block = prepared_text_str[i:i+request.size]
                vector_list = hill.text_to_numbers(block)
                vector = np.array(vector_list).reshape(request.size, 1)
                
                calculation_steps = []
                result_vector_raw = np.dot(key_matrix, vector)
                
                calc_str_parts = []
                for r in range(request.size):
                    row_vals = key_matrix[r, :]
                    col_vals = vector[:, 0]
                    dot_product = np.dot(row_vals, col_vals)
                    calc_str_parts.append(f"Row {r}: ({' + '.join([f'{kr}*{pv}' for kr, pv in zip(row_vals, col_vals)])}) = {dot_product}")
                calculation_steps.append("\n".join(calc_str_parts))
                
                result_vector_mod26 = result_vector_raw % 26
                calculation_steps.append(f"Result Vector (Raw): {result_vector_raw.flatten().tolist()}")
                calculation_steps.append(f"Result Vector (mod 26): {result_vector_mod26.flatten().tolist()}")

                encrypted_block = hill.numbers_to_text([int(num) for num in result_vector_mod26.flatten()])
                calculation_steps.append(f"Encrypted Block: '{encrypted_block}'")

                steps.append(schemas.VisualizationStep(
                    step_title=f"Step {3 + i // request.size}: Encrypt Block '{block}'",
                    description=f"Block '{block}' (vector P) is multiplied by the key matrix K: C = (K * P) mod 26.",
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
            raise HTTPException(status_code=400, detail=f"Hill Cipher Error: {str(e)}")

    # --- Final Step ---
    steps.append(schemas.VisualizationStep(
        step_title="Final Result",
        description="The encryption process is complete.",
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
