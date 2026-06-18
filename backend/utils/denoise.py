import cv2
import numpy as np
import io

def denoise_image_bytes(b: bytes) -> bytes:
    arr = np.frombuffer(b, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image bytes")
    denoised = cv2.fastNlMeansDenoisingColored(img, None, h=10, hColor=10, templateWindowSize=7, searchWindowSize=21)
    kernel = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
    sharpened = cv2.filter2D(denoised, -1, kernel)
    _, out = cv2.imencode('.jpg', sharpened)
    return out.tobytes()
