import argparse
import json
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from typing import Any, Optional


@dataclass(frozen=True)
class StreamInfo:
    online: bool
    category: Optional[str] = None
    title: Optional[str] = None
    raw: Optional[dict[str, Any]] = None


def get_stream_info(timeout_s: int = 15) -> StreamInfo:
    # Return StreamInfo for the channel.
    try:
        proc = subprocess.run(
            ["streamlink", "--json", "twitch.tv/forsen", "1080p60"],
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except FileNotFoundError:
        # streamlink not installed
        return StreamInfo(online=False)
    except subprocess.TimeoutExpired:
        return StreamInfo(online=False)

    try:
        obj = json.loads((proc.stdout or "").strip())
    except json.JSONDecodeError:
        obj = None

    if obj is None:
        return StreamInfo(online=False)

    metadata = obj.get("metadata") if isinstance(obj.get("metadata"), dict) else {}
    category = metadata.get("category")
    title = metadata.get("title")

    # If we got valid JSON from streamlink, treat as online.
    return StreamInfo(online=True, category=category, title=title, raw=obj)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Check if forsen is online and streaming Minecraft.")
    parser.add_argument("--timeout", type=int, default=15, help="Timeout in seconds for streamlink (default: 15)")
    parser.add_argument("--print", choices=["none", "json"], default="none", help="Output format (default: none)")
    parser.add_argument("--wait", action="store_true", help="If online but not Minecraft, poll every 30s until Minecraft, offline, or timeout.")
    parser.add_argument("--wait-timeout", type=float, default=6 * 60 * 60, help="Max wait time in seconds (default: 6h)")

    args = parser.parse_args(argv)

    deadline = time.time() + float(args.wait_timeout)
    while not args.wait or time.time() < deadline:
        info = get_stream_info(timeout_s=args.timeout)

        if args.print == "json":
            print(json.dumps(asdict(info), indent=2))

        # Exit code contract:
        # 0 => offline
        # 1 => online but NOT Minecraft
        # 2 => online AND Minecraft
        if not info.online: code = 0
        elif info.category != "Minecraft": code = 1
        else: code = 2

        if not args.wait or code != 1:
            return code

        time.sleep(30)

    return 3 # Timeout


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
