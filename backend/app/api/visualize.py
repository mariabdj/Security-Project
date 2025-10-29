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
    - For 'playfair', provide 'text' and 'key'.
    - For 'hill', provide 'text', 'key', and 'size'.
    """
    steps = []
    final_text = ""
    prepared_text_str = None # To hold prepared text for final step
    
    # --- Determine Algorithm ---
    algorithm = ""
    # Ensure required parameters are present for each type
    if request.shift is not None and request.text is not None:
        algorithm = "caesar"
    elif request.key is not None and request.size is not None and request.text is not None:
        # Check if key length matches size requirement BEFORE proceeding
        if len(request.key) != request.size * request.size:
             raise HTTPException(
                 status_code=400,
                 detail=f"Hill key length must be {request.size * request.size} for a {request.size}x{request.size} matrix."
             )
        algorithm = "hill" # Prioritize Hill if size is given
    elif request.key is not None and request.text is not None:
        algorithm = "playfair"
    else:
        raise HTTPException(
            status_code=400, 
            detail="Insufficient parameters or missing text. Provide 'text' and 'shift' for Caesar, 'text' and 'key' for Playfair, or 'text', 'key', and 'size' for Hill."
        )

    # --- CAESAR VISUALIZATION ---
    if algorithm == "caesar":
        try:
            # Basic validation
            if not isinstance(request.shift, int):
                raise ValueError("Shift must be an integer.")

            steps.append(schemas.VisualizationStep(
                step_title="Start: Input",
                description=f"Encrypting '{request.text}' with a shift of {request.shift}.",
                data={"text": request.text, "shift": request.shift, "alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
            ))
            
            encrypted_text = ""
            for i, char in enumerate(request.text):
                if 'a' <= char <= 'z' or 'A' <= char <= 'Z':
                    original_ord = ord(char.upper()) # Use upper for alphabet index
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
                        step_title=f"Skipping '{char}'",
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
            matrix = playfair.generate_key_matrix(request.key)
            steps.append(schemas.VisualizationStep(
                step_title="Step 1: Generate Key Matrix",
                description=f"Using the key '{request.key.upper()}', generate the 5x5 Playfair matrix (omitting 'J').",
                data={"key": request.key.upper(), "matrix": matrix}
            ))
            
            prepared_text_list = playfair.prepare_text(request.text) # Keep as list
            prepared_text_str = "".join(prepared_text_list) # Store for final step
            steps.append(schemas.VisualizationStep(
                step_title="Step 2: Prepare Text",
                description="Text is uppercased, 'J' becomes 'I', split into digraphs. Double letters separated by 'X', padded with 'X' if needed.",
                data={"original": request.text, "prepared": prepared_text_str, "digraphs": prepared_text_list}
            ))
            
            encrypted_text = ""
            for i, digraph in enumerate(prepared_text_list):
                c1, c2 = digraph[0], digraph[1]
                r1, c1_col = playfair.find_position(matrix, c1)
                r2, c2_col = playfair.find_position(matrix, c2)
                
                # Determine rule and output positions
                new_pos1, new_pos2 = [], []
                rule = ""
                if r1 == r2: # Same row
                    rule = "Same Row"
                    new_pos1 = [r1, (c1_col + 1) % 5]
                    new_pos2 = [r2, (c2_col + 1) % 5]
                elif c1_col == c2_col: # Same column
                    rule = "Same Column"
                    new_pos1 = [(r1 + 1) % 5, c1_col]
                    new_pos2 = [(r2 + 1) % 5, c2_col]
                else: # Rectangle
                    rule = "Rectangle"
                    new_pos1 = [r1, c2_col]
                    new_pos2 = [r2, c1_col]

                encrypted_digraph = matrix[new_pos1[0]][new_pos1[1]] + matrix[new_pos2[0]][new_pos2[1]]

                steps.append(schemas.VisualizationStep(
                    step_title=f"Step {3+i}: Encrypt Digraph '{digraph}'",
                    description=f"'{c1}' at ({r1},{c1_col}) and '{c2}' at ({r2},{c2_col}). Applying the '{rule}' rule gives '{encrypted_digraph}'.",
                    data={
                        "matrix": matrix, # Include matrix for context
                        "digraph": digraph, 
                        "pos1": [r1, c1_col], 
                        "pos2": [r2, c2_col], 
                        "rule": rule, 
                        "new_pos1": new_pos1, # ADDED
                        "new_pos2": new_pos2, # ADDED
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
            key_matrix = hill.create_key_matrix_from_string(request.key, request.size)
            # Try getting inverse early to validate key
            hill.get_decryption_matrix(key_matrix) 
            steps.append(schemas.VisualizationStep(
                step_title="Step 1: Generate Key Matrix (K)",
                description=f"The key string '{request.key.upper()}' becomes a {request.size}x{request.size} matrix (A=0...).",
                data={"key": request.key.upper(), "matrix": key_matrix.tolist()}
            ))

            prepared_text_str = hill.prepare_text(request.text, request.size) # Store for final step
            steps.append(schemas.VisualizationStep(
                step_title="Step 2: Prepare Text",
                description=f"Text cleaned, uppercased, and padded with 'X' to be a multiple of {request.size}.",
                data={"original": request.text, "prepared": prepared_text_str}
            ))

            encrypted_text = ""
            for i in range(0, len(prepared_text_str), request.size):
                block = prepared_text_str[i:i+request.size]
                vector = np.array([hill.char_to_num(char) for char in block]).reshape(request.size, 1)
                
                # --- Detailed Calculation Steps ---
                calculation_steps = []
                result_vector_raw = np.dot(key_matrix, vector)
                
                # Show multiplication step by step (row by column)
                calc_str_parts = []
                for r in range(request.size):
                    row_vals = key_matrix[r, :]
                    col_vals = vector[:, 0]
                    dot_product = np.dot(row_vals, col_vals)
                    calc_str_parts.append(f"Row {r}: ({' + '.join([f'{kr}*{pv}' for kr, pv in zip(row_vals, col_vals)])}) = {dot_product}")
                
                calculation_steps.append("\n".join(calc_str_parts))
                
                # Show result before modulo
                calculation_steps.append(f"Result Vector (Raw): {result_vector_raw.flatten().tolist()}")

                # Show modulo operation
                result_vector_mod26 = result_vector_raw % 26
                calculation_steps.append(f"Result Vector (mod 26): {result_vector_mod26.flatten().tolist()}")

                encrypted_block = "".join([hill.num_to_char(int(num)) for num in result_vector_mod26.flatten()])
                calculation_steps.append(f"Encrypted Block: '{encrypted_block}'")


                steps.append(schemas.VisualizationStep(
                    step_title=f"Step {3 + i // request.size}: Encrypt Block '{block}'",
                    description=f"Block '{block}' (vector P) is multiplied by the key matrix K: C = (K * P) mod 26.",
                    data={
                        "matrix": key_matrix.tolist(), # Key matrix K
                        "block": block,
                        "vector": vector.flatten().tolist(), # Vector P
                        "calculation_steps": calculation_steps, # DETAILED steps
                        "result_vector": [int(n) for n in result_vector_mod26.flatten()], # Vector C
                        "new_block": encrypted_block
                    }
                ))
                encrypted_text += encrypted_block
            final_text = encrypted_text
        except ValueError as e: # Catch errors from hill.py (like non-invertible matrix)
            raise HTTPException(status_code=400, detail=f"Hill Cipher Error: {str(e)}")

    # --- [FIX] ADD FINAL STEP ---
    # This step is now added for all algorithms after the loop completes.
    steps.append(schemas.VisualizationStep(
        step_title="Final Result",
        description="The encryption process is complete.",
        data={
            "original": request.text,
            "prepared": prepared_text_str, # Will be None for Caesar, which is handled by frontend
            "final": final_text
        }
    ))

    return schemas.VisualizationResponse(
        algorithm=algorithm,
        original_text=request.text,
        final_text=final_text,
        steps=steps
    )
