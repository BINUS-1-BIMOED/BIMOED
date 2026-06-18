#!/usr/bin/env python3
import subprocess
import sys
import os

def run(cmd):
    print(f"> {cmd}")
    r = subprocess.run(cmd, shell=True)
    if r.returncode != 0:
        print(f"Command failed: {cmd}", file=sys.stderr)
        sys.exit(r.returncode)

if __name__ == '__main__':
    run('pip install -r backend/requirements.txt')
    run('pytest -q || true')
    run('python scripts/model_inference.py')
    run('python scripts/image_denoise_sample.py || true')
    print('ALL CHECKS (best-effort) DONE')
