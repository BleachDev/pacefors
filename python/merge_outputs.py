import json
import os
import re
from datetime import date

MONTHS = { "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12 }
FILENAME_RE = re.compile(r"^output_([a-z]{3})(\d{2})\.json$")

TIMER_REGEX = re.compile(r"^\d\d\.\d\d\.\d\d\d$")


def date_from_filename(match, year: int) -> date:
    return date(year, MONTHS[match.group(1).lower()], int(match.group(2)))

def seconds(timer: str) -> int:
    # Convert a timer string (MM.SS.mmm) to total seconds.
    minutes, secs, _ = map(int, timer.split("."))
    return minutes * 60 + secs

def main() -> None:
    in_folder = os.path.dirname(os.path.abspath(__file__))
    out_folder = os.path.join(in_folder, "..", "data")
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
        path = os.path.join(in_folder, name)
        with open(path, "r", encoding="utf-8") as f:
            raw_data.append(json.load(f))

    #with open(os.path.join(out_folder, "rawdata.js"), "w", encoding="utf-8") as out:
    #    out.write("export const RAW_DATA = " + json.dumps(raw_data, separators=(",", ":")))

    # Filter invalid rows
    for day in raw_data:
        # Remove rows with a clearly invalid timer or without hearts being present (not survival mode forsenCD)
        day["data"] = [
            row for row in day["data"]
            if TIMER_REGEX.match(row.get("timer", ""))
               and int(row["timer"][3]) < 6
               # (row.heart_rgb[0] > 240 or 55 < row.heart_rgb[0] < 6)));
        ]

    # Remove rows with invalid time skips
    for day in raw_data:
        i = 2
        while i < len(day["data"]) - 2:
            s1 = seconds(day["data"][i - 1]["timer"])
            s2 = seconds(day["data"][i    ]["timer"])
            s3 = seconds(day["data"][i + 1]["timer"])

            # If 10+ sec timeskip forward, Skip
            # If time goes backwards and next time goes forward again, Skip
            # If time goes backwards and the new time is more than 00:10, Skip
            if (s2 - s1 > 20) or (s2 < s1 < s3) or (s1 > s2 > 10):
                day["data"].pop(i)
            else:
                i += 1

    #with open(os.path.join(out_folder, "filtereddata.js"), "w", encoding="utf-8") as out:
    #    out.write("export const FILTERED_DATA = " + json.dumps(raw_data, separators=(",", ":")))

    # Build per-day runs
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

                run = {
                    "date": day["date"],
                    "vod": day["vod"],
                    "netherI": _find_index(lambda r: "Need" in r.get("achievement", "")),
                    "bastionI": bastion_i,
                    "fortI": fort_i,
                    "blindI": _find_index(lambda r: "Certain" in r.get("ninja", "")) if bastion_i > -1 and fort_i > -1 else -1,
                    "data": current_run,
                }
                runs.append(run)
                current_run = []

            current_run.append(row)

    with open(os.path.join(out_folder, "runs.js"), "w", encoding="utf-8") as out:
        out.write("export const RUNS = " + json.dumps(runs, separators=(",", ":")))

if __name__ == "__main__":
    main()