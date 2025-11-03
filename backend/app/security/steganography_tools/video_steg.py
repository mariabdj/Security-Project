# backend/app/security/steganography_tools/video_steg.py
from typing import List
from ...models.schemas import StegoVisualizationStep

# A unique delimiter to mark the start of our hidden message
DELIMITER = b"##SECRET_MESSAGE_START##"
DELIMITER_STR = "##SECRET_MESSAGE_START##"

# --- Steganography Functional Implementations (Existing) ---

def encode_message(video_bytes: bytes, secret_message: str) -> bytes:
    """Hides a secret message by appending it to the end of a video file."""
    message_bytes = secret_message.encode('utf-8')
    encoded_video_bytes = video_bytes + DELIMITER + message_bytes
    return encoded_video_bytes


def decode_message(video_bytes: bytes) -> str:
    """Extracts a secret message from the end of a video file."""
    try:
        parts = video_bytes.split(DELIMITER)
        
        if len(parts) > 1:
            message_bytes = parts[-1]
            return message_bytes.decode('utf-8')
        else:
            return ""
            
    except Exception:
        return ""

# --- [NEW] Steganography Visualization Logic (MAX DETAIL) ---

def visualize_encode_append_video(video_bytes: bytes, secret_message: str) -> List[StegoVisualizationStep]:
    """Generates a step-by-step visualization for Append video encoding."""
    steps = []
    
    original_size = len(video_bytes)
    message_bytes = secret_message.encode('utf-8')
    message_size = len(message_bytes)
    delimiter_size = len(DELIMITER)
    total_new_size = original_size + delimiter_size + message_size
    
    # Hex for visualization
    def get_hex_prefix(b, length=16):
        return b[:length].hex().upper()
    def get_hex_suffix(b, length=10):
        return b[-length:].hex().upper()
    
    # Step 1: Prepare Message and Delimiter
    steps.append(StegoVisualizationStep(
        step_title="Step 1: Message and Delimiter Preparation",
        description=f"The secret message is converted to **{message_size} bytes** (UTF-8). The unique **{delimiter_size}-byte** delimiter is used to mark the start of the hidden data.",
        media_type='video',
        mode='encode',
        data={
            "secret_message": secret_message,
            "message_size": int(message_size),
            "delimiter": DELIMITER_STR,
            "delimiter_size": int(delimiter_size),
            "message_bytes_prefix": get_hex_prefix(message_bytes, 10),
            "file_header_view": get_hex_prefix(video_bytes, 40),
        }
    ))

    # Step 2: Original Video File Structure
    steps.append(StegoVisualizationStep(
        step_title="Step 2: Original Video File Structure (Player Stop Point)",
        description=f"The cover file has a size of **{original_size} bytes**. Its internal header indicates the media stream ends at **Byte 0x{(original_size - 1):X}**.",
        media_type='video',
        mode='encode',
        data={
            "original_size": int(original_size),
            "file_header_view": get_hex_prefix(video_bytes, 80), 
        }
    ))
    
    # Step 3: Append Delimiter
    steps.append(StegoVisualizationStep(
        step_title="Step 3: Concatenating the Binary Delimiter",
        description=f"The {delimiter_size}-byte binary delimiter is immediately concatenated to the end of the original video stream. The data is now appended starting at address **0x{original_size:X}**.",
        media_type='video',
        mode='encode',
        data={
            "original_size": int(original_size),
            "delimiter_bytes_hex": DELIMITER.hex().upper(),
            "new_end_delimiter": int(original_size + delimiter_size),
            "total_new_size": int(total_new_size)
        }
    ))
    
    # Step 4: Append Message
    steps.append(StegoVisualizationStep(
        step_title="Step 4: Appending the Secret Message Bytes",
        description=f"The **{message_size} bytes** of the secret message are added directly after the delimiter. The total file size increases to **{total_new_size} bytes**.",
        media_type='video',
        mode='encode',
        data={
            "original_size": int(original_size),
            "delimiter_bytes_hex": DELIMITER.hex().upper(),
            "message_size": int(message_size),
            "total_new_size": int(total_new_size),
            "message_bytes_prefix": get_hex_prefix(message_bytes, 10),
            "message_bytes_suffix": get_hex_suffix(message_bytes, 10)
        }
    ))

    # Step 5: Player Perspective
    steps.append(StegoVisualizationStep(
        step_title="Step 5: Video Player Perspective (Stealth)",
        description=f"A video player will ignore the appended data ({message_size + delimiter_size} bytes) because it only processes up to the original file size. This makes the message invisible during normal playback.",
        media_type='video',
        mode='encode',
        data={
            "original_size": int(original_size),
            "hidden_size": int(message_size + delimiter_size),
            "vulnerability": "The main vulnerability is the easily detectable increase in the file's overall size."
        }
    ))

    # Step 6: Final Summary
    steps.append(StegoVisualizationStep(
        step_title="Step 6: Final Summary and Download",
        description=f"The message is successfully hidden. This Append method is instant and works across all file formats, but relies on the lack of file size comparison for secrecy.",
        media_type='video',
        mode='encode',
        data={
            "original_size": int(original_size),
            "total_new_size": int(total_new_size),
            "message_size": int(message_size),
        }
    ))
    
    return steps

def visualize_decode_append_video(video_bytes: bytes) -> List[StegoVisualizationStep]:
    """Generates a step-by-step visualization for Append video decoding."""
    steps = []
    
    file_size = len(video_bytes)
    DELIMITER_HEX = DELIMITER.hex().upper()
    
    # Step 1: Start Decoding - Search for Delimiter
    steps.append(StegoVisualizationStep(
        step_title="Step 1: Start Decoding - Scanning for Delimiter",
        description=f"The decoder scans the entire file stream ({file_size} Bytes) for the unique byte sequence that represents the delimiter: **{DELIMITER_STR}**.",
        media_type='video',
        mode='decode',
        data={
            "file_size": int(file_size),
            "delimiter": DELIMITER_STR,
            "delimiter_hex": DELIMITER_HEX
        }
    ))
    
    # Simulate split
    parts = video_bytes.split(DELIMITER)
    is_found = len(parts) > 1
    
    if is_found:
        message_bytes = parts[-1]
        message_size = len(message_bytes)
        final_message = decode_message(video_bytes)
        
        # Step 2: Delimiter Found and Message Identified
        steps.append(StegoVisualizationStep(
            step_title="Step 2: Delimiter Found and Message Identified",
            description=f"The built-in split function successfully located the delimiter. The subsequent binary segment is identified as the hidden message (**{message_size} bytes**).",
            media_type='video',
            mode='decode',
            data={
                "message_size": int(message_size),
                "delimiter": DELIMITER_STR,
                "message_bytes_prefix": message_bytes[:10].hex().upper(),
                "message_bytes_suffix": message_bytes[-10:].hex().upper(),
                "is_found": True,
                "file_size": int(file_size)
            }
        ))
        
        # Step 3: Byte-to-Character Conversion
        steps.append(StegoVisualizationStep(
            step_title="Step 3: Byte-to-Character Conversion",
            description="The extracted message bytes are decoded using **UTF-8** encoding to reconstruct the original text characters, stopping after the last valid character.",
            media_type='video',
            mode='decode',
            data={
                "message_size": int(message_size),
                "final_message_length": int(len(final_message)),
                "final_message": final_message,
                "is_found": True
            }
        ))
        
    else:
         # Step 2 (Not Found)
         final_message = ""
         steps.append(StegoVisualizationStep(
            step_title="Step 2: Delimiter Not Found",
            description="The unique delimiter was not found in the file's binary stream after scanning the entire file. The decoding process stops here.",
            media_type='video',
            mode='decode',
            data={
                "is_found": False,
                "file_size": int(file_size),
                "delimiter": DELIMITER_STR,
            }
        ))
         
    # Step 4: Final Result
    steps.append(StegoVisualizationStep(
        step_title="Step 4: Final Decoded Result",
        description="The decoding process is complete.",
        media_type='video',
        mode='decode',
        data={
            "final_message": final_message,
        }
    ))
    
    return steps
