"""
Test LLM connectivity.
"""
from config import AWS_REGION, LLM_MODEL, LLM_PROVIDER, NOVA_API_KEY, NOVA_TIMEOUT_SECONDS
from llm_client import client


def main():
    print(f"Provider: {LLM_PROVIDER}")
    print(f"Model: {LLM_MODEL}")
    print(f"AWS region: {AWS_REGION}")
    print(f"Timeout: {NOVA_TIMEOUT_SECONDS}s")
    print(f"Bearer key loaded: {'yes' if NOVA_API_KEY else 'no'}")

    try:
        text = client.chat_text(
            "You are a concise assistant.",
            "Say Hello GrabResolve in one short line.",
            max_tokens=60
        )
        print("Response:")
        print(text)
    except Exception as exc:
        print(f"LLM test failed: {exc}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
