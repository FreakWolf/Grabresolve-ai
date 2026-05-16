"""
Shared LLM client.

Supports two modes:
- bedrock: AWS credentials + boto3 Converse API.
- openai_compatible: Bedrock/Mantle or Nova-style bearer token endpoint.
"""
import json
import urllib.request
import urllib.error

from config import AWS_REGION, LLM_PROVIDER, NOVA_API_KEY, NOVA_BASE_URL, LLM_MODEL, NOVA_TIMEOUT_SECONDS


def _clean_json_text(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) > 1:
            cleaned = parts[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    return cleaned


class LLMClient:
    def __init__(self):
        self.api_key = NOVA_API_KEY
        self.base_url = NOVA_BASE_URL.rstrip("/")
        self.model = LLM_MODEL
        self.provider = LLM_PROVIDER
        self.aws_region = AWS_REGION
        self.timeout_seconds = NOVA_TIMEOUT_SECONDS
        self._bedrock_client = None

    def _openai_compatible_request(self, payload):
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

    def _bedrock(self):
        if self._bedrock_client is None:
            try:
                import boto3
                from botocore.config import Config
            except ImportError as exc:
                raise RuntimeError(
                    "boto3 is required for LLM_PROVIDER=bedrock. "
                    "Run: pip install -r requirements.txt"
                ) from exc

            self._bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=self.aws_region,
                config=Config(read_timeout=self.timeout_seconds)
            )
        return self._bedrock_client

    def _bedrock_converse_text(self, system_prompt, user_prompt, temperature, max_tokens):
        response = self._bedrock().converse(
            modelId=self.model,
            system=[{"text": system_prompt}],
            messages=[
                {
                    "role": "user",
                    "content": [{"text": user_prompt}]
                }
            ],
            inferenceConfig={
                "temperature": temperature,
                "maxTokens": max_tokens
            }
        )

        content = response["output"]["message"].get("content", [])
        text_parts = [part.get("text", "") for part in content if "text" in part]
        text = "\n".join(part for part in text_parts if part).strip()
        if not text:
            raise RuntimeError("Bedrock response did not contain text output")
        return text

    def chat_text(self, system_prompt, user_prompt, temperature=0.2, max_tokens=1200, reasoning_effort=None):
        if self.provider == "bedrock":
            return self._bedrock_converse_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens
            )

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

        data = self._openai_compatible_request(payload)
        return data["choices"][0]["message"]["content"].strip()

    def json_response(self, system_prompt, user_prompt, temperature=0.1, max_tokens=1400, reasoning_effort="medium"):
        text = self.chat_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            reasoning_effort=reasoning_effort
        )
        return json.loads(_clean_json_text(text))


client = LLMClient()
