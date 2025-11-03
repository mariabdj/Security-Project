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
        return np.binary_repr(val, width=16)
    except:
        return "N/A"

# --- Steganography Functional Implementations (Existing) ---

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


# --- [NEW] Steganography Visualization Logic (MAX DETAIL) ---

def _generate_lsb_sample_step(steps: List[StegoVisualizationStep], sample: int, bit_index: int, binary_message: str, current_sample_index: int, total_samples: int, mode: str):
    """Generates detailed LSB steps for one audio sample."""
    sample_orig = sample
    
    if mode == 'encode':
        if bit_index >= len(binary_message): return
        bit_to_hide = int(binary_message[bit_index])
        
        # Calculate intermediate and final values
        sample_temp = sample_orig & ~1
        sample_new = sample_temp | bit_to_hide
        
        steps.append(StegoVisualizationStep(
            step_title=f"Step {len(steps) + 1}: LSB Modification Matrix (Sample {current_sample_index})",
            description=f"Hiding **Bit {bit_index}** ('{bit_to_hide}') in Sample {current_sample_index}. The operation **(Value & ~1) | Bit** both clears the LSB and inserts the new secret bit.",
            media_type='audio',
            mode='encode',
            data={
                "index": int(current_sample_index),
                "bit_index_start": int(bit_index),
                "sample_orig": int(sample_orig), 
                "sample_orig_bin": get_binary_repr_16bit(sample_orig),
                "sample_new": int(sample_new), 
                "sample_new_bin": get_binary_repr_16bit(sample_new),
                "bit_to_hide": int(bit_to_hide)
            }
        ))
    
    elif mode == 'decode':
        bit_extracted = sample_orig & 1
        steps.append(StegoVisualizationStep(
            step_title=f"Step {len(steps) + 1}: LSB Extraction Matrix (Sample {current_sample_index})",
            description=f"Targeting Sample {current_sample_index}. The simple operation **(Value & 1)** isolates the LSB. Extracted bit: **{bit_extracted}**.",
            media_type='audio',
            mode='decode',
            data={
                "index": int(current_sample_index),
                "bit_index_start": int(bit_index),
                "bit_extracted": int(bit_extracted),
                "sample_orig": int(sample_orig), 
                "sample_orig_bin": get_binary_repr_16bit(sample_orig),
                # For decoding matrix, new_val and new_bin are the same as orig_val/bin
                "sample_new": int(sample_orig), 
                "sample_new_bin": get_binary_repr_16bit(sample_orig),
                "bit_to_hide": int(bit_extracted) # Reused field for matrix column
            }
        ))


