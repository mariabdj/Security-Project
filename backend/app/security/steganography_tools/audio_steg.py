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
    flat_data = data.flatten()
    data_index = 0

    for i in range(len(flat_data)):
        if data_index < len(binary_message):
            # Get the current audio sample
            sample = flat_data[i]
            # Change the least significant bit
            new_sample = (sample & 0b1111111111111110) | int(binary_message[data_index])
            flat_data[i] = new_sample
            data_index += 1
        else:
            break
    
    # Reshape the data back to its original shape
    encoded_data = flat_data.reshape(data.shape)

    # Write the new WAV data to a byte buffer
    byte_io = io.BytesIO()
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
        binary_data += str(sample & 1)
        if binary_delimiter in binary_data:
            break
            
    # Find the delimiter and extract the message part
    try:
        message_part = binary_data.split(binary_delimiter, 1)[0]
    except IndexError:
        return "" # Delimiter not found

    # Convert binary back to string
    secret_message = ""
    for i in range(0, len(message_part), 8):
        byte = message_part[i:i+8]
        if len(byte) == 8:
            secret_message += chr(int(byte, 2))
            
    return secret_message