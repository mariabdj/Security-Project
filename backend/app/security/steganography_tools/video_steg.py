# backend/app/security/steganography_tools/video_steg.py

# A unique delimiter to mark the start of our hidden message
DELIMITER = b"##SECRET_MESSAGE_START##"

def encode_message(video_bytes: bytes, secret_message: str) -> bytes:
    """
    Hides a secret message by appending it to the end of a video file.
    """
    # Convert the secret message to bytes
    message_bytes = secret_message.encode('utf-8')
    
    # Append the delimiter and the message to the original video bytes
    encoded_video_bytes = video_bytes + DELIMITER + message_bytes
    return encoded_video_bytes


def decode_message(video_bytes: bytes) -> str:
    """
    Extracts a secret message from the end of a video file.
    """
    try:
        # Split the video bytes by our delimiter
        parts = video_bytes.split(DELIMITER)
        
        # If the split resulted in more than one part, the message is the last part
        if len(parts) > 1:
            message_bytes = parts[-1]
            return message_bytes.decode('utf-8')
        else:
            # Delimiter was not found
            return ""
            
    except Exception:
        # If decoding fails or any other error occurs
        return ""