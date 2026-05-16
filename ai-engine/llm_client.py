"""
Shared Amazon Nova client - OpenAI-compatible chat completions API.
v3.0: Adds vision (multimodal) support for image + document evidence validation.
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
    # Nova multimodal limits (per docs)
    MAX_IMAGES_PER_REQUEST = 10
    MAX_DOCUMENTS_PER_REQUEST = 5

    def __init__(self):
        self.api_key = NOVA_API_KEY
        self.base_url = NOVA_BASE_URL.rstrip("/")
        self.model = LLM_MODEL
        self.timeout_seconds = NOVA_TIMEOUT_SECONDS
        self.max_retries = NOVA_MAX_RETRIES
        self.retry_backoff = NOVA_RETRY_BACKOFF_SECONDS
        self.last_usage = {}
        self.last_raw_response = None

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
                    self.last_raw_response = data
                    return data

            except urllib.error.HTTPError as exc:
                details = exc.read().decode("utf-8", errors="replace").strip()
                last_error = RuntimeError(f"Nova HTTP {exc.code}: {details or exc.reason}")
                if 400 <= exc.code < 500:
                    raise last_error from exc

            except urllib.error.URLError as exc:
                last_error = RuntimeError(f"Nova connection error: {exc.reason}")

            except Exception as exc:
                last_error = RuntimeError(f"Nova unexpected error: {exc}")

            if attempt < self.max_retries:
                wait = self.retry_backoff * (2 ** attempt)
                print(f"   ⚠️ Nova call failed (attempt {attempt + 1}), retrying in {wait:.1f}s...")
                time.sleep(wait)

        raise last_error or RuntimeError("Nova API failed after retries")

    def _extract_content(self, data):
        """Extract content with helpful error messages."""
        try:
            content = data["choices"][0]["message"]["content"]
            if content is None:
                raise RuntimeError(
                    f"Nova returned null content. Response: {json.dumps(data, indent=2)[:500]}"
                )
            return content.strip()
        except (KeyError, IndexError, TypeError) as exc:
            print(f"⚠️ Unexpected Nova response structure:")
            print(json.dumps(data, indent=2)[:800])
            raise RuntimeError(
                f"Nova response missing 'choices[0].message.content': {exc}"
            ) from exc

    def _strip_json_fences(self, text):
        """Remove markdown code fences from JSON response."""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            parts = cleaned.split("```")
            if len(parts) > 1:
                cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        return cleaned

    # ============================================================
    # TEXT-ONLY METHODS
    # ============================================================

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
        return self._extract_content(data)

    def json_response(self, system_prompt, user_prompt, temperature=0.1,
                      max_tokens=1400, reasoning_effort=None):
        text = self.chat_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            reasoning_effort=reasoning_effort
        )
        cleaned = self._strip_json_fences(text)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            print(f"⚠️ Failed to parse JSON from Nova response:")
            print(f"Raw text (first 500 chars): {cleaned[:500]}")
            raise RuntimeError(f"Nova returned invalid JSON: {exc}") from exc

    # ============================================================
    # VISION / MULTIMODAL METHODS
    # ============================================================

    def vision_json_response(self, system_prompt, user_prompt, image_urls,
                             temperature=0.1, max_tokens=1500,
                             reasoning_effort=None):
        """
        Multimodal call: text + multiple images in ONE request.
        Nova supports up to 10 images per request.

        Args:
            image_urls: List of HTTPS URLs OR data URIs
            reasoning_effort: 'low' | 'medium' | 'high'
        Returns:
            Parsed JSON dict
        """
        if not isinstance(image_urls, list):
            image_urls = [image_urls]

        if len(image_urls) > self.MAX_IMAGES_PER_REQUEST:
            raise ValueError(
                f"Nova supports max {self.MAX_IMAGES_PER_REQUEST} images per request, "
                f"got {len(image_urls)}"
            )

        if not image_urls:
            raise ValueError("vision_json_response requires at least 1 image_url")

        user_content = [{"type": "text", "text": user_prompt}]
        for url in image_urls:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": url}
            })

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        if reasoning_effort:
            payload["reasoning_effort"] = reasoning_effort

        data = self._request(payload)
        content = self._extract_content(data)
        cleaned = self._strip_json_fences(content)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            print(f"⚠️ Vision response not valid JSON. Raw: {cleaned[:300]}")
            raise RuntimeError(f"Nova vision returned invalid JSON: {exc}") from exc

    def vision_with_documents(self, system_prompt, user_prompt,
                              image_urls=None, document_urls=None,
                              temperature=0.1, max_tokens=1500):
        """
        Multimodal call with both images AND documents (PDFs, receipts, etc).
        Nova: up to 10 images + 5 documents per request.

        Args:
            image_urls: list of image URLs
            document_urls: list of {url, name, format} dicts
        """
        image_urls = image_urls or []
        document_urls = document_urls or []

        if len(image_urls) > self.MAX_IMAGES_PER_REQUEST:
            raise ValueError(f"Max {self.MAX_IMAGES_PER_REQUEST} images per request")
        if len(document_urls) > self.MAX_DOCUMENTS_PER_REQUEST:
            raise ValueError(f"Max {self.MAX_DOCUMENTS_PER_REQUEST} documents per request")
        if not image_urls and not document_urls:
            raise ValueError("Need at least one image or document")

        user_content = [{"type": "text", "text": user_prompt}]

        for url in image_urls:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": url}
            })

        for doc in document_urls:
            user_content.append({
                "type": "file",
                "file": {
                    "file_data": doc["url"],
                    "filename": doc.get("name", "document"),
                    "format": doc.get("format", "pdf")
                }
            })

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        data = self._request(payload)
        content = self._extract_content(data)
        cleaned = self._strip_json_fences(content)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            print(f"⚠️ Multimodal response not valid JSON. Raw: {cleaned[:300]}")
            raise RuntimeError(f"Nova multimodal returned invalid JSON: {exc}") from exc


client = NovaClient()