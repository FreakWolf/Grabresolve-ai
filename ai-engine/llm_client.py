"""
Shared Amazon Nova client using the OpenAI-compatible chat completions API.
Now with defensive error handling and usage capture.
"""
import json
import time
import urllib.request
import urllib.error

from config import (
    NOVA_API_KEY, NOVA_BASE_URL, LLM_MODEL,
    NOVA_TIMEOUT_SECONDS, NOVA_MAX_RETRIES, NOVA_RETRY_BACKOFF_SECONDS
)


class NovaClient:
    def __init__(self):
        self.api_key = NOVA_API_KEY
        self.base_url = NOVA_BASE_URL.rstrip("/")
        self.model = LLM_MODEL
        self.timeout_seconds = NOVA_TIMEOUT_SECONDS
        self.max_retries = NOVA_MAX_RETRIES
        self.retry_backoff = NOVA_RETRY_BACKOFF_SECONDS
        self.last_usage = {}
        self.last_raw_response = None  # ⬅️ ADDED: For debugging

    def _request(self, payload):
        if not self.api_key:
            raise RuntimeError("NOVA_API_KEY is not set")

        body = json.dumps(payload).encode("utf-8")
        last_error = None

        for attempt in range(self.max_retries + 1):
            request = urllib.request.Request(
                f"{self.base_url}/chat/completions",
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}"
                },
                method="POST"
            )

            try:
                with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                    data = json.loads(response.read().decode("utf-8"))
                    self.last_usage = data.get("usage", {}) or {}
                    self.last_raw_response = data  # ⬅️ ADDED
                    return data

            except urllib.error.HTTPError as exc:
                details = exc.read().decode("utf-8", errors="replace").strip()
                last_error = RuntimeError(
                    f"Nova HTTP {exc.code}: {details or exc.reason}"
                )
                if 400 <= exc.code < 500:
                    raise last_error from exc

            except urllib.error.URLError as exc:
                last_error = RuntimeError(f"Nova connection error: {exc.reason}")

            except Exception as exc:
                last_error = RuntimeError(f"Nova unexpected error: {exc}")

            if attempt < self.max_retries:
                wait = self.retry_backoff * (2 ** attempt)
                print(f"   ⚠️ Nova call failed (attempt {attempt + 1}), "
                      f"retrying in {wait:.1f}s...")
                time.sleep(wait)

        raise last_error or RuntimeError("Nova API failed after retries")

    def chat_text(self, system_prompt, user_prompt, temperature=0.2,
                  max_tokens=1200, reasoning_effort=None):
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        if reasoning_effort:
            payload["reasoning_effort"] = reasoning_effort

        data = self._request(payload)

        # ⬇️ ADDED: Defensive parsing with helpful error
        try:
            content = data["choices"][0]["message"]["content"]
            if content is None:
                raise RuntimeError(
                    f"Nova returned null content. Full response: "
                    f"{json.dumps(data, indent=2)[:500]}"
                )
            return content.strip()
        except (KeyError, IndexError, TypeError) as exc:
            print(f"⚠️ Unexpected Nova response structure:")
            print(json.dumps(data, indent=2)[:800])
            raise RuntimeError(
                f"Nova response missing 'choices[0].message.content': {exc}"
            ) from exc

    def json_response(self, system_prompt, user_prompt, temperature=0.1,
                      max_tokens=1400, reasoning_effort=None):
        """
        Get a JSON response from Nova.
        ⬇️ CHANGED: reasoning_effort now defaults to None (was 'medium')
        Pass reasoning_effort explicitly only when you really need it.
        """
        text = self.chat_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            reasoning_effort=reasoning_effort
        )
        cleaned = text.strip()
        if cleaned.startswith("```"):
            parts = cleaned.split("```")
            if len(parts) > 1:
                cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()

        # ⬇️ ADDED: Helpful error if JSON parse fails
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            print(f"⚠️ Failed to parse JSON from Nova response:")
            print(f"Raw text (first 500 chars): {cleaned[:500]}")
            raise RuntimeError(f"Nova returned invalid JSON: {exc}") from exc


client = NovaClient()