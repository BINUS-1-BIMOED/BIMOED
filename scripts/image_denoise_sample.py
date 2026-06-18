import cv2
import os
import numpy as np

INPUT = "data/sample_upload.jpg"
OUTPUT = "output/sample_upload_denoised.jpg"

img = cv2.imread(INPUT)
if img is None:
    print(f"Sample input {INPUT} not found, skipping denoise sample")
else:
    denoised = cv2.fastNlMeansDenoisingColored(img, None, h=10, hColor=10, templateWindowSize=7, searchWindowSize=21)
    kernel = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
    sharpened = cv2.filter2D(denoised, -1, kernel)
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    cv2.imwrite(OUTPUT, sharpened)
    print("Denoise sample written ->", OUTPUT)
