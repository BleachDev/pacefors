# NOT recommended, tesseract sucks

import subprocess
import numpy as np
import cv2
import pytesseract
import time
import os

STREAM = "twitch.tv/forsen"
QUALITY = "1080p60"

WIDTH = 1920 #852
HEIGHT = 1080 #480

CROP_WIDTH = int(WIDTH / 8.5)
CROP_WIDTH_S = int(WIDTH / 18)
CROP_HEIGHT = int(HEIGHT / 23)
CROP_HEIGHT_S = int(HEIGHT / 15)

DEBUG_DIR = "debug_frames"
os.makedirs(DEBUG_DIR, exist_ok=True)
1
streamlink = subprocess.Popen(
    ["streamlink", STREAM, QUALITY, "-O"],
    stdout=subprocess.PIPE
)

ffmpeg = subprocess.Popen(
    [
        "ffmpeg",
        "-loglevel", "error",
        "-i", "pipe:0",
        "-vf", "fps=1",
        "-f", "rawvideo",
        "-pix_fmt", "bgr24",
        "-"
    ],
    stdin=streamlink.stdout,
    stdout=subprocess.PIPE
)

frame_idx = 0

while True:
    raw = ffmpeg.stdout.read(WIDTH * HEIGHT * 3)
    if not raw:
        print("Stream ended")
        break

    print("Reading Frame " + str(frame_idx))
    frame = np.frombuffer(raw, np.uint8).reshape((HEIGHT, WIDTH, 3))

    # Crop top-right
    cropped = frame[CROP_HEIGHT_S:CROP_HEIGHT_S + CROP_HEIGHT, WIDTH - CROP_WIDTH:WIDTH-CROP_WIDTH_S]

    # Convert to HSV
    hsv = cv2.cvtColor(cropped, cv2.COLOR_BGR2HSV)

    # Red ranges (wraps around 0)
    lower_red1 = np.array([0, 100, 100])
    upper_red1 = np.array([45, 255, 255])
    mask = cv2.inRange(hsv, lower_red1, upper_red1)

    """lower_red2 = np.array([170, 100, 100])
    upper_red2 = np.array([180, 255, 255])
    mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)

    mask = cv2.bitwise_or(mask_red1, mask_red2)"""

    # Optional: remove small noise
    #mask = cv2.medianBlur(mask, 3)

    # Invert if needed
    processed = mask

    # Save processed image
    ts = time.strftime("%Y%m%d_%H%M%S")
    filename = f"{DEBUG_DIR}/frame_{ts}_{frame_idx:06d}"
    cv2.imwrite(filename + "_h.png", hsv)
    cv2.imwrite(filename + "_p.png", processed)

    # OCR
    text = pytesseract.image_to_string(
        processed,
        config="-c tessedit_char_whitelist=B0123456789:."
    ).strip()

    print(f"OCR: {text} (Guess: {text.replace('B', '0').replace('e', '0').replace('a', '0').replace('P', '0').replace(':.', ':')})")

    frame_idx += 1
