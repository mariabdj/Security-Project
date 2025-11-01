# backend/app/security/steganography_tools/audio_steg.py
import io
from scipy.io import wavfile
import numpy as np

def encode_message(audio_bytes: bytes, secret_message: str) -> bytes:
    """Hides a secret message within a WAV audio file using LSB."""
    try:
        # Read the WAV file from bytes
        samplerate, data = wavfile.read(io.BytesIO(audio_bytes))
    except Exception as e:
        raise ValueError(f"Could not read WAV file. Is it a valid .wav format? Error: {e}")

    # Add a delimiter to know where the message ends
    encoded_message = secret_message + "####"
    binary_message = ''.join(format(ord(char), '08b') for char in encoded_message)

    if len(binary_message) > data.size:
        raise ValueError("Message is too long to be hidden in this audio file.")

    # Flatten the audio data array to make it easier to iterate over
    # We make a copy to ensure we are not modifying the original data view
    flat_data = data.flatten().copy()
    data_index = 0

    for i in range(len(flat_data)):
        if data_index < len(binary_message):
            # Get the current audio sample
            sample = flat_data[i]
            
            # --- [FIXED LINE] ---
            # The original mask (0b1111111111111110) was a large positive int (65534),
            # which caused an overflow when bitwise-ANDed with negative int16 samples.
            # Using ~1 (which is -2) provides the correct bitmask (1111...1110)
            # that works for both positive and negative signed integers.
            new_sample = (sample & ~1) | int(binary_message[data_index])
            # --- [END FIX] ---

            flat_data[i] = new_sample
            data_index += 1
        else:
            break
    
    # Reshape the data back to its original shape
    encoded_data = flat_data.reshape(data.shape)

    # Write the new WAV data to a byte buffer
    byte_io = io.BytesIO()
    # Ensure we write back using the original data type
    wavfile.write(byte_io, samplerate, encoded_data.astype(data.dtype))
    return byte_io.getvalue()


def decode_message(audio_bytes: bytes) -> str:
    """Reveals a secret message from a WAV audio file."""
    try:
        samplerate, data = wavfile.read(io.BytesIO(audio_bytes))
    except Exception:
        raise ValueError("Could not read WAV file or it's not a valid format.")

    flat_data = data.flatten()
    binary_data = ""
    delimiter = "####"
    binary_delimiter = ''.join(format(ord(char), '08b') for char in delimiter)

    for sample in flat_data:
        # Extract the LSB from each audio sample
        # (sample & 1) works correctly for both positive and negative ints
        binary_data += str(sample & 1)
        
        # Check if we have found the *entire* delimiter
        if binary_data.endswith(binary_delimiter):
            break
            
    # Find the delimiter and extract the message part
    message_part = binary_data.split(binary_delimiter, 1)[0]
    
    # Check if anything was found
    if not message_part:
        return "" # Return empty string if no message found before delimiter

    # Convert binary back to string
    secret_message = ""
    for i in range(0, len(message_part), 8):
        byte = message_part[i:i+8]
        if len(byte) == 8:
            try:
                secret_message += chr(int(byte, 2))
            except ValueError:
                # This can happen if the extracted bits are not valid ASCII/UTF-8
                pass # Ignore non-character byte
            
    return secret_message