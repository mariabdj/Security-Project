# backend/app/security/steganography_tools/image_steg.py
from PIL import Image
import io
from typing import List, Tuple, Dict, Any
from ...models.schemas import StegoVisualizationStep

# --- Utility Functions for LSB ---

def get_new_channel(orig_val: int, bit_to_hide: int) -> int:
    """Helper to calculate new channel value for LSB encoding."""
    return (orig_val & 0b11111110) | bit_to_hide

def get_binary_repr(val: int) -> str:
    """Helper to get 8-bit binary representation."""
    return format(val, '08b')

# --- Steganography Functional Implementations ---

def encode_message(image_bytes: bytes, secret_message: str) -> bytes:
    """Hides a secret message within an image using LSB steganography."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Could not open image. Is it a valid image format? Error: {e}")

    encoded_message = secret_message + "####"
    binary_message = ''.join(get_binary_repr(ord(char)) for char in encoded_message)
    
    width, height = img.size
    total_pixels = width * height
    total_capacity = total_pixels * 3
    
    if len(binary_message) > total_capacity:
        raise ValueError("Message is too long to be hidden in this image.")

    data_index = 0
    img_data = iter(list(img.getdata()))
    new_pixels = []
    
    for pixel in img_data:
        r, g, b = pixel

        if data_index < len(binary_message):
            r = get_new_channel(r, int(binary_message[data_index]))
            data_index += 1
        
        if data_index < len(binary_message):
            g = get_new_channel(g, int(binary_message[data_index]))
            data_index += 1

        if data_index < len(binary_message):
            b = get_new_channel(b, int(binary_message[data_index]))
            data_index += 1
            
        new_pixels.append((r, g, b))

        if data_index >= len(binary_message):
            new_pixels.extend(list(img_data))
            break
            
    new_img = Image.new("RGB", (width, height))
    new_img.putdata(new_pixels)
    
    byte_arr = io.BytesIO()
    new_img.save(byte_arr, format='PNG') 
    return byte_arr.getvalue()


def decode_message(image_bytes: bytes) -> str:
    """Reveals a secret message from an image."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise ValueError("Could not open image or it's not a valid format.")

    binary_data = ""
    delimiter = "####"
    binary_delimiter = ''.join(get_binary_repr(ord(char)) for char in delimiter)

    for pixel in img.getdata():
        r, g, b = pixel
        
        binary_data += str(r & 1)
        binary_data += str(g & 1)
        binary_data += str(b & 1)

        if binary_delimiter in binary_data:
            break
            
    message_part = binary_data.split(binary_delimiter, 1)[0]
    
    secret_message = ""
    for i in range(0, len(message_part), 8):
        byte = message_part[i:i+8]
        if len(byte) == 8:
            secret_message += chr(int(byte, 2))
            
    return secret_message

# --- [NEW] Steganography Visualization Logic ---

def _generate_pixel_step(pixel_index: int, bit_index: int, pixels: List[Tuple[int, int, int]], binary_message: str, mode: str) -> StegoVisualizationStep:
    """
    [NEW HELPER] Generates a detailed visualization step for a single pixel (encode or decode).
    """
    if pixel_index >= len(pixels):
        return None # Out of bounds

    r_orig, g_orig, b_orig = pixels[pixel_index]
    is_encode = mode == 'encode'
    data = {
        "index": int(pixel_index),
        "bit_index_start": int(bit_index),
        "r_orig": int(r_orig), "r_orig_bin": get_binary_repr(r_orig),
        "g_orig": int(g_orig), "g_orig_bin": get_binary_repr(g_orig),
        "b_orig": int(b_orig), "b_orig_bin": get_binary_repr(b_orig),
    }

    if is_encode:
        # --- ENCODE LOGIC ---
        # [FIX] Correctly get the bits to hide
        bit_r = int(binary_message[bit_index]) if bit_index < len(binary_message) else (r_orig & 1)
        bit_g = int(binary_message[bit_index + 1]) if (bit_index + 1) < len(binary_message) else (g_orig & 1)
        bit_b = int(binary_message[bit_index + 2]) if (bit_index + 2) < len(binary_message) else (b_orig & 1)
        
        r_new = get_new_channel(r_orig, bit_r)
        g_new = get_new_channel(g_orig, bit_g)
        b_new = get_new_channel(b_orig, bit_b)

        data.update({
            "bit_to_hide_r": int(bit_r),
            "bit_to_hide_g": int(bit_g),
            "bit_to_hide_b": int(bit_b),
            "r_new": int(r_new), "r_new_bin": get_binary_repr(r_new),
            "g_new": int(g_new), "g_new_bin": get_binary_repr(g_new),
            "b_new": int(b_new), "b_new_bin": get_binary_repr(b_new),
        })
        description = f"Hiding bits **{bit_r}, {bit_g}, {bit_b}** in Pixel ({pixel_index}). The (Value & 254) | Bit operation clears the LSB and inserts the new bit."
    
    else:
        # --- DECODE LOGIC ---
        bit_r = r_orig & 1
        bit_g = g_orig & 1
        bit_b = b_orig & 1
        
        data.update({
            "bit_extracted_r": int(bit_r),
            "bit_extracted_g": int(bit_g),
            "bit_extracted_b": int(bit_b),
            # For JS rendering consistency
            "r_new": int(r_orig), "g_new": int(g_orig), "b_new": int(b_orig),
            "r_new_bin": get_binary_repr(r_orig),
            "g_new_bin": get_binary_repr(g_orig),
            "b_new_bin": get_binary_repr(b_orig),
        })
        description = f"Extracting bits from Pixel ({pixel_index}). The (Value & 1) operation isolates the LSB. Extracted: **{bit_r}, {bit_g}, {bit_b}**."

    return StegoVisualizationStep(
        step_title=f"LSB {mode.capitalize()} Matrix (Pixel {pixel_index})",
        description=description,
        media_type='image',
        mode=mode,
        data=data
    )


