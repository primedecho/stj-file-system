"""Quick API smoke tests — prefer `pytest` for the full suite."""

import subprocess
import sys
from pathlib import Path


def main() -> int:
    backend_dir = Path(__file__).resolve().parent.parent
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q"],
        cwd=backend_dir,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
