"""
List available Amazon Nova models for the current API key.
"""
import json
import urllib.request
import urllib.error

from config import NOVA_API_KEY, NOVA_BASE_URL, NOVA_TIMEOUT_SECONDS


def main():
    if not NOVA_API_KEY:
        raise SystemExit("NOVA_API_KEY is missing")

    request = urllib.request.Request(
        f"{NOVA_BASE_URL.rstrip('/')}/models",
        headers={"Authorization": f"Bearer {NOVA_API_KEY}"},
        method="GET"
    )

    try:
        with urllib.request.urlopen(request, timeout=NOVA_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read().decode("utf-8"))
            for item in body.get("data", []):
                print(f"{item.get('id')} | owned_by={item.get('owned_by')} | type={item.get('type')}")
    except urllib.error.HTTPError as exc:
        print(f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}")
        raise SystemExit(1)
    except urllib.error.URLError as exc:
        print(f"Connection error: {exc.reason}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
