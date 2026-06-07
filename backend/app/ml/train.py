"""Offline script to retrain the flood prediction model."""

from ml.flood_predictor import FloodPredictor


def main() -> None:
    from pathlib import Path

    from config import settings

    model_path = Path(settings.model_path)
    if model_path.exists():
        model_path.unlink()

    predictor = FloodPredictor()
    print(f"Model trained and saved to {predictor.model_path}")


if __name__ == "__main__":
    main()
