import json
import os
import re
from datetime import date

MONTHS = { "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12 }
FILENAME_RE = re.compile(r"^output_([a-z]{3})(\d{2})\.json$")


def parse_key_from_filename(filename: str, year: int) -> date:
    match = FILENAME_RE.match(filename)
    if not match:
        raise ValueError(f"Filename does not match expected pattern: {filename}")

    mon_str = match.group(1).lower()
    day = int(match.group(2))
    if mon_str not in MONTHS:
        raise ValueError(f"Unknown month in filename: {filename}")

    return date(year, MONTHS[mon_str], day)


def main() -> None:
    folder = os.path.dirname(os.path.abspath(__file__))
    year = date.today().year

    candidates: list[tuple[date, str]] = []
    for name in os.listdir(folder):
        if FILENAME_RE.match(name):
            candidates.append((parse_key_from_filename(name, year), name))

    candidates.sort(key=lambda x: x[0])

    merged_items = []
    for _, name in candidates:
        path = os.path.join(folder, name)
        with open(path, "r", encoding="utf-8") as f:
            merged_items.append(json.load(f))

    out_path = os.path.join(folder, "rawdata.js")
    with open(out_path, "w", encoding="utf-8") as out:
        out.write("export const RAW_DATA = [\n")
        for i, item in enumerate(merged_items):
            out.write(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
            out.write(",\n" if i < len(merged_items) - 1 else "\n")
        out.write("]\n")


if __name__ == "__main__":
    main()