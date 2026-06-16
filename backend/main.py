"""
FastAPI backend for WC 2026 Scout AI.
Run with: uvicorn backend.main:app --reload --port 8000
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from sklearn.decomposition import PCA
import numpy as np
import asyncio
import json

from .data_engine import get_engine, EMBED_COLS
from .agents import chat
from .simulation import simulate_second_half

app = FastAPI(title="WC 2026 Scout AI", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pre-load engine on startup
@app.on_event("startup")
async def startup():
    get_engine()
    print("✓ Data engine ready")


# ── Health ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    engine = get_engine()
    return {
        "status": "ok",
        "players": len(engine.player_df),
        "matches": engine.df["match_id"].nunique(),
    }


# ── Players ───────────────────────────────────────────────────────────────

@app.get("/players")
def search_players(
    name:       Optional[str]   = None,
    team:       Optional[str]   = None,
    position:   Optional[str]   = None,
    max_value:  Optional[float] = None,
    min_rating: Optional[float] = None,
    limit:      int             = 20,
):
    return get_engine().search_players(name, team, position, max_value, min_rating, limit)


@app.get("/players/{player_id}")
def get_player(player_id: str):
    result = get_engine().get_player(player_id)
    if not result:
        raise HTTPException(404, "Player not found")
    return result


@app.get("/players/{player_id}/radar")
def get_radar(player_id: str):
    result = get_engine().get_radar(player_id)
    if not result:
        raise HTTPException(404, "Player not found")
    return result


@app.get("/players/{player_id}/clones")
def get_clones(player_id: str, k: int = 5):
    return get_engine().find_clones(player_id, k)


# ── Leaderboard ───────────────────────────────────────────────────────────

@app.get("/leaderboard")
def leaderboard(
    metric: str = "total_goals_tournament",
    limit:  int = 20,
):
    return get_engine().get_leaderboard(metric, limit)


# ── Matches ───────────────────────────────────────────────────────────────

@app.get("/matches")
def list_matches(
    stage: Optional[str] = None,
    team:  Optional[str] = None,
    limit: int           = 30,
):
    return get_engine().list_matches(stage, team, limit)


@app.get("/matches/{match_id}")
def get_match(match_id: str):
    result = get_engine().get_match(match_id)
    if not result:
        raise HTTPException(404, "Match not found")
    return result


# ── Value scatter ─────────────────────────────────────────────────────────

@app.get("/scatter")
def value_scatter():
    return get_engine().get_value_scatter()


# ── Embedding universe (PCA 2D) ───────────────────────────────────────────

@app.get("/embeddings")
def get_embeddings():
    """
    Returns PCA(2) projection of all player embedding vectors.
    Used by the Player Universe canvas visualisation.
    """
    engine = get_engine()
    vectors = engine.player_df[EMBED_COLS].fillna(0).values.astype("float32")
    normed = engine.scaler.transform(vectors)
    pca = PCA(n_components=2)
    coords = pca.fit_transform(normed)
    result = []
    for i, row in enumerate(engine.player_df.itertuples()):
        result.append({
            "player_id":   row.player_id,
            "player_name": row.player_name,
            "team":        row.team,
            "position":    row.position,
            "x":           round(float(coords[i, 0]), 4),
            "y":           round(float(coords[i, 1]), 4),
            "player_rating":          round(float(row.player_rating), 1),
            "total_goals_tournament": int(row.total_goals_tournament),
            "creativity_score":       round(float(row.creativity_score), 1),
            "market_value_eur":       int(row.market_value_eur),
        })
    return result


# ── Simulation ────────────────────────────────────────────────────────────

class SimRequest(BaseModel):
    team_players:  list[dict]
    sub_indices:   list[int]
    team_goals_ht: int
    opp_goals_ht:  int

@app.post("/simulate")
def simulate(req: SimRequest):
    return simulate_second_half(
        req.team_players,
        req.sub_indices,
        req.team_goals_ht,
        req.opp_goals_ht,
    )


# ── Agent chat ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    messages: list[dict]   # [{"role": "user"|"assistant", "content": "..."}]

@app.post("/chat")
def agent_chat(req: ChatRequest):
    result = chat(req.messages)
    return result
