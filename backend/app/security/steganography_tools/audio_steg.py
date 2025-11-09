# backend/app/security/steganography_tools/audio_steg.py
import io
from scipy.io import wavfile
import numpy as np
from typing import List
from ...models.schemas import StegoVisualizationStep

# --- Utility Functions for LSB ---

def get_new_sample(orig_val: int, bit_to_hide: int) -> int:
    """Helper to calculate new sample value for LSB encoding (using ~1 mask)."""
    return (orig_val & ~1) | bit_to_hide

def get_binary_repr_16bit(val: int) -> str:
    """Helper to get 16-bit binary representation (important for signed int16)."""
    try:
        # Use numpy.binary_repr for correct signed 16-bit representation
        return np.binary_repr(val, width=16)
    except Exception:
        # Fallback for any unexpected errors
        return format(val & 0xFFFF, '016b')


# --- Steganography Functional Implementations (Existing/Unchanged) ---

def encode_message(audio_bytes: bytes, secret_message: str) -> bytes:
    """Hides a secret message within a WAV audio file using LSB."""
    try:
        samplerate, data = wavfile.read(io.BytesIO(audio_bytes))
    except Exception as e:
        raise ValueError(f"Could not read WAV file. Is it a valid .wav format? Error: {e}")

    encoded_message = secret_message + "####"
    binary_message = ''.join(format(ord(char), '08b') for char in encoded_message)

    if len(binary_message) > data.size:
        raise ValueError("Message is too long to be hidden in this audio file.")

    flat_data = data.flatten().copy()
    data_index = 0

    for i in range(len(flat_data)):
        if data_index < len(binary_message):
            sample = flat_data[i]
            new_sample = get_new_sample(sample, int(binary_message[data_index]))
            flat_data[i] = new_sample
            data_index += 1
        else:
            break
    
    encoded_data = flat_data.reshape(data.shape)

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
        binary_data += str(sample & 1)
        
        if binary_data.endswith(binary_delimiter):
            break
            
    message_part = binary_data.split(binary_delimiter, 1)[0]
    
    if not message_part:
        return ""

    secret_message = ""
    for i in range(0, len(message_part), 8):
        byte = message_part[i:i+8]
        if len(byte) == 8:
            try:
                secret_message += chr(int(byte, 2))
            except ValueError:
                pass
            
    return secret_message


# --- [MODIFIED] Steganography Visualization Logic ---

def _generate_lsb_sample_step(sample_index: int, sample_val: int, bit_index: int, binary_message: str, mode: str) -> StegoVisualizationStep:
    """
    [MODIFIED HELPER] Generates detailed LSB steps for one audio sample.
    """
    sample_orig = int(sample_val) # Ensure it's a standard int
    is_encode = mode == 'encode'
    data = {
        "index": int(sample_index),
        "bit_index_start": int(bit_index),
        "sample_orig": sample_orig, 
        "sample_orig_bin": get_binary_repr_16bit(sample_orig),
    }
    
    if is_encode:
        if bit_index >= len(binary_message):
             # This case shouldn't be hit if called correctly, but good for safety
             bit_to_hide = sample_orig & 1
        else:
             bit_to_hide = int(binary_message[bit_index])
        
        sample_new = get_new_sample(sample_orig, bit_to_hide)
        
        data.update({
            "sample_new": int(sample_new), 
            "sample_new_bin": get_binary_repr_16bit(sample_new),
            "bit_to_hide": int(bit_to_hide)
        })
        description=f"Hiding **Bit {bit_index}** ('{bit_to_hide}') in Sample {sample_index}. The operation **(Value & ~1) | Bit** clears the LSB and inserts the new bit."
    
    else: # Decode
        bit_extracted = sample_orig & 1
        data.update({
            "bit_extracted": int(bit_extracted),
            "sample_new": sample_orig, # For JS consistency
            "sample_new_bin": get_binary_repr_16bit(sample_orig),
            "bit_to_hide": int(bit_extracted) # Reuse field for matrix
        })
        description=f"Targeting Sample {sample_index}. The operation **(Value & 1)** isolates the LSB. Extracted bit: **{bit_extracted}**."

    return StegoVisualizationStep(
        step_title=f"LSB {mode.capitalize()} Matrix (Sample {sample_index})",
        description=description,
        media_type='audio',
        mode=mode,
        data=data
    )


