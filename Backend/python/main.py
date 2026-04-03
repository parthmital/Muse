"""
python/main.py
Embedding + FAISS microservice. The only Python in the stack.

Runs on:
  uvicorn main:app --host 0.0.0.0 --port 6000

GPU usage:
  - Embedding: uses CUDA if torch.cuda.is_available(), else CPU.
  - FAISS: uses faiss-gpu (GpuIndexFlatIP) if GPU build installed
    and CUDA available; silently falls back to faiss-cpu IndexFlatIP.

Endpoints:
  POST /embed          { text: str }           → { embedding: float[] }
  POST /embed/batch    { texts: str[] }         → { embeddings: float[][] }
  POST /search         { vector, k, exclude_ids } → { results: [{id, score}] }
  POST /upsert         { id, vector }           → 204
  POST /rebuild        { vectors: {id: float[]} } → 204
  GET  /health                                  → { status, device, index_size }
"""

from __future__ import annotations

import json
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
CACHE_DIR = os.getenv("EMBEDDING_CACHE_DIR", "./data/embedding_cache")
INDEX_PATH = os.getenv("FAISS_INDEX_PATH", "./data/faiss/index.faiss")
ID_MAP_PATH = os.getenv("FAISS_ID_MAP_PATH", "./data/faiss/id_map.json")
DIM = int(os.getenv("EMBEDDING_DIM", "384"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

Path(INDEX_PATH).parent.mkdir(parents=True, exist_ok=True)
Path(CACHE_DIR).mkdir(parents=True, exist_ok=True)

# ── FAISS: GPU if available, CPU fallback ─────────────────────────────────────
try:
    import faiss
    import faiss.contrib.torch_utils  # noqa – enables GPU support if faiss-gpu installed

    _HAS_FAISS_GPU = hasattr(faiss, "StandardGpuResources") and DEVICE == "cuda"
except ImportError:
    raise RuntimeError("faiss not installed. Run: pip install faiss-gpu OR faiss-cpu")


def _make_index() -> faiss.Index:
    """Create a flat inner-product index (cosine after L2-normalisation)."""
    cpu_index = faiss.IndexFlatIP(DIM)
    if _HAS_FAISS_GPU:
        res = faiss.StandardGpuResources()
        return faiss.index_cpu_to_gpu(res, 0, cpu_index)
    return cpu_index


# ── Global state ──────────────────────────────────────────────────────────────
_lock = threading.RLock()
_model: Optional[SentenceTransformer] = None
_index: Optional[faiss.Index] = None
_id_map: List[str] = []  # position → track_id
_id_pos: Dict[str, int] = {}  # track_id → position


def _load_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME, cache_folder=CACHE_DIR, device=DEVICE)
    return _model


def _load_index():
    global _index, _id_map, _id_pos
    ip = Path(INDEX_PATH)
    im = Path(ID_MAP_PATH)
    if ip.exists() and im.exists():
        cpu_idx = faiss.read_index(str(ip))
        if _HAS_FAISS_GPU:
            res = faiss.StandardGpuResources()
            _index = faiss.index_cpu_to_gpu(res, 0, cpu_idx)
        else:
            _index = cpu_idx
        _id_map = json.loads(im.read_text())
        _id_pos = {tid: i for i, tid in enumerate(_id_map)}
    else:
        _index = _make_index()
        _id_map, _id_pos = [], {}


def _save_index():
    if _index is None:
        return
    cpu_idx = faiss.index_gpu_to_cpu(_index) if _HAS_FAISS_GPU else _index
    faiss.write_index(cpu_idx, INDEX_PATH)
    Path(ID_MAP_PATH).write_text(json.dumps(_id_map))


def _normalise(v: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.where(norm == 0, 1, norm)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_: FastAPI):
    _load_model()
    _load_index()
    yield
    _save_index()


app = FastAPI(title="Embedding Service", lifespan=lifespan)


# ── Schemas ───────────────────────────────────────────────────────────────────
class EmbedRequest(BaseModel):
    text: str


class EmbedBatchRequest(BaseModel):
    texts: List[str]


class SearchRequest(BaseModel):
    vector: List[float]
    k: int = 50
    exclude_ids: List[str] = []


class UpsertRequest(BaseModel):
    id: str
    vector: List[float]


class RebuildRequest(BaseModel):
    vectors: Dict[str, List[float]]


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/embed")
def embed(req: EmbedRequest):
    model = _load_model()
    vec = model.encode(req.text, normalize_embeddings=True)
    return {"embedding": vec.tolist()}


@app.post("/embed/batch")
def embed_batch(req: EmbedBatchRequest):
    if not req.texts:
        return {"embeddings": []}
    model = _load_model()
    vecs = model.encode(
        req.texts, normalize_embeddings=True, batch_size=64, show_progress_bar=False
    )
    return {"embeddings": vecs.tolist()}


@app.post("/search")
def search(req: SearchRequest):
    with _lock:
        if _index is None or _index.ntotal == 0:
            return {"results": []}
        exclude = set(req.exclude_ids)
        fetch_k = min(req.k + len(exclude) + 10, _index.ntotal)
        vec = _normalise(np.array(req.vector, dtype=np.float32).reshape(1, -1))
        scores, indices = _index.search(vec, fetch_k)
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(_id_map):
                continue
            tid = _id_map[idx]
            if tid in exclude:
                continue
            results.append({"id": tid, "score": float(score)})
            if len(results) >= req.k:
                break
    return {"results": results}


@app.post("/upsert", status_code=204)
def upsert(req: UpsertRequest):
    vec = _normalise(np.array(req.vector, dtype=np.float32).reshape(1, -1))
    with _lock:
        _id_pos[req.id] = len(_id_map)
        _id_map.append(req.id)
        _index.add(vec)


@app.post("/rebuild", status_code=204)
def rebuild(req: RebuildRequest):
    global _index, _id_map, _id_pos
    if not req.vectors:
        return
    ids = list(req.vectors.keys())
    vecs = np.array([req.vectors[i] for i in ids], dtype=np.float32)
    vecs = _normalise(vecs)
    with _lock:
        _index = _make_index()
        _id_map = ids
        _id_pos = {tid: i for i, tid in enumerate(ids)}
        _index.add(vecs)
    _save_index()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": DEVICE,
        "gpu_faiss": _HAS_FAISS_GPU,
        "index_size": _index.ntotal if _index else 0,
        "model": MODEL_NAME,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=6000, reload=False)
