"""LLM providers for research / script drafting.

manual  - default. The engine never invents facts: research, sources and the script come from the project files,
          written or reviewed by a human (or by an agent session) and then validated here.
ollama  - optional local model over HTTP (free, runs on your own machine). Only used when configured.
No paid LLM provider is wired in: adding one requires an explicit budget and a reviewed implementation."""
from __future__ import annotations

import json
import urllib.request

from . import ProviderInfo, ProviderUnavailable, register


@register("llm", "manual")
class ManualLLM:
    def __init__(self, **_: object) -> None:
        self.info = ProviderInfo("llm", "manual", paid=False, model="human/agent-authored files")

    def generate(self, prompt: str, **_: object) -> str:
        raise ProviderUnavailable("llm provider is 'manual': write this content into project.json (no text is generated automatically)")


@register("llm", "ollama")
class OllamaLLM:
    def __init__(self, model: str = "llama3.1:8b", base_url: str = "http://127.0.0.1:11434", timeout: float = 600, **_: object) -> None:
        self.info = ProviderInfo("llm", "ollama", paid=False, model=model, license="depends on the local model")
        self.model, self.base_url, self.timeout = model, base_url.rstrip("/"), timeout

    def request(self, prompt: str, system: str = "") -> urllib.request.Request:
        body = {"model": self.model, "prompt": prompt, "system": system, "stream": False, "options": {"temperature": 0.4}}
        return urllib.request.Request(f"{self.base_url}/api/generate", data=json.dumps(body).encode(),
                                      headers={"content-type": "application/json"}, method="POST")

    def generate(self, prompt: str, system: str = "", **_: object) -> str:
        try:
            with urllib.request.urlopen(self.request(prompt, system), timeout=self.timeout) as r:
                return json.loads(r.read())["response"]
        except OSError as e:
            raise ProviderUnavailable(f"ollama not reachable at {self.base_url}: {e}") from e
