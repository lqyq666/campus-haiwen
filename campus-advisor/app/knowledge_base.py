"""Traceable hybrid retrieval for the admissions assessment knowledge base."""
import json
import logging
import re
from hashlib import sha256
from pathlib import Path

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
CHROMA_DIR = ROOT / "data" / "chroma_db"
DOCUMENTS_FILE = ROOT / "data" / "knowledge" / "admissions_sources.json"
COLLECTION_NAME = "campus_admissions_knowledge"
INDEX_VERSION = "admissions-rag-v1"
MIN_RELEVANCE = 0.24

_collection = None


def _collection_metadata() -> dict:
    return {
        "hnsw:space": "cosine",
        "index_version": INDEX_VERSION,
        "dataset_fingerprint": sha256(DOCUMENTS_FILE.read_bytes()).hexdigest(),
    }


def _get_collection():
    """Return a versioned collection, rebuilding only the generated index if needed."""
    global _collection
    if _collection is not None:
        return _collection

    import chromadb

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    metadata = _collection_metadata()
    collection = client.get_or_create_collection(name=COLLECTION_NAME, metadata=metadata)
    if any((collection.metadata or {}).get(key) != value for key, value in metadata.items()):
        client.delete_collection(COLLECTION_NAME)
        collection = client.create_collection(name=COLLECTION_NAME, metadata=metadata)
    _collection = collection
    return collection


def chunk_text(text: str, chunk_size: int = 360, overlap: int = 48) -> list[str]:
    """Split Chinese or English source text at paragraph and sentence boundaries."""
    sentences = [
        sentence.strip()
        for sentence in re.split(r"\n{2,}|(?<=[。！？!?；;])\s*", text)
        if sentence.strip()
    ]
    chunks, current = [], ""
    for sentence in sentences:
        if current and len(current) + len(sentence) > chunk_size:
            chunks.append(current)
            current = current[-overlap:] + sentence
        else:
            current += sentence
    if current:
        chunks.append(current)
    return chunks or [text.strip()]


def load_documents() -> list[dict]:
    """Load the curated dataset; each record must carry an official source URL."""
    documents = json.loads(DOCUMENTS_FILE.read_text(encoding="utf-8"))
    required = {"id", "title", "content", "url", "year", "topic", "source_trust", "freshness"}
    for document in documents:
        missing = required - document.keys()
        if missing:
            raise ValueError(f"Knowledge document {document.get('id', '<unknown>')} missing {sorted(missing)}")
        if not document["url"].startswith("https://"):
            raise ValueError(f"Knowledge document {document['id']} requires an HTTPS source URL")
    return documents


def _metadata(document: dict, chunk_index: int) -> dict:
    return {
        "document_id": document["id"],
        "title": document["title"],
        "url": document["url"],
        "year": str(document["year"]),
        "topic": document["topic"],
        "university": document.get("university", ""),
        "city": document.get("city", ""),
        "source_trust": document["source_trust"],
        "freshness": document["freshness"],
        "chunk_index": chunk_index,
    }


def add_document(text: str, metadata: dict | None = None) -> int:
    """Add an ad-hoc source document while retaining supplied provenance metadata."""
    metadata = metadata or {}
    document_id = metadata.get("document_id", f"manual-{abs(hash(text))}")
    chunks = chunk_text(text)
    collection = _get_collection()
    collection.upsert(
        ids=[f"{document_id}:{index}" for index in range(len(chunks))],
        documents=chunks,
        metadatas=[{**metadata, "document_id": document_id, "chunk_index": index} for index in range(len(chunks))],
    )
    return len(chunks)


def _tokens(text: str) -> set[str]:
    """Use word tokens plus Chinese 2-4 character ngrams for exact-term recall."""
    tokens = set(re.findall(r"[A-Za-z0-9_]+", text.lower()))
    for sequence in re.findall(r"[\u4e00-\u9fff]+", text):
        for size in range(2, min(4, len(sequence)) + 1):
            tokens.update(sequence[index:index + size] for index in range(len(sequence) - size + 1))
    return tokens


def _lexical_score(query: str, content: str, metadata: dict) -> float:
    query_tokens = _tokens(query)
    if not query_tokens:
        return 0.0
    target = " ".join([
        content, metadata.get("title", ""), metadata.get("topic", ""),
        metadata.get("university", ""), metadata.get("city", ""),
    ])
    return len(query_tokens & _tokens(target)) / len(query_tokens)


def search(query: str, k: int = 3) -> list[dict]:
    """Return source-attributed results ranked by semantic and exact-term relevance."""
    collection = _get_collection()
    if collection.count() == 0 or not query.strip():
        return []

    semantic = collection.query(
        query_texts=[query], n_results=collection.count(),
        include=["documents", "metadatas", "distances"],
    )
    semantic_scores = {
        document_id: max(0.0, 1.0 - distance)
        for document_id, distance in zip(semantic["ids"][0], semantic["distances"][0])
    }
    records = collection.get(include=["documents", "metadatas"])
    hits = []
    for document_id, content, metadata in zip(records["ids"], records["documents"], records["metadatas"]):
        semantic_score = semantic_scores.get(document_id, 0.0)
        lexical_score = _lexical_score(query, content, metadata)
        current_bonus = 0.10 if metadata.get("freshness") == "CURRENT" else 0.0
        score = semantic_score * 0.55 + lexical_score * 0.35 + current_bonus
        if score >= MIN_RELEVANCE:
            hits.append({
                "content": content,
                "score": round(score, 4),
                "semantic_score": round(semantic_score, 4),
                "lexical_score": round(lexical_score, 4),
                "metadata": metadata,
            })
    return sorted(hits, key=lambda hit: (-hit["score"], hit["metadata"]["document_id"]))[:k]


def build_profile_query(profile: dict) -> str:
    """Turn only collected assessment facts into a reproducible retrieval query."""
    cities = "、".join(profile.get("targetCities", [])) or "未说明城市"
    majors = "、".join(profile.get("targetMajors", [])) or "未说明专业"
    cet6 = profile.get("cet6Score", "未提供")
    research = "有科研经历" if profile.get("researchExperiences") else "暂无科研经历"
    competition = "有竞赛成果" if profile.get("competitionExperiences") else "暂无竞赛成果"
    return f"升学测评 目标城市 {cities} 目标专业 {majors} CET6 {cet6} {research} {competition} 保研 考研 招生目录 推免"


def format_references(hits: list[dict]) -> str:
    """Format cited references without presenting them as admissions promises."""
    lines = []
    for hit in hits:
        metadata = hit["metadata"]
        lines.append(
            f"- [{metadata['title']}]({metadata['url']}) · {metadata['year']} · {metadata['freshness']}\n"
            f"  {hit['content'][:180].strip()}"
        )
    return "\n".join(lines)


def seed_knowledge_base() -> None:
    """Index the curated official-source dataset if it has not already been indexed."""
    collection = _get_collection()
    documents = load_documents()
    expected_count = sum(len(chunk_text(document["content"])) for document in documents)
    if collection.count() == expected_count:
        return

    collection.upsert(
        ids=[f"{document['id']}:{index}" for document in documents for index, _ in enumerate(chunk_text(document["content"]))],
        documents=[chunk for document in documents for chunk in chunk_text(document["content"])],
        metadatas=[_metadata(document, index) for document in documents for index, _ in enumerate(chunk_text(document["content"]))],
    )
    logger.info("Indexed %d official admissions knowledge chunks.", expected_count)