def visualize_encode_lsb_audio(audio_bytes: bytes, secret_message: str) -> List[StegoVisualizationStep]:
    """[MODIFIED] Generates a step-by-step visualization for LSB audio encoding."""
    steps = []
    
    try:
        samplerate, data = wavfile.read(io.BytesIO(audio_bytes))
    except Exception as e:
        raise ValueError(f"Could not read audio file: {e}")

    flat_data = data.flatten().copy()
    total_samples = len(flat_data)
    delimiter = "####"
    
    encoded_message = secret_message + delimiter
    binary_message = ''.join(format(ord(char), '08b') for char in encoded_message)
    message_length_bits = len(binary_message)

    # --- Step 1: Message to Bits & Capacity Check (Unchanged) ---
    steps.append(StegoVisualizationStep(
        step_title="Step 1: Message Conversion and Capacity Check",
        description=f"The message '{secret_message}' + delimiter is {message_length_bits} bits. The audio file has {total_samples} samples. Capacity is 1 bit per sample (total {total_samples} bits).",
        media_type='audio',
        mode='encode',
        data={
            "capacity": int(total_samples),
            "message_bits": binary_message,
            "message_data": [{'char': c, 'ascii': ord(c), 'binary': format(ord(c), '08b')} for c in secret_message] + [{'char': delimiter, 'ascii': 'N/A', 'binary': ''.join(format(ord(c), '08b') for c in delimiter)}],
            "is_capacity_ok": message_length_bits <= total_samples
        }
    ))
    
    if message_length_bits > total_samples:
        return steps

    # --- [NEW] Step 2, 3, 4: LSB Modification Matrix (Sample 0, 1, 2) ---
    for i in range(3):
         if i < total_samples and i < message_length_bits:
             steps.append(_generate_lsb_sample_step(
                 sample_index=i,
                 sample_val=flat_data[i],
                 bit_index=i,
                 binary_message=binary_message,
                 mode='encode'
             ))
    
    # --- [MODIFIED] Step 5: First Character Assembly ---
    first_byte_length = min(8, message_length_bits)
    first_byte_binary = binary_message[:first_byte_length]
    first_char_code = int(first_byte_binary, 2) if first_byte_length >= 8 else 0
    
    steps.append(StegoVisualizationStep(
        step_title="Step 5: Hiding the First Byte",
        description=f"It takes {first_byte_length} consecutive samples (0 to {first_byte_length-1}) to hide the first 8 bits ('{chr(first_char_code)}') of the message.",
        media_type='audio',
        mode='encode',
        data={
            "bit_count": int(first_byte_length),
            "units_used": int(first_byte_length),
            "binary_stream": first_byte_binary,
            "first_char": chr(first_char_code) if first_byte_length >= 8 else None
        }
    ))
    
    # --- [MODIFIED] Step 6: Continuous Modification ---
    samples_modified_count = message_length_bits
    samples_unchanged_count = total_samples - samples_modified_count
    
    steps.append(StegoVisualizationStep(
        step_title="Step 6: Continuous LSB Modification",
        description=f"The LSB modification continues until the entire message is hidden. Once complete, the remaining {samples_unchanged_count} samples are copied without modification.",
        media_type='audio',
        mode='encode',
        data={
            "samples_modified": int(samples_modified_count),
            "samples_unchanged": int(samples_unchanged_count),
            "total_samples": int(total_samples),
            "next_index": int(first_byte_length),
            "message_bits_count": int(message_length_bits),
        }
    ))

    # --- Step 7: Final Stats ---
    steps.append(StegoVisualizationStep(
        step_title="Step 7: Final Summary and Download",
        description=f"The entire message has been hidden across the first {samples_modified_count} samples. The file is saved as lossless WAV.",
        media_type='audio',
        mode='encode',
        data={
            "samples_modified": int(samples_modified_count),
            "samples_unchanged": int(samples_unchanged_count),
            "total_samples": int(total_samples),
            "message_bits_count": int(message_length_bits),
        }
    ))

    return steps

