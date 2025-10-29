# backend/app/security/steganography_tools/image_steg.py
from PIL import Image
import io

def encode_message(image_bytes: bytes, secret_message: str) -> bytes:
    """
    Hides a secret message within an image using LSB steganography.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Could not open image. Is it a valid image format? Error: {e}")

    # Add a delimiter to know where the message ends
    encoded_message = secret_message + "####"
    binary_message = ''.join(format(ord(char), '08b') for char in encoded_message)
    
    width, height = img.size
    total_pixels = width * height
    
    # Check if the image is large enough to hold the message
    if len(binary_message) > total_pixels * 3: # 3 color channels per pixel
        raise ValueError("Message is too long to be hidden in this image.")

    data_index = 0
    img_data = iter(list(img.getdata()))

    new_pixels = []
    
    for pixel in img_data:
        # Get RGB values for the pixel
        r, g, b = pixel

        # Hide one bit in the Red channel
        if data_index < len(binary_message):
            r = (r & 0b11111110) | int(binary_message[data_index])
            data_index += 1
        
        # Hide one bit in the Green channel
        if data_index < len(binary_message):
            g = (g & 0b11111110) | int(binary_message[data_index])
            data_index += 1

        # Hide one bit in the Blue channel
        if data_index < len(binary_message):
            b = (b & 0b11111110) | int(binary_message[data_index])
            data_index += 1
            
        new_pixels.append((r, g, b))

        # If message is fully hidden, add remaining pixels unchanged
        if data_index >= len(binary_message):
            new_pixels.extend(list(img_data))
            break
            
    # Create a new image with the modified pixels
    new_img = Image.new("RGB", (width, height))
    new_img.putdata(new_pixels)
    
    # Save the new image to a byte buffer
    byte_arr = io.BytesIO()
    new_img.save(byte_arr, format='PNG') # PNG is lossless
    return byte_arr.getvalue()


def decode_message(image_bytes: bytes) -> str:
    """
    Reveals a secret message from an image.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise ValueError("Could not open image or it's not a valid format.")

    binary_data = ""
    delimiter = "####"
    binary_delimiter = ''.join(format(ord(char), '08b') for char in delimiter)

    for pixel in img.getdata():
        r, g, b = pixel
        
        # Extract the LSB from each color channel
        binary_data += str(r & 1)
        binary_data += str(g & 1)
        binary_data += str(b & 1)

        # Check if we have found the delimiter
        if binary_delimiter in binary_data:
            break
            
    # Find the delimiter and extract the message part
    message_part = binary_data.split(binary_delimiter, 1)[0]
    
    # Convert binary back to string
    secret_message = ""
    for i in range(0, len(message_part), 8):
        byte = message_part[i:i+8]
        if len(byte) == 8:
            secret_message += chr(int(byte, 2))
            
    return secret_message