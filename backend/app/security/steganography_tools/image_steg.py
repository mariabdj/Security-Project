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

# --- Steganography Functional Implementations (Existing) ---

def encode_message(image_bytes: bytes, secret_message: str) -> bytes:
    """Hides a secret message within an image using LSB steganography."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Could could not open image. Is it a valid image format? Error: {e}")

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

# --- Steganography Visualization Logic (MAX DETAIL) ---

def visualize_encode_lsb_image(image_bytes: bytes, secret_message: str) -> List[StegoVisualizationStep]:
    """Generates a step-by-step visualization for LSB image encoding."""
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

    # Step 1: Message to Bits & Capacity Check
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

    # --- Step 2: LSB Modification Matrix (R, G, B) ---
    p_index = 0
    r_orig, g_orig, b_orig = pixels[p_index]
    
    # Pre-calculate values for R, G, B
    bit_r = int(binary_message[0])
    r_new = get_new_channel(r_orig, bit_r)
    
    bit_g = int(binary_message[1])
    g_new = get_new_channel(g_orig, bit_g)
    
    bit_b = int(binary_message[2])
    b_new = get_new_channel(b_orig, bit_b)

    steps.append(StegoVisualizationStep(
        step_title="Step 2: LSB Modification Matrix (Pixel 0)",
        description=f"Hiding the first **3 bits** of the message ({bit_r}, {bit_g}, {bit_b}) in the R, G, and B channels of Pixel (0, 0). The core operation is **(Value & 11111110) | Bit**.",
        media_type='image',
        mode='encode',
        data={
            "index": int(p_index),
            "bit_index_start": 0,
            "r_orig": int(r_orig), "r_orig_bin": get_binary_repr(r_orig), "r_new": int(r_new), "r_new_bin": get_binary_repr(r_new), "bit_to_hide": int(bit_r),
            "g_orig": int(g_orig), "g_orig_bin": get_binary_repr(g_orig), "g_new": int(g_new), "g_new_bin": get_binary_repr(g_new), "bit_to_hide_g": int(bit_g),
            "b_orig": int(b_orig), "b_orig_bin": get_binary_repr(b_orig), "b_new": int(b_new), "b_new_bin": get_binary_repr(b_new), "bit_to_hide_b": int(bit_b),
        }
    ))

    # Step 3: Completion of Pixel 0 and Byte Assembly
    
    first_byte_bin = binary_message[:8]
    
    steps.append(StegoVisualizationStep(
        step_title="Step 3: Completion of Pixel 0 and Byte Assembly",
        description=f"Pixel 0 is now completely encoded. The first **3 bits** ({binary_message[:3]}) contribute to forming the first character. We check the full stream assembly (next 5 bits come from Pixel 1).",
        media_type='image',
        mode='encode',
        data={
            "index": int(0),
            "units_used": 3, # Channels used in this pixel
            "binary_stream": binary_message[:8], # First byte assembly preview
            "first_char": chr(int(first_byte_bin, 2)) if len(first_byte_bin) >= 8 else None
        }
    ))
    
    # Step 4: LSB Modification Matrix (Pixel 1 - Next 3 bits)
    
    p_index_1 = 1
    r1_orig, g1_orig, b1_orig = pixels[p_index_1]
    
    # Pre-calculate values for R, G, B
    bit_r1 = int(binary_message[3]) if message_length_bits > 3 else (r1_orig & 1)
    r1_new = get_new_channel(r1_orig, bit_r1)
    
    bit_g1 = int(binary_message[4]) if message_length_bits > 4 else (g1_orig & 1)
    g1_new = get_new_channel(g1_orig, bit_g1)
    
    bit_b1 = int(binary_message[5]) if message_length_bits > 5 else (b1_orig & 1)
    b1_new = get_new_channel(b1_orig, bit_b1)

    steps.append(StegoVisualizationStep(
        step_title="Step 4: LSB Modification Matrix (Pixel 1 Preview)",
        description=f"The next **3 bits** (Bits 3, 4, 5) are inserted into Pixel 1, R, G, and B channels. This continues the process of building the hidden binary stream.",
        media_type='image',
        mode='encode',
        data={
            "index": int(p_index_1),
            "bit_index_start": 3,
            "r_orig": int(r1_orig), "r_orig_bin": get_binary_repr(r1_orig), "r_new": int(r1_new), "r_new_bin": get_binary_repr(r1_new), "bit_to_hide": int(bit_r1),
            "g_orig": int(g1_orig), "g_orig_bin": get_binary_repr(g1_orig), "g_new": int(g1_new), "g_new_bin": get_binary_repr(g1_new), "bit_to_hide_g": int(bit_g1),
            "b_orig": int(b1_orig), "b_orig_bin": get_binary_repr(b1_orig), "b_new": int(b1_new), "b_new_bin": get_binary_repr(b1_orig), "bit_to_hide_b": int(bit_b1),
        }
    ))
    
    # Step 5: Continuous Modification / Pixels Skipped (Final Stats)
    
    pixels_modified_count = (message_length_bits + 2) // 3
    pixels_unchanged_count = total_pixels - pixels_modified_count
    
    steps.append(StegoVisualizationStep(
        step_title="Step 5: Continuous LSB Modification / Unchanged Pixels",
        description=f"The LSB operation repeats for the remaining **{message_length_bits - 6} bits**. Once the message bits run out ({pixels_modified_count} pixels used), the remaining {pixels_unchanged_count} pixels are copied without modification.",
        media_type='image',
        mode='encode',
        data={
            "pixels_modified": int(pixels_modified_count),
            "pixels_unchanged": int(pixels_unchanged_count),
            "total_pixels": int(total_pixels),
            "message_bits_count": int(message_length_bits),
            "next_index": 2,
            "is_modified": True 
        }
    ))

    # Step 6: Final Summary
    steps.append(StegoVisualizationStep(
        step_title="Step 6: Final Summary and Download",
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
    """Generates a step-by-step visualization for LSB image decoding."""
    steps = []
    
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise ValueError("Could not open image or it's not a valid format.")

    pixels = list(img.getdata())
    delimiter = "####"
    binary_delimiter = ''.join(get_binary_repr(ord(char)) for char in delimiter)
    total_pixels = len(pixels)

    # Step 1: Start Decoding (Show initial pixel data)
    r0, g0, b0 = pixels[0]
    
    steps.append(StegoVisualizationStep(
        step_title="Step 1: Start Decoding - Initial Pixel Data",
        description="Decoding begins by reading the first pixel's color channels. We extract the Last Significant Bit (LSB) from each channel (R, G, B) and assemble the secret binary stream.",
        media_type='image',
        mode='decode',
        data={
            "index": 0,
            "r_orig": int(r0), "r_orig_bin": get_binary_repr(r0),
            "g_orig": int(g0), "g_orig_bin": get_binary_repr(g0),
            "b_orig": int(b0), "b_orig_bin": get_binary_repr(b0),
            "delimiter_bits": binary_delimiter
        }
    ))
    
    # Step 2: LSB Extraction Matrix (Pixel 0)
    
    r_orig, g_orig, b_orig = pixels[0]
    
    steps.append(StegoVisualizationStep(
        step_title="Step 2: LSB Extraction Matrix (Pixel 0)",
        description=f"Extracting the **first 3 bits** from Pixel (0, 0) using the operation **Value & 1**. The extracted bits are **{r_orig & 1}, {g_orig & 1}, {b_orig & 1}**.",
        media_type='image',
        mode='decode',
        data={
            "index": 0,
            "bit_index_start": 0,
            "r_orig": int(r_orig), "r_orig_bin": get_binary_repr(r_orig), "r_new": int(r_orig), "r_new_bin": get_binary_repr(r_orig), "bit_to_hide": int(r_orig & 1),
            "g_orig": int(g_orig), "g_orig_bin": get_binary_repr(g_orig), "g_new": int(g_orig), "g_new_bin": get_binary_repr(g_orig), "bit_to_hide_g": int(g_orig & 1),
            "b_orig": int(b_orig), "b_orig_bin": get_binary_repr(b_orig), "b_new": int(b_orig), "b_new_bin": get_binary_repr(b_orig), "bit_to_hide_b": int(b_orig & 1),
        }
    ))
    
    # Step 3: First Byte Assembly (Requires Pixel 1 data)
    
    binary_message_full = ""
    pixels_used_to_form_byte = 0
    for idx in range(len(pixels)):
        r, g, b = pixels[idx]
        for val in [r, g, b]:
            binary_message_full += str(val & 1)
            if len(binary_message_full) >= 8: break
        pixels_used_to_form_byte = idx + 1
        if len(binary_message_full) >= 8: break
        
    first_byte = binary_message_full[:8]
    first_char = chr(int(first_byte, 2)) if len(first_byte) == 8 else '...'
    
    steps.append(StegoVisualizationStep(
        step_title="Step 3: First Byte Assembly and Character Conversion",
        description=f"Extraction continues across channels until **8 bits** are assembled (spanning {pixels_used_to_form_byte} pixels). These 8 bits ({first_byte}) are converted to the first character: '{first_char}'.",
        media_type='image',
        mode='decode',
        data={
            "index": int(pixels_used_to_form_byte - 1),
            "units_used": pixels_used_to_form_byte * 3,
            "first_byte": first_byte,
            "first_char": first_char,
            "binary_stream": binary_message_full,
            "delimiter_status": "NOT YET FOUND"
        }
    ))
    
    # Step 4: LSB Extraction Matrix (Pixel 1 - Next 3 bits)
    p_index_1 = pixels_used_to_form_byte 
    
    r1_orig, g1_orig, b1_orig = pixels[p_index_1] if p_index_1 < total_pixels else (0, 0, 0)
    
    steps.append(StegoVisualizationStep(
        step_title="Step 4: LSB Extraction Matrix (Pixel 1 Preview)",
        description=f"Extraction continues with the next pixel to assemble the second character. The LSBs extracted from Pixel 1 R, G, and B are **{(r1_orig & 1)}, {(g1_orig & 1)}, {(b1_orig & 1)}**.",
        media_type='image',
        mode='decode',
        data={
            "index": int(p_index_1),
            "bit_index_start": 3,
            "r_orig": int(r1_orig), "r_orig_bin": get_binary_repr(r1_orig), "r_new": int(r1_orig), "r_new_bin": get_binary_repr(r1_orig), "bit_to_hide": int(r1_orig & 1),
            "g_orig": int(g1_orig), "g_orig_bin": get_binary_repr(g1_orig), "g_new": int(g1_orig), "g_new_bin": get_binary_repr(g1_orig), "bit_to_hide_g": int(g1_orig & 1),
            "b_orig": int(b1_orig), "b_orig_bin": get_binary_repr(b1_orig), "b_new": int(b1_orig), "b_new_bin": get_binary_repr(b1_orig), "bit_to_hide_b": int(b1_orig & 1),
        }
    ))
    
    # Step 5: Continuous Search
    
    final_message_from_decode = decode_message(image_bytes)
    message_bits_count = len(final_message_from_decode + delimiter) * 8 if final_message_from_decode else 0
    pixels_checked_for_viz = (message_bits_count + 2) // 3
    
    pixels_checked_for_viz = min(pixels_checked_for_viz, total_pixels, 100) 
    
    steps.append(StegoVisualizationStep(
        step_title="Step 5: Delimiter Search and Continuous Extraction",
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
    
    # Step 6: Final Decoded Result
    
    steps.append(StegoVisualizationStep(
        step_title="Step 6: Final Decoded Result",
        description="The message bits before the delimiter are assembled and converted back to the final secret text.",
        media_type='image',
        mode='decode',
        data={
            "final_message": final_message_from_decode,
        }
    ))
    
    return steps