def visualize_decode_lsb_audio(audio_bytes: bytes) -> List[StegoVisualizationStep]:
    """[MODIFIED] Generates a step-by-step visualization for LSB audio decoding."""
    steps = []
    
    try:
        samplerate, data = wavfile.read(io.BytesIO(audio_bytes))
    except Exception as e:
        raise ValueError(f"Could not read audio file: {e}")

    flat_data = data.flatten()
    total_samples = len(flat_data)
    delimiter = "####"
    binary_delimiter = ''.join(format(ord(char), '08b') for char in delimiter)

    # --- Step 1: Start Decoding (Show initial sample data) ---
    steps.append(StegoVisualizationStep(
        step_title="Step 1: Start Decoding - Initial Sample Data",
        description="Decoding begins by reading the first audio sample. We extract the Last Significant Bit (LSB) from each sample and assemble the secret binary stream.",
        media_type='audio',
        mode='decode',
        data={
            "index": int(0),
            "sample_orig": int(flat_data[0]),
            "sample_orig_bin": get_binary_repr_16bit(int(flat_data[0])),
            "delimiter_bits": binary_delimiter
        }
    ))
    
    # --- [NEW] Step 2, 3, 4: LSB Extraction Matrix (Sample 0, 1, 2) ---
    binary_message_full = ""
    for i in range(3):
        if i < total_samples:
            sample_val = int(flat_data[i])
            steps.append(_generate_lsb_sample_step(
                 sample_index=i,
                 sample_val=sample_val,
                 bit_index=i,
                 binary_message="",
                 mode='decode'
             ))
            binary_message_full += str(sample_val & 1)
    
    # --- [MODIFIED] Step 5: First Character Assembly ---
    binary_stream_fuller = ""
    samples_used = 0
    for idx in range(min(8, total_samples)):
        binary_stream_fuller += str(int(flat_data[idx]) & 1)
        samples_used += 1

    first_byte = binary_stream_fuller[:8]
    first_char = chr(int(first_byte, 2)) if len(first_byte) == 8 else '...'
    
    steps.append(StegoVisualizationStep(
        step_title="Step 5: First Character Assembled (8 Bits)",
        description=f"8 consecutive bits are extracted from the first 8 samples. These 8 bits ({first_byte}) form the first character: '{first_char}'.",
        media_type='audio',
        mode='decode',
        data={
            "units_used": int(samples_used),
            "first_byte": first_byte,
            "first_char": first_char,
            "binary_stream": binary_stream_fuller,
            "delimiter_status": "NOT YET FOUND"
        }
    ))
    
    # --- [MODIFIED] Step 6: Continuous Search ---
    final_message_from_decode = decode_message(audio_bytes)
    message_bits_count = len(final_message_from_decode + delimiter) * 8 if final_message_from_decode else 0
    samples_checked_for_viz = min(message_bits_count, total_samples, 1000) # Clamp
    
    steps.append(StegoVisualizationStep(
        step_title="Step 6: Delimiter Search and Continuous Extraction",
        description=f"The extraction continues sample by sample. The assembled stream is checked every 8 bits to detect the delimiter '####' and stop the process.",
        media_type='audio',
        mode='decode',
        data={
            "samples_modified": int(samples_checked_for_viz), # Re-using 'modified' as 'checked'
            "samples_unchanged": int(total_samples - samples_checked_for_viz),
            "index": int(samples_checked_for_viz),
            "total_samples": int(total_samples),
            "message_bits_count": int(message_bits_count),
            "delimiter_status": "Checking...",
        }
    ))
    
    # --- Step 7: Final Decoded Result ---
    steps.append(StegoVisualizationStep(
        step_title="Step 7: Final Decoded Result",
        description="The message bits before the delimiter are assembled and converted back to the final secret text.",
        media_type='audio',
        mode='decode',
        data={
            "final_message": final_message_from_decode,
        }
    ))
    
    return steps