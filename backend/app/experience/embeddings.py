"""Semantic matching for the experience compiler — local only, no paid APIs.

Two interchangeable backends:

``SentenceTransformerIndex``
    A local sentence-transformers model (all-MiniLM-L6-v2, ~90 MB, runs on CPU).
    Gives genuine paraphrase generalisation: "something huge is rushing at it"
    lands on the looming concept without sharing any content word with the
    seed phrases.

``LexicalIndex``
    A deterministic fallback with no heavyweight dependency: character-n-gram
    and token-overlap similarity over the same phrase bank, with a curated
    trigger lexicon. Weaker at paraphrase, but it never fails to load and the
    UI reports which backend is live.

Both expose the same ``rank(text)`` API so the parser does not care which is in
use, and neither ever calls out to a network service.
"""

from __future__ import annotations

import logging
import math
import re
from collections import Counter
from functools import lru_cache
from typing import Protocol, Sequence

import numpy as np

from app.experience.ontology import ONTOLOGY, StimulusConcept

log = logging.getLogger(__name__)

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


class SemanticIndex(Protocol):
    name: str

    def rank(self, text: str) -> list[tuple[str, float]]:
        """Concept keys scored 0..1, best first."""
        ...


def _phrase_bank() -> list[tuple[str, str]]:
    """(concept_key, phrase) pairs, including each concept's own label/description."""
    bank: list[tuple[str, str]] = []
    for c in ONTOLOGY:
        for p in c.phrases:
            bank.append((c.key, p))
        bank.append((c.key, c.label))
        bank.append((c.key, c.description))
    return bank


# ---------------------------------------------------------------------------
# Lexical fallback
# ---------------------------------------------------------------------------

_STOP = {
    "a", "an", "the", "is", "are", "was", "were", "it", "its", "of", "to", "in", "on",
    "at", "and", "or", "as", "that", "this", "with", "from", "by", "for", "fly", "flies",
    "something", "some", "very", "while", "when", "there", "be", "been", "being", "has",
    "have", "had", "he", "she", "they", "them",
}


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z]+", text.lower()) if t not in _STOP and len(t) > 2]


def _char_ngrams(text: str, n: int = 4) -> Counter:
    s = re.sub(r"[^a-z ]", "", text.lower())
    return Counter(s[i : i + n] for i in range(max(len(s) - n + 1, 0)))


def _cosine_counter(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    num = sum(a[k] * b[k] for k in common)
    da = math.sqrt(sum(v * v for v in a.values()))
    db = math.sqrt(sum(v * v for v in b.values()))
    return num / (da * db) if da and db else 0.0


class LexicalIndex:
    """Deterministic similarity over the phrase bank. No model download."""

    name = "lexical-fallback"

    def __init__(self) -> None:
        self.bank = _phrase_bank()
        self._ngrams = [_char_ngrams(p) for _k, p in self.bank]
        self._tokens = [set(_tokens(p)) for _k, p in self.bank]

    def rank(self, text: str) -> list[tuple[str, float]]:
        q_ng = _char_ngrams(text)
        q_tk = set(_tokens(text))
        best: dict[str, float] = {}
        for (key, _phrase), ng, tk in zip(self.bank, self._ngrams, self._tokens):
            char_sim = _cosine_counter(q_ng, ng)
            tok_sim = len(q_tk & tk) / math.sqrt(max(len(q_tk), 1) * max(len(tk), 1))
            score = 0.45 * char_sim + 0.55 * tok_sim
            if score > best.get(key, 0.0):
                best[key] = score
        return sorted(best.items(), key=lambda kv: -kv[1])


# ---------------------------------------------------------------------------
# Sentence-transformers backend
# ---------------------------------------------------------------------------


class SentenceTransformerIndex:
    """Local embedding model. Downloaded once to the HF cache, then offline."""

    name = f"sentence-transformers:{MODEL_NAME.split('/')[-1]}"

    def __init__(self, model_name: str = MODEL_NAME) -> None:
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(model_name)
        self.bank = _phrase_bank()
        vecs = self.model.encode(
            [p for _k, p in self.bank], normalize_embeddings=True, show_progress_bar=False
        )
        self.vectors = np.asarray(vecs, dtype=np.float32)
        self.keys = [k for k, _p in self.bank]

    def rank(self, text: str) -> list[tuple[str, float]]:
        q = self.model.encode([text], normalize_embeddings=True, show_progress_bar=False)
        sims = (self.vectors @ np.asarray(q, dtype=np.float32).T).ravel()
        best: dict[str, float] = {}
        for key, s in zip(self.keys, sims):
            # Cosine on normalised embeddings is in [-1, 1]; rescale to [0, 1].
            v = float((s + 1.0) / 2.0)
            if v > best.get(key, 0.0):
                best[key] = v
        return sorted(best.items(), key=lambda kv: -kv[1])


@lru_cache(maxsize=1)
def get_index(prefer_embeddings: bool = True) -> SemanticIndex:
    """Best available local semantic index."""
    if prefer_embeddings:
        try:
            idx = SentenceTransformerIndex()
            log.info("experience compiler using %s", idx.name)
            return idx
        except Exception as e:
            log.warning(
                "sentence-transformers unavailable (%s); using deterministic lexical index",
                str(e)[:160],
            )
    return LexicalIndex()