def visualize_encode_lsb_image(image_bytes: bytes, secret_message: str) -> List[StegoVisualizationStep]:
    """[MODIFIED] Generates a step-by-step visualization for LSB image encoding."""
    steps = []
    
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Could not open image: {e}")

    width, height = img.size
    pixels = list(img.getdata())
    total_pixels = width * height
    total_capacity_bits = total_pixels * 3
    delimiter = "####"
    
    encoded_message = secret_message + delimiter
    binary_message = ''.join(get_binary_repr(ord(char)) for char in encoded_message)
    message_length_bits = len(binary_message)

    # --- Step 1: Message to Bits & Capacity Check (Unchanged) ---
    message_bits_data = [
        {'char': c, 'ascii': ord(c), 'binary': get_binary_repr(ord(c))} 
        for c in secret_message
    ]
    message_bits_data.append({'char': delimiter, 'ascii': 'N/A', 'binary': ''.join(get_binary_repr(ord(c)) for c in delimiter)})
    
    steps.append(StegoVisualizationStep(
        step_title="Step 1: Message Conversion and Capacity Check",
        description=f"The secret message '{secret_message}' plus the delimiter '####' is converted to {message_length_bits} bits. The image has {width}x{height} pixels, providing a capacity of {total_capacity_bits} bits ({round(total_capacity_bits / 8)} bytes).",
        media_type='image',
        mode='encode',
        data={
            "capacity": int(total_capacity_bits),
            "message_bits": binary_message,
            "message_data": message_bits_data,
            "image_size": (width, height),
            "is_capacity_ok": message_length_bits <= total_capacity_bits
        }
    ))
    
    if message_length_bits > total_capacity_bits:
        return steps 

    # --- [NEW] Step 2, 3, 4: LSB Modification Matrix (Pixel 0, 1, 2) ---
    # Add steps for the first 3 pixels (9 bits)
    for i in range(3):
        if (i * 3) < message_length_bits:
             steps.append(_generate_pixel_step(
                 pixel_index=i, 
                 bit_index=(i * 3), 
                 pixels=pixels, 
                 binary_message=binary_message, 
                 mode='encode'
             ))

    # --- [MODIFIED] Step 5: Byte Assembly ---
    first_byte_bin = binary_message[:8]
    first_char_code = int(first_byte_bin, 2) if len(first_byte_bin) >= 8 else 0
    
    steps.append(StegoVisualizationStep(
        step_title="Step 5: First Byte Assembly (8 Bits)",
        description=f"The first 8 bits ({first_byte_bin}) are assembled from the first 3 pixels (3+3+2 bits). These 8 bits form the first character: '{chr(first_char_code)}'.",
        media_type='image',
        mode='encode',
        data={
            "index": 2, # Refers to Pixel 2
            "units_used": 3 * 3, # 3 channels * 3 pixels (to get 8 bits)
            "binary_stream": binary_message[:8],
            "first_char": chr(first_char_code) if len(first_byte_bin) >= 8 else None
        }
    ))
    
    # --- [MODIFIED] Step 6: Continuous Modification ---
    pixels_modified_count = (message_length_bits + 2) // 3
    pixels_unchanged_count = total_pixels - pixels_modified_count
    
    steps.append(StegoVisualizationStep(
        step_title="Step 6: Continuous LSB Modification",
        description=f"The LSB operation repeats for the remaining **{message_length_bits - 9} bits** (if any). Once the message is hidden ({pixels_modified_count} pixels used), the remaining {pixels_unchanged_count} pixels are untouched.",
        media_type='image',
        mode='encode',
        data={
            "pixels_modified": int(pixels_modified_count),
            "pixels_unchanged": int(pixels_unchanged_count),
            "total_pixels": int(total_pixels),
            "message_bits_count": int(message_length_bits),
            "next_index": 3,
        }
    ))

    # --- Step 7: Final Summary ---
    steps.append(StegoVisualizationStep(
        step_title="Step 7: Final Summary and Download",
        description=f"The entire message ({message_length_bits} bits) has been successfully hidden across the first {pixels_modified_count} pixels. The file is saved as lossless PNG.",
        media_type='image',
        mode='encode',
        data={
            "pixels_modified": int(pixels_modified_count),
            "pixels_unchanged": int(pixels_unchanged_count),
            "total_pixels": int(total_pixels),
            "message_bits_count": int(message_length_bits),
        }
    ))

    return steps