def visualize_encode_lsb_audio(audio_bytes: bytes, secret_message: str) -> List[StegoVisualizationStep]:
    """Generates a step-by-step visualization for LSB audio encoding."""
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

    # Step 1: Message to Bits & Capacity Check
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

    # --- Step 2 & 3: LSB Modification Matrix (Sample 0 & 1) ---
    _generate_lsb_sample_step(steps, flat_data[0], 0, binary_message, 0, total_samples, 'encode')
    _generate_lsb_sample_step(steps, flat_data[1], 1, binary_message, 1, total_samples, 'encode')
    
    # Step 4: First Character Assembly
    first_byte_length = min(8, message_length_bits)
    first_byte_binary = binary_message[:first_byte_length]
    
    steps.append(StegoVisualizationStep(
        step_title="Step 4: Hiding the First Byte",
        description=f"It takes {first_byte_length} consecutive samples (0 to {first_byte_length-1}) to hide the first 8 bits (one character) of the message. The process continues until the first character is concealed.",
        media_type='audio',
        mode='encode',
        data={
            "bit_count": int(first_byte_length),
            "units_used": int(first_byte_length),
            "binary_stream": first_byte_binary,
            "first_char": chr(int(first_byte_binary, 2)) if first_byte_length >= 8 else None
        }
    ))
    
    # Step 5: Processing Subsequent Samples (Continuous)
    samples_modified_count = message_length_bits
    samples_unchanged_count = total_samples - samples_modified_count
    
    steps.append(StegoVisualizationStep(
        step_title="Step 5: Processing Subsequent Samples Modification",
        description=f"The LSB modification continues until the entire message is hidden. Once complete, the remaining {samples_unchanged_count} samples are copied without modification.",
        media_type='audio',
        mode='encode',
        data={
            "samples_modified": int(samples_modified_count),
            "samples_unchanged": int(samples_unchanged_count),
            "total_samples": int(total_samples),
            "next_index": int(samples_modified_count),
            "message_bits_count": int(message_length_bits),
        }
    ))

    # Step 6: Final Stats
    steps.append(StegoVisualizationStep(
        step_title="Step 6: Final Summary and Download",
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
    """Generates a step-by-step visualization for LSB audio decoding."""
    steps = []
    
    try:
        samplerate, data = wavfile.read(io.BytesIO(audio_bytes))
    except Exception as e:
        raise ValueError(f"Could not read audio file: {e}")

    flat_data = data.flatten()
    total_samples = len(flat_data)
    delimiter = "####"
    binary_delimiter = ''.join(format(ord(char), '08b') for char in delimiter)

    # Step 1: Start Decoding (Show initial sample data)
    s0 = flat_data[0]
    
    steps.append(StegoVisualizationStep(
        step_title="Step 1: Start Decoding - Initial Sample Data",
        description="Decoding begins by reading the first audio sample. We extract the Last Significant Bit (LSB) from each sample and assemble the secret binary stream.",
        media_type='audio',
        mode='decode',
        data={
            "index": int(0),
            "sample_orig": int(s0),
            "sample_orig_bin": get_binary_repr_16bit(s0),
            "delimiter_bits": binary_delimiter
        }
    ))
    
    # Step 2 & 3: LSB Extraction Matrix (Sample 0 & 1)
    _generate_lsb_sample_step(steps, flat_data[0], 0, "", 0, total_samples, 'decode')
    _generate_lsb_sample_step(steps, flat_data[1], 1, "", 1, total_samples, 'decode')
    
    # Step 4: First Character Assembly
    binary_message_full = ""
    samples_used = 0
    for idx in range(len(flat_data)):
        binary_message_full += str(flat_data[idx] & 1)
        samples_used += 1
        if len(binary_message_full) >= 8: break

    first_byte = binary_message_full[:8]
    first_char = chr(int(first_byte, 2)) if len(first_byte) == 8 else '...'
    
    steps.append(StegoVisualizationStep(
        step_title="Step 4: First Character Assembled (8 Bits)",
        description=f"8 consecutive bits are extracted from the first 8 samples. These 8 bits ({first_byte}) form the first character: '{first_char}'.",
        media_type='audio',
        mode='decode',
        data={
            "units_used": int(samples_used),
            "first_byte": first_byte,
            "first_char": first_char,
            "binary_stream": binary_message_full,
            "delimiter_status": "NOT YET FOUND"
        }
    ))
    
    # Step 5: Continuous Search
    
    final_message_from_decode = decode_message(audio_bytes)
    message_bits_count = len(final_message_from_decode + delimiter) * 8 if final_message_from_decode else 0
    samples_checked_for_viz = message_bits_count
    
    # Clamp to prevent excessive iteration in case of very large files
    samples_checked_for_viz = min(samples_checked_for_viz, total_samples, 1000) 
    
    steps.append(StegoVisualizationStep(
        step_title="Step 5: Delimiter Search and Continuous Extraction",
        description=f"The extraction continues sample by sample. The assembled stream is checked every 8 bits to detect the delimiter '####' and stop the process.",
        media_type='audio',
        mode='decode',
        data={
            "samples_modified": int(samples_checked_for_viz),
            "samples_unchanged": int(total_samples - samples_checked_for_viz),
            "index": int(samples_checked_for_viz),
            "total_samples": int(total_samples),
            "message_bits_count": int(message_bits_count),
            "delimiter_status": "Checking...",
        }
    ))
    
    # Step 6: Final Decoded Result
    
    steps.append(StegoVisualizationStep(
        step_title="Step 6: Final Decoded Result",
        description="The message bits before the delimiter are assembled and converted back to the final secret text.",
        media_type='audio',
        mode='decode',
        data={
            "final_message": final_message_from_decode,
        }
    ))
    
    return steps
