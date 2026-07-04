"""
Web Search Tool (Serper)
------------------------
Thin wrapper around the Serper API for real, current web search.
Returns top organic results formatted for agent reasoning.
"""

import json
import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

SERPER_ENDPOINT = "https://google.serper.dev/search"


class WebSearchInput(BaseModel):
    query: str = Field(description="The search query to look up on the web")
    num_results: int = Field(default=5, description="Number of results to return (1–10)")


class WebSearchTool(BaseTool):
    name: str = "web_search"
    description: str = (
        "Searches the web using Google (via Serper) for current, real-world information. "
        "Use for market data, competitor research, technology details, or any factual lookup. "
        "Be specific in your queries — narrow queries yield better results than broad ones."
    )
    args_schema: type[BaseModel] = WebSearchInput
    api_key: str

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(httpx.HTTPStatusError),
    )
    def _search(self, query: str, num_results: int) -> dict:
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {"q": query, "num": min(num_results, 10)}
        response = httpx.post(SERPER_ENDPOINT, headers=headers, json=payload, timeout=15)
        response.raise_for_status()
        return response.json()

    def _run(self, query: str, num_results: int = 5) -> str:
        try:
            data = self._search(query, num_results)
        except httpx.HTTPStatusError as e:
            return f"Search failed with HTTP {e.response.status_code}: {e.response.text}"
        except Exception as e:
            return f"Search error: {str(e)}"

        organic = data.get("organic", [])
        if not organic:
            return f"No results found for: {query}"

        lines = [f"Search results for: '{query}'\n"]
        for i, result in enumerate(organic[:num_results], 1):
            title = result.get("title", "No title")
            link = result.get("link", "")
            snippet = result.get("snippet", "No description available")
            lines.append(f"{i}. **{title}**\n   {snippet}\n   Source: {link}\n")

        # Include answer box if present (e.g. statistics)
        answer_box = data.get("answerBox", {})
        if answer_box:
            answer = answer_box.get("answer") or answer_box.get("snippet", "")
            if answer:
                lines.insert(1, f"**Quick answer:** {answer}\n")

        return "\n".join(lines)