def visualize_decode_lsb_image(image_bytes: bytes) -> List[StegoVisualizationStep]:
    """[MODIFIED] Generates a step-by-step visualization for LSB image decoding."""
    steps = []
    
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise ValueError("Could not open image or it's not a valid format.")

    pixels = list(img.getdata())
    delimiter = "####"
    binary_delimiter = ''.join(get_binary_repr(ord(char)) for char in delimiter)
    total_pixels = len(pixels)

    # --- Step 1: Start Decoding ---
    steps.append(StegoVisualizationStep(
        step_title="Step 1: Start Decoding - Scanning Pixels",
        description="Decoding begins by reading the first pixel's color channels (R, G, B). We extract the Last Significant Bit (LSB) from each channel to assemble the secret binary stream.",
        media_type='image',
        mode='decode',
        data={
            "index": 0,
            "r_orig": int(pixels[0][0]), "r_orig_bin": get_binary_repr(pixels[0][0]),
            "g_orig": int(pixels[0][1]), "g_orig_bin": get_binary_repr(pixels[0][1]),
            "b_orig": int(pixels[0][2]), "b_orig_bin": get_binary_repr(pixels[0][2]),
            "delimiter_bits": binary_delimiter
        }
    ))
    
    # --- [NEW] Step 2, 3, 4: LSB Extraction Matrix (Pixel 0, 1, 2) ---
    binary_message_full = ""
    for i in range(3):
        if i < len(pixels):
             steps.append(_generate_pixel_step(
                 pixel_index=i, 
                 bit_index=(i * 3), 
                 pixels=pixels, 
                 binary_message="", # Not needed for decode
                 mode='decode'
             ))
             binary_message_full += str(pixels[i][0] & 1)
             binary_message_full += str(pixels[i][1] & 1)
             binary_message_full += str(pixels[i][2] & 1)
    
    # --- [MODIFIED] Step 5: First Byte Assembly ---
    first_byte = binary_message_full[:8]
    first_char = chr(int(first_byte, 2)) if len(first_byte) == 8 else '...'
    
    steps.append(StegoVisualizationStep(
        step_title="Step 5: First Byte Assembly and Character Conversion",
        description=f"Extraction continues across the first 3 pixels to assemble **8 bits**. These 8 bits ({first_byte}) are converted to the first character: '{first_char}'.",
        media_type='image',
        mode='decode',
        data={
            "index": 2, # Refers to Pixel 2
            "units_used": 3 * 3, # 3 channels * 3 pixels
            "first_byte": first_byte,
            "first_char": first_char,
            "binary_stream": binary_message_full,
            "delimiter_status": "NOT YET FOUND"
        }
    ))
    
    # --- [MODIFIED] Step 6: Continuous Search ---
    final_message_from_decode = decode_message(image_bytes)
    message_bits_count = len(final_message_from_decode + delimiter) * 8 if final_message_from_decode else 0
    pixels_checked_for_viz = (message_bits_count + 2) // 3
    pixels_checked_for_viz = min(pixels_checked_for_viz, total_pixels) 
    
    steps.append(StegoVisualizationStep(
        step_title="Step 6: Delimiter Search and Continuous Extraction",
        description=f"The extraction process continues pixel by pixel. The assembled stream is checked every 8 bits to detect the delimiter '####' and stop the process.",
        media_type='image',
        mode='decode',
        data={
            "pixels_modified": int(pixels_checked_for_viz),
            "pixels_unchanged": int(total_pixels - pixels_checked_for_viz),
            "index": int(pixels_checked_for_viz),
            "total_pixels": int(total_pixels),
            "message_bits_count": int(message_bits_count),
            "delimiter_status": "Checking...",
        }
    ))
    
    # --- Step 7: Final Decoded Result (Unchanged) ---
    steps.append(StegoVisualizationStep(
        step_title="Step 7: Final Decoded Result",
        description="The message bits before the delimiter are assembled and converted back to the final secret text.",
        media_type='image',
        mode='decode',
        data={
            "final_message": final_message_from_decode,
        }
    ))
    
    return steps