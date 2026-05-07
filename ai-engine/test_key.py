"""
Test Amazon Nova API connectivity.
"""
import json
import urllib.request
import urllib.error

from config import NOVA_API_KEY, NOVA_BASE_URL, LLM_MODEL, NOVA_TIMEOUT_SECONDS


def main():
    print(f"Model: {LLM_MODEL}")
    print(f"Timeout: {NOVA_TIMEOUT_SECONDS}s")
    print(f"Key loaded: {'yes' if NOVA_API_KEY else 'no'}")

    if not NOVA_API_KEY:
        raise SystemExit("NOVA_API_KEY is missing")

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {
                "role": "user",
                "content": "Say Hello GrabResolve in one short line."
            }
        ],
        "max_tokens": 60,
        "temperature": 0.2
    }

    request = urllib.request.Request(
        f"{NOVA_BASE_URL.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {NOVA_API_KEY}"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=NOVA_TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8")
            print(f"HTTP status: {response.status}")
            print("Response body:")
            print(body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"HTTP status: {exc.code}")
        print(f"Reason: {exc.reason}")
        print("Raw error body:")
        print(body)
        raise SystemExit(1)
    except urllib.error.URLError as exc:
        print(f"Connection error: {exc.reason}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
