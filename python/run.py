import subprocess
import numpy as np
import cv2
import time
import os
import json
from pathlib import Path
import easyocr

QUALITY = "1080p60"

VOD_URL = "https://www.twitch.tv/videos/2691497421"
START_TIMESTAMP = "01:06:10"

WIDTH = 1920
HEIGHT = 1080

# Idiot doesn't know how to crop his OBS properly
def BLACK_BAR(i):
    return i
    #return i + int(HEIGHT * 0.01) - int(i * 0.01)

CROP_WIDTH = int(WIDTH - WIDTH / 8.7)
CROP_WIDTH_E = int(WIDTH - WIDTH / 70)
CROP_HEIGHT = BLACK_BAR(int(HEIGHT / 15))
CROP_HEIGHT_E = BLACK_BAR(int(CROP_HEIGHT + HEIGHT / 23))

ACV_WIDTH = int(WIDTH * 0.48)
ACV_WIDTH_E = int(WIDTH * 0.65)
ACV_HEIGHT = BLACK_BAR(int(HEIGHT * 0.74))
ACV_HEIGHT_E = BLACK_BAR(int(HEIGHT * 0.84))

DEATH_WIDTH = int(WIDTH * 0.25)
DEATH_WIDTH_E = int(WIDTH * 0.75)
DEATH_HEIGHT = BLACK_BAR(int(HEIGHT * 0.30))
DEATH_HEIGHT_E = BLACK_BAR(int(HEIGHT * 0.36))

NINJABRAIN_WIDTH = int(WIDTH * 0.833)
NINJABRAIN_WIDTH_E = int(WIDTH * 0.897)
NINJABRAIN_HEIGHT = BLACK_BAR(int(HEIGHT * 0.213))
NINJABRAIN_HEIGHT_E = BLACK_BAR(int(HEIGHT * 0.233))

HEART_WIDTH = int(WIDTH * 0.318)
HEART_HEIGHT = BLACK_BAR(int(HEIGHT * 0.8622))

DEBUG_DIR = "debug_frames"
os.makedirs(DEBUG_DIR, exist_ok=True)

OUTPUT_JSON = Path("output.json")

reader = easyocr.Reader(
    ['en'],
    gpu=True,
    # Optional performance/accuracy knobs:
    # decoder='greedy',  # 'greedy'|'beamsearch'|'wordbeamsearch'
    # contrast_ths=0.1,
    # adjust_contrast=0.7,
)


def hms_to_seconds(hms: str) -> int:
    h, m, s = hms.split(":")
    return int(h) * 3600 + int(m) * 60 + int(s)

def seconds_to_hms(total: int) -> str:
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


start_offset_seconds = hms_to_seconds(START_TIMESTAMP)

# --- Streamlink and FFmpeg
streamlink = subprocess.Popen(
    ["streamlink", VOD_URL, QUALITY, "--hls-start-offset", START_TIMESTAMP, "-O"],
    stdout=subprocess.PIPE
)

