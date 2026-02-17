import json
import os
import re
from datetime import date

MONTHS = { "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12 }
FILENAME_RE = re.compile(r"^output_([a-z]{3})(\d{2})\.json$")
LIVE_FILENAME_RE = re.compile(r"^live_(\d+-\d+)\.json$")

TIMER_REGEX = re.compile(r"^\d\d\.[012345]\d\.\d\d\d$")


def date_from_filename(match, year: int) -> date:
    return date(year, MONTHS[match.group(1).lower()], int(match.group(2)))

def seconds(timer: str) -> int:
    # Convert a timer string (MM.SS.mmm) to total seconds.
    minutes, secs, _ = map(int, timer.split("."))
    return minutes * 60 + secs

def is_valid_heart_rgb(rgb: list[int]) -> bool:
    r, g, b = rgb
    if r > 240 or (55 < r < 67): return True # Normal heart (in-game/behind menu)
    if (133 < r < 147 and 120 < g < 135) or (35 < r < 45 and 33 < g < 43): return True # Poison heart (in-game/behind menu)
    return False

def filter_raw_data(raw_data: list[dict]) -> None:
    # Filter invalid rows
    for day in raw_data:
        # Remove rows with a clearly invalid timer or without hearts being present (not survival mode forsenCD)
        day["data"] = [
            row for row in day["data"] if TIMER_REGEX.match(row.get("timer", ""))
            # and is_valid_heart_rgb(row["heart_rgb"])
        ]
        for row in day["data"]:
            row.pop("heart_rgb", None)

    # Remove rows with invalid time skips
    for day in raw_data:
        i = 0
        while i < len(day["data"]) - 1:
            s1 = seconds(day["data"][i - 1]["timer"]) if i > 0 else 0
            s2 = seconds(day["data"][i]["timer"])
            s3 = seconds(day["data"][i + 1]["timer"])

            # If 80+ sec timeskip forward, Skip
            # If 20+ sec timeskip forward and the next time isn't consistent, Skip
            # If time goes backwards and next time goes forward again, Skip
            # If time goes backwards and the new time is more than 00:10, Skip
            if s2 - s1 > 80 or (s2 - s1 > 20 and not 0 < s3 - s2 < 2) or (s2 < s1 < s3) or (s1 > s2 > 10):
                day["data"].pop(i)
            else:
                i += 1

        #day["data"].pop(0)
        day["data"].pop(-1)

def build_runs(raw_data: list[dict]) -> list[dict]:
    # Build Runs containing all the data for each run.
    runs: list[dict] = []
    for day in raw_data:
        current_run: list[dict] = []

        def _find_index(predicate) -> int:
            for idx, r in enumerate(current_run):
                if predicate(r):
                    return idx
            return -1

        for i, row in enumerate(day["data"]):
            if i > 0 and (i == len(day["data"]) - 1 or seconds(row["timer"]) < seconds(day["data"][i - 1]["timer"])):
                bastion_i = _find_index(lambda r: "Those" in r.get("achievement", ""))
                fort_i = _find_index(lambda r: "Terri" in r.get("achievement", ""))
                blind_i = _find_index(
                    lambda r: "Certain" in r.get("ninja", "")) if bastion_i > -1 and fort_i > -1 else -1

                run = {
                    "date": day["date"],
                    "vod": day["vod"],
                    "netherI": _find_index(lambda r: "Need" in r.get("achievement", "")),
                    "bastionI": bastion_i,
                    "fortI": fort_i,
                    "blindI": blind_i,
                    "strongholdI": _find_index(
                        lambda r: "ue Sp" in r.get("achievement", "") or "ye Sp" in r.get("achievement",
                                                                                          "")) if blind_i > -1 else -1,
                    "data": current_run,
                }
                runs.append(run)
                current_run = []

            current_run.append(row)

    return runs

def strip_runs(runs: list[dict]) -> list[dict]:
    stripped_runs: list[dict] = []
    for run in runs:
        stripped_run = {
            "date":      run["date"],
            "vod":       run["vod"],
            "runTime":   run["data"][-1]["timer"],
        }
        if run["netherI"] > -1: stripped_run["nether"] = seconds(run["data"][run["netherI"]]["timer"])
        if run["bastionI"] > -1: stripped_run["bastion"] = seconds(run["data"][run["bastionI"]]["timer"])
        if run["fortI"] > -1: stripped_run["fort"] = seconds(run["data"][run["fortI"]]["timer"])
        if run["blindI"] > -1: stripped_run["blind"] = seconds(run["data"][run["blindI"]]["timer"])
        if run["strongholdI"] > -1: stripped_run["stronghold"] = seconds(run["data"][run["strongholdI"]]["timer"])

        death_msg = next((e["death"] for e in reversed(run["data"]) if "LUL" in (e.get("death") or "")), "")
        if death_msg:
            stripped_run["death"] = death_msg

        # List of vod timestamps every 5 IGT timer seconds
        stripped_run["timestamps"] = []
        last_time = -5
        for row in run["data"]:
            while seconds(row["timer"]) - last_time >= 5:
                stripped_run["timestamps"].append(row["timestamp"])
                last_time += 5

        stripped_runs.append(stripped_run)
    return stripped_runs

def main() -> None:
    cur_dir = os.path.dirname(os.path.abspath(__file__))
    in_folder = os.path.join(cur_dir, "..", "data", "raw")
    out_folder = os.path.join(cur_dir, "..", "data")
    os.makedirs(out_folder, exist_ok=True)

    year = date.today().year

    candidates: list[tuple[date, str]] = []
    for name in os.listdir(in_folder):
        match = FILENAME_RE.match(name)
        if match:
            candidates.append((date_from_filename(match, year), name))

    candidates.sort(key=lambda x: x[0])

    raw_data = []
    for _, name in candidates:
        with open(os.path.join(in_folder, name), "r", encoding="utf-8") as f:
            raw_data.append(json.load(f))

    filter_raw_data(raw_data)
    runs = build_runs(raw_data)
    stripped_runs = strip_runs(runs)

    with open(os.path.join(out_folder, "stripped_runs.json"), "w", encoding="utf-8") as out:
        out.write(json.dumps(stripped_runs, separators=(",", ":")))

    live_raw_data = []
    for name in os.listdir(in_folder):
        match = LIVE_FILENAME_RE.match(name)
        if match:
            with open(os.path.join(in_folder, name), "r", encoding="utf-8") as f:
                json_str = "{ \"date\": \"" + match.group(1) + "\", \"vod\": \"\", \"data\": [" + f.read()[:-2] + "]}"
                live_raw_data.append(json.loads(json_str))

    filter_raw_data(live_raw_data)
    live_runs = build_runs(live_raw_data)
    live_stripped_runs = strip_runs(live_runs)

    with open(os.path.join(out_folder, "live_stripped_runs.json"), "w", encoding="utf-8") as out:
        out.write(json.dumps(live_stripped_runs, separators=(",", ":")))

    # Write a JSON of all data/ files and filesizes for use in the frontend for raw data downloads
    index = []
    for root, _, files in os.walk(out_folder):
        for name in files:
            path = os.path.join(root, name)
            index.append({
                "path": os.path.relpath(path, out_folder),
                "size": os.path.getsize(path),
            })

    with open(os.path.join(out_folder, "index.json"), "w", encoding="utf-8") as out:
        out.write(json.dumps(index, separators=(",", ":")))

if __name__ == "__main__":
    main()
