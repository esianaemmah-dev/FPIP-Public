"""Azure AI Search retriever for FPIP document indexes.

Indexes are populated from SharePoint/OneDrive via the native Azure AI Search
connector. Each agent is configured with a subset of indexes it may search.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient

from app.config import Config

logger = logging.getLogger(__name__)

_VALID_INDEXES = {
    "fpip-policies-index",
    "fpip-contracts-index",
    "fpip-supplier-docs-index",
}


def _search_client(index_name: str) -> SearchClient:
    if index_name not in _VALID_INDEXES:
        raise ValueError(f"Invalid search index '{index_name}'. Valid: {_VALID_INDEXES}")

    credential: Any
    if Config.AZURE_SEARCH_KEY:
        credential = AzureKeyCredential(Config.AZURE_SEARCH_KEY)
    else:
        # Managed Identity path: DefaultAzureCredential works with the
        # azure-search-documents SDK.
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()

    return SearchClient(
        endpoint=Config.AZURE_SEARCH_ENDPOINT,
        index_name=index_name,
        credential=credential,
    )


def search_documents(index_name: str, query: str, top_k: int = 5) -> list[dict[str, Any]]:
    """Search an Azure AI Search index and return a compact result list."""
    client = _search_client(index_name)
    try:
        results = client.search(
            search_text=query,
            top=top_k,
            select=["id", "title", "content", "source_path"],
        )
        return [
            {
                "id": r.get("id"),
                "title": r.get("title"),
                "content": (r.get("content") or "")[:800],
                "source_path": r.get("source_path"),
                "score": r.get("@search.score"),
            }
            for r in results
        ]
    except Exception as exc:
        logger.warning("Search on %s failed: %s", index_name, exc)
        raise RuntimeError(f"Search failed for index '{index_name}': {exc}") from exc
