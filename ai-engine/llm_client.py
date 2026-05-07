"""
Shared Amazon Nova client using the OpenAI-compatible chat completions API.
"""
import json
import urllib.request
import urllib.error

from config import NOVA_API_KEY, NOVA_BASE_URL, LLM_MODEL, NOVA_TIMEOUT_SECONDS


class NovaClient:
    def __init__(self):
        self.api_key = NOVA_API_KEY
        self.base_url = NOVA_BASE_URL.rstrip("/")
        self.model = LLM_MODEL
        self.timeout_seconds = NOVA_TIMEOUT_SECONDS

    def _request(self, payload):
        if not self.api_key:
            raise RuntimeError("NOVA_API_KEY is not set")

        body = json.dumps(payload).encode("utf-8")
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
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace").strip()
            raise RuntimeError(
                f"Nova HTTP {exc.code}: {details or exc.reason}"
            ) from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Nova connection error: {exc.reason}") from exc

    def chat_text(self, system_prompt, user_prompt, temperature=0.2, max_tokens=1200, reasoning_effort=None):
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
        return data["choices"][0]["message"]["content"].strip()

    def json_response(self, system_prompt, user_prompt, temperature=0.1, max_tokens=1400, reasoning_effort="medium"):
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
        return json.loads(cleaned)


client = NovaClient()
