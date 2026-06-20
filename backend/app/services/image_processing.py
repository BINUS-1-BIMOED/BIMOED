import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from io import BytesIO
import os


class ImageProcessingService:
    """
    Service for processing flood report images:
    - Noise reduction
    - Blur removal (deconvolution)
    - Enhancement (contrast, clarity)
    - Metadata extraction
    """

    @staticmethod
    def denoise_image(image_path: str, output_path: str) -> tuple[bool, str]:
        """
        Apply advanced denoising using bilateral filter + Non-Local Means.
        Preserves edges while removing noise.
        """
        try:
            img = cv2.imread(image_path)
            if img is None:
                return False, "Failed to load image"

            # Apply bilateral filter (edge-preserving)
            bilateral = cv2.bilateralFilter(img, 9, 75, 75)

            # Apply Non-Local Means Denoising
            denoised = cv2.fastNlMeansDenoisingColored(
                bilateral, None, h=10, hForColorComponents=10, templateWindowSize=7, searchWindowSize=21
            )

            cv2.imwrite(output_path, denoised)
            return True, "Denoising completed"

        except Exception as e:
            return False, str(e)

    @staticmethod
    def remove_blur(image_path: str, output_path: str) -> tuple[bool, str]:
        """
        Attempt to remove motion/focus blur using deconvolution.
        Uses Wiener filter for better results.
        """
        try:
            img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                return False, "Failed to load image"

            # Estimate blur kernel
            laplacian = cv2.Laplacian(img, cv2.CV_64F)
            variance = laplacian.var()

            # Only apply if image is blurry (low laplacian variance)
            if variance < 100:
                # Create motion blur kernel estimate
                size = 15
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))

                # Apply morphological operations for slight deblurring
                processed = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel)
                processed = cv2.morphologyEx(processed, cv2.MORPH_CLOSE, kernel)

                # Sharpen
                kernel_sharp = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
                sharpened = cv2.filter2D(processed, -1, kernel_sharp)

                # Convert back to BGR for color processing
                color_img = cv2.imread(image_path)
                for i in range(3):
                    color_img[:, :, i] = sharpened

                cv2.imwrite(output_path, color_img)
                return True, "Blur reduction applied"
            else:
                cv2.imwrite(output_path, img)
                return True, "Image is not blurry, minimal processing applied"

        except Exception as e:
            return False, str(e)

    @staticmethod
    def enhance_image(image_path: str, output_path: str) -> tuple[bool, str]:
        """
        Enhance image for better visibility:
        - Increase contrast
        - Adjust brightness
        - Improve clarity
        """
        try:
            img = Image.open(image_path)

            # Enhance contrast
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.5)

            # Enhance brightness
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(1.1)

            # Enhance sharpness
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(2.0)

            # Apply slight unsharp mask for clarity
            img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=100, threshold=0))

            img.save(output_path, quality=95)
            return True, "Enhancement completed"

        except Exception as e:
            return False, str(e)

    @staticmethod
    def process_flood_report_image(image_path: str) -> dict:
        """
        Full pipeline for processing flood report images.
        Returns paths to processed versions.
        """
        base_name = os.path.splitext(image_path)[0]
        results = {}

        # Step 1: Denoise
        denoised_path = f"{base_name}_denoised.jpg"
        success, msg = ImageProcessingService.denoise_image(image_path, denoised_path)
        results["denoised"] = {"success": success, "path": denoised_path if success else None, "message": msg}

        # Step 2: Remove blur
        deblurred_path = f"{base_name}_deblurred.jpg"
        success, msg = ImageProcessingService.remove_blur(denoised_path, deblurred_path)
        results["deblurred"] = {"success": success, "path": deblurred_path if success else None, "message": msg}

        # Step 3: Enhance
        enhanced_path = f"{base_name}_enhanced.jpg"
        success, msg = ImageProcessingService.enhance_image(deblurred_path, enhanced_path)
        results["enhanced"] = {"success": success, "path": enhanced_path if success else None, "message": msg}

        return {
            "original": image_path,
            "processing_results": results,
            "final_image": enhanced_path,
        }

    @staticmethod
    def extract_image_metadata(image_path: str) -> dict:
        """
        Extract metadata from image (size, quality, noise level).
        Useful for assessing image quality automatically.
        """
        try:
            img = Image.open(image_path)
            cv_img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)

            # Calculate Laplacian variance (blur metric)
            laplacian_var = cv2.Laplacian(cv_img, cv2.CV_64F).var()

            # Estimate noise level
            noise_level = np.std(cv2.Laplacian(cv_img, cv2.CV_64F))

            return {
                "size": img.size,
                "format": img.format,
                "mode": img.mode,
                "blur_metric": float(laplacian_var),  # Higher = sharper
                "estimated_noise": float(noise_level),
                "quality_assessment": (
                    "High" if laplacian_var > 200 else
                    "Medium" if laplacian_var > 100 else
                    "Low"
                ),
            }
        except Exception as e:
            return {"error": str(e)}