ffmpeg = subprocess.Popen(
    ["ffmpeg", "-loglevel", "error", "-i", "pipe:0", "-vf", "fps=1",
     "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
    stdin=streamlink.stdout,
    stdout=subprocess.PIPE
)

frame_idx = 0

def easyocr_on_mask(img_mask: np.ndarray, allowlist) -> str:
    if img_mask.dtype != np.uint8:
        img_mask = img_mask.astype(np.uint8)

    results = reader.readtext(img_mask, detail=0, allowlist=allowlist, paragraph=True) # allowlist=ALLOWLIST
    return " ".join(results).strip()

try:
    with open(OUTPUT_JSON, "a", encoding="utf-8") as json_file:
        while True:
            raw = ffmpeg.stdout.read(WIDTH * HEIGHT * 3)
            if not raw:
                print("Stream ended")
                break

            frame = np.frombuffer(raw, np.uint8).reshape((HEIGHT, WIDTH, 3))

            timer_cropped = frame[ CROP_HEIGHT:CROP_HEIGHT_E, CROP_WIDTH:CROP_WIDTH_E]
            timer_hsv = cv2.cvtColor(timer_cropped, cv2.COLOR_BGR2HSV)
            timer_processed = cv2.inRange(timer_hsv, np.array([15, 10, 100]), np.array([55, 255, 255]))
            timer_processed = cv2.medianBlur(timer_processed, 5)
            timer_text = easyocr_on_mask(timer_processed, "0123456789:.").replace(":", ".")

            if 6 < len(timer_text) < 9 and timer_text[2] != ".":
                timer_text = timer_text[:2] + "." + timer_text[2:]

            if 6 < len(timer_text) < 9 and timer_text[5] != ".":
                timer_text = timer_text[:5] + "." + timer_text[5:]

            acv_cropped = frame[ ACV_HEIGHT:ACV_HEIGHT_E, ACV_WIDTH: ACV_WIDTH_E ]
            acv_hsv = cv2.cvtColor(acv_cropped, cv2.COLOR_BGR2HSV)
            acv_processed = cv2.inRange(acv_hsv, np.array([40, 10, 100]), np.array([80, 255, 255]))
            acv_processed = cv2.medianBlur(acv_processed, 5)
            acv_text = easyocr_on_mask(acv_processed, "[ABCDEFGHIJKLNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ")

            death_cropped = frame[ DEATH_HEIGHT:DEATH_HEIGHT_E, DEATH_WIDTH: DEATH_WIDTH_E ]
            death_hsv = cv2.cvtColor(death_cropped, cv2.COLOR_BGR2HSV)
            death_processed = cv2.inRange(death_cropped, np.array([200, 200, 200]), np.array([255, 255, 255]))
            death_processed = cv2.medianBlur(death_processed, 5)
            death_text = easyocr_on_mask(death_processed, "ABCDEFGHIJKLNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz! ")

            ninjabrain_cropped = frame[ NINJABRAIN_HEIGHT:NINJABRAIN_HEIGHT_E, NINJABRAIN_WIDTH:NINJABRAIN_WIDTH_E ]
            ninjabrain_text = easyocr_on_mask(ninjabrain_cropped, "ABCDEFGHIJKLNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:0123456789%. ")

            vod_timestamp_seconds = start_offset_seconds + frame_idx
            vod_timestamp_str = seconds_to_hms(vod_timestamp_seconds)

            heart_color = frame[HEART_HEIGHT, HEART_WIDTH].tolist()
            heart_color.reverse()

            print(f"[{vod_timestamp_str}] TIMER: {timer_text.ljust(15)} | ACV: {acv_text.ljust(15)} | DEATH: {death_text.ljust(15)} | NINJA: {ninjabrain_text.ljust(15)} | HEART_COLOR: {heart_color}")

            ts = time.strftime("%Y%m%d_%H%M%S")
            filename = f"{DEBUG_DIR}/frame_{ts}_{frame_idx:06d}"
            #cv2.imwrite(filename + "_h.png", ninjabrain_cropped)
            #cv2.imwrite(filename + "_p.png", death_processed)
            #cv2.imwrite(filename + "_heart.png", frame[HEART_HEIGHT-10:HEART_HEIGHT+10, HEART_WIDTH-10:HEART_WIDTH+10])

            # ---------------------------------------------------------
            # Write one JSON object per line
            # ---------------------------------------------------------
            json_obj = {
               "timestamp": vod_timestamp_str,
               "heart_rgb": heart_color,
            }
            if timer_text:
                json_obj["timer"] = timer_text
            if acv_text:
                json_obj["achievement"] = acv_text
            if death_text:
                json_obj["death"] = death_text
            if ninjabrain_text:
                json_obj["ninja"] = ninjabrain_text
            json_line = json.dumps(json_obj, ensure_ascii=False)

            json_file.write(json_line + ",\n")
            json_file.flush()
            # ---------------------------------------------------------

            frame_idx += 1

except KeyboardInterrupt:
    print("Interrupted by user")

finally:
    try:
        if ffmpeg.poll() is None:
            ffmpeg.terminate()
    except:
        pass

    try:
        if streamlink.poll() is None:
            streamlink.terminate()
    except:
        pass
