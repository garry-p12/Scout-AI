"""
Data engine: loads the CSV, builds per-player aggregate vectors,
creates a FAISS index for nearest-neighbour clone search.
"""
import json
import numpy as np
import pandas as pd
import faiss
from sklearn.preprocessing import StandardScaler
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "data" / "fifa_wc2026.csv"

# 15 performance dimensions used for embedding
EMBED_COLS = [
    "offensive_contribution", "defensive_contribution", "possession_impact",
    "pressure_resistance", "creativity_score", "consistency_score",
    "clutch_performance_score", "stamina_score", "player_rating",
    "pass_accuracy", "expected_goals_xg", "expected_assists_xa",
    "successful_dribbles", "tackles", "saves",
]

RADAR_COLS = {
    "Attacking":    ["offensive_contribution", "expected_goals_xg", "expected_assists_xa"],
    "Creativity":   ["creativity_score", "possession_impact", "key_passes"],
    "Defense":      ["defensive_contribution", "tackles", "interceptions"],
    "Physical":     ["stamina_score", "distance_covered_km", "top_speed_kmh"],
    "Pressure":     ["pressure_resistance", "clutch_performance_score"],
    "Consistency":  ["consistency_score", "player_rating"],
    "Passing":      ["pass_accuracy", "successful_passes"],
    "Dribbling":    ["successful_dribbles", "dribbles_attempted"],
}


class DataEngine:
    def __init__(self):
        self.df: pd.DataFrame = None
        self.player_df: pd.DataFrame = None   # one row per player (aggregated)
        self.scaler: StandardScaler = None
        self.index: faiss.Index = None
        self.player_ids: list = []             # ordered list matching FAISS rows
        self._load()

    def _load(self):
        self.df = pd.read_csv(DATA_PATH)
        self._build_player_aggregates()
        self._build_faiss_index()

    def _build_player_aggregates(self):
        """Aggregate match-level rows into one row per player."""
        agg = {c: "mean" for c in EMBED_COLS}
        agg.update({
            "goals": "sum", "assists": "sum", "minutes_played": "sum",
            "player_of_match_awards": "sum", "key_passes": "mean",
            "interceptions": "mean", "distance_covered_km": "mean",
            "top_speed_kmh": "mean", "successful_passes": "mean",
            "dribbles_attempted": "mean",
        })
        static = {
            "player_name": "first", "nationality": "first", "team": "first",
            "position": "first", "age": "first", "height_cm": "first",
            "weight_kg": "first", "preferred_foot": "first",
            "club_name": "first", "market_value_eur": "first",
            "total_goals_tournament": "max", "total_assists_tournament": "max",
            "total_minutes_tournament": "max", "tournament_rating": "mean",
        }
        self.player_df = (
            self.df.groupby("player_id")
            .agg({**agg, **static})
            .reset_index()
        )
        # Composite performance score
        self.player_df["perf_score"] = self.player_df[EMBED_COLS].mean(axis=1)

    def _build_faiss_index(self):
        vectors = self.player_df[EMBED_COLS].fillna(0).values.astype("float32")
        self.scaler = StandardScaler()
        normed = np.ascontiguousarray(self.scaler.fit_transform(vectors).astype("float32"))
        # L2-normalise for cosine similarity via inner product
        faiss.normalize_L2(normed)
        self.index = faiss.IndexFlatIP(normed.shape[1])
        self.index.add(normed)
        self.player_ids = self.player_df["player_id"].tolist()

    # ── Public API ──────────────────────────────────────────────────────────

    def find_clones(self, player_id: str, k: int = 5) -> list[dict]:
        """Return k most similar players (excluding self)."""
        if player_id not in self.player_ids:
            return []
        idx = self.player_ids.index(player_id)
        vec = self.player_df.loc[
            self.player_df["player_id"] == player_id, EMBED_COLS
        ].fillna(0).values.astype("float32")
        vec = self.scaler.transform(vec).astype("float32")
        faiss.normalize_L2(vec)
        scores, indices = self.index.search(vec, k + 1)
        results = []
        for score, i in zip(scores[0], indices[0]):
            pid = self.player_ids[i]
            if pid == player_id:
                continue
            row = self.player_df[self.player_df["player_id"] == pid].iloc[0]
            results.append({
                "player_id": pid,
                "player_name": row["player_name"],
                "team": row["team"],
                "position": row["position"],
                "similarity": round(float(score), 3),
                "player_rating": round(float(row["player_rating"]), 1),
                "market_value_eur": int(row["market_value_eur"]),
            })
            if len(results) >= k:
                break
        return results

    def semantic_search(self, query_vec: np.ndarray, k: int = 10) -> list[dict]:
        """Search index with an arbitrary query vector."""
        vec = self.scaler.transform(query_vec.reshape(1, -1)).astype("float32")
        faiss.normalize_L2(vec)
        scores, indices = self.index.search(vec, k)
        results = []
        for score, i in zip(scores[0], indices[0]):
            pid = self.player_ids[i]
            row = self.player_df[self.player_df["player_id"] == pid].iloc[0]
            results.append({**self._player_summary(row), "similarity": round(float(score), 3)})
        return results

    def get_player(self, player_id: str) -> dict | None:
        rows = self.player_df[self.player_df["player_id"] == player_id]
        if rows.empty:
            return None
        return self._player_detail(rows.iloc[0])

    def search_players(
        self,
        name: str = None,
        team: str = None,
        position: str = None,
        max_value: float = None,
        min_rating: float = None,
        limit: int = 20,
    ) -> list[dict]:
        df = self.player_df.copy()
        if name:
            df = df[df["player_name"].str.contains(name, case=False, na=False)]
        if team:
            df = df[df["team"].str.contains(team, case=False, na=False)]
        if position:
            df = df[df["position"].str.lower() == position.lower()]
        if max_value:
            df = df[df["market_value_eur"] <= max_value]
        if min_rating:
            df = df[df["player_rating"] >= min_rating]
        df = df.sort_values("player_rating", ascending=False).head(limit)
        return [self._player_summary(r) for _, r in df.iterrows()]

    def get_match(self, match_id: str) -> dict | None:
        rows = self.df[self.df["match_id"] == match_id]
        if rows.empty:
            return None
        meta = rows.iloc[0]
        teams = {}
        for team_name, grp in rows.groupby("team"):
            players = []
            for _, p in grp.iterrows():
                players.append({
                    "player_id": p["player_id"],
                    "player_name": p["player_name"],
                    "position": p["position"],
                    "minutes_played": int(p["minutes_played"]),
                    "goals": int(p["goals"]),
                    "assists": int(p["assists"]),
                    "player_rating": round(float(p["player_rating"]), 1),
                    "stamina_score": round(float(p["stamina_score"]), 1),
                    "performance_score": round(float(p["performance_score"]), 1),
                })
            teams[team_name] = players
        return {
            "match_id": match_id,
            "match_date": str(meta["match_date"]),
            "stadium": meta["stadium"],
            "city": meta["city"],
            "tournament_stage": meta["tournament_stage"],
            "result": meta["match_result"],
            "goals_team": int(meta["goals_team"]),
            "goals_opponent": int(meta["goals_opponent"]),
            "teams": teams,
        }

    def list_matches(self, stage: str = None, team: str = None, limit: int = 30) -> list[dict]:
        df = self.df.drop_duplicates("match_id")
        if stage:
            df = df[df["tournament_stage"].str.lower() == stage.lower()]
        if team:
            df = df[df["team"].str.contains(team, case=False, na=False)]
        df = df.sort_values("match_date").head(limit)
        return [
            {
                "match_id": r["match_id"],
                "date": r["match_date"],
                "team": r["team"],
                "opponent": r["opponent_team"],
                "stage": r["tournament_stage"],
                "result": r["match_result"],
                "score": f"{int(r['goals_team'])}-{int(r['goals_opponent'])}",
            }
            for _, r in df.iterrows()
        ]

    def get_leaderboard(self, metric: str = "total_goals_tournament", limit: int = 20) -> list[dict]:
        valid = [m for m in [
            "total_goals_tournament", "total_assists_tournament",
            "tournament_rating", "player_rating", "creativity_score",
            "clutch_performance_score", "market_value_eur",
        ] if m in self.player_df.columns]
        if metric not in valid:
            metric = "total_goals_tournament"
        df = self.player_df.nlargest(limit, metric)
        return [
            {
                **self._player_summary(r),
                "value": round(float(r[metric]), 2),
                "metric": metric,
            }
            for _, r in df.iterrows()
        ]

    def get_radar(self, player_id: str) -> dict | None:
        rows = self.player_df[self.player_df["player_id"] == player_id]
        if rows.empty:
            return None
        r = rows.iloc[0]
        axes = {}
        all_means = {}
        for axis, cols in RADAR_COLS.items():
            vals = [float(r[c]) for c in cols if c in r.index and not pd.isna(r[c])]
            axes[axis] = round(sum(vals) / len(vals), 1) if vals else 0.0
            # get position-normalised mean for comparison ring
            pos_df = self.player_df[self.player_df["position"] == r["position"]]
            pos_vals = [float(pos_df[c].mean()) for c in cols if c in pos_df.columns]
            all_means[axis] = round(sum(pos_vals) / len(pos_vals), 1) if pos_vals else 0.0
        return {
            "player_id": player_id,
            "player_name": r["player_name"],
            "position": r["position"],
            "team": r["team"],
            "axes": axes,
            "position_avg": all_means,
        }

    def get_value_scatter(self) -> list[dict]:
        df = self.player_df.copy()
        df["perf_score"] = df[EMBED_COLS].mean(axis=1)
        df["value_m"] = df["market_value_eur"] / 1_000_000
        # z-score to find outliers
        df["z_perf"] = (df["perf_score"] - df["perf_score"].mean()) / df["perf_score"].std()
        df["z_val"] = (df["value_m"] - df["value_m"].mean()) / df["value_m"].std()
        df["gem_score"] = df["z_perf"] - df["z_val"]
        return [
            {
                "player_id": r["player_id"],
                "player_name": r["player_name"],
                "team": r["team"],
                "position": r["position"],
                "perf_score": round(float(r["perf_score"]), 2),
                "value_m": round(float(r["value_m"]), 2),
                "gem_score": round(float(r["gem_score"]), 3),
                "player_rating": round(float(r["player_rating"]), 1),
                "total_goals_tournament": int(r["total_goals_tournament"]),
            }
            for _, r in df.iterrows()
        ]

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _player_summary(self, r) -> dict:
        return {
            "player_id": r["player_id"],
            "player_name": r["player_name"],
            "team": r["team"],
            "nationality": r["nationality"],
            "position": r["position"],
            "age": int(r["age"]),
            "club_name": r["club_name"],
            "market_value_eur": int(r["market_value_eur"]),
            "player_rating": round(float(r["player_rating"]), 1),
            "tournament_rating": round(float(r["tournament_rating"]), 1),
            "total_goals_tournament": int(r["total_goals_tournament"]),
            "total_assists_tournament": int(r["total_assists_tournament"]),
            "creativity_score": round(float(r["creativity_score"]), 1),
            "clutch_performance_score": round(float(r["clutch_performance_score"]), 1),
        }

    def _player_detail(self, r) -> dict:
        base = self._player_summary(r)
        base.update({
            "height_cm": int(r["height_cm"]),
            "weight_kg": int(r["weight_kg"]),
            "preferred_foot": r["preferred_foot"],
            "offensive_contribution": round(float(r["offensive_contribution"]), 1),
            "defensive_contribution": round(float(r["defensive_contribution"]), 1),
            "possession_impact": round(float(r["possession_impact"]), 1),
            "pressure_resistance": round(float(r["pressure_resistance"]), 1),
            "consistency_score": round(float(r["consistency_score"]), 1),
            "stamina_score": round(float(r["stamina_score"]), 1),
            "pass_accuracy": round(float(r["pass_accuracy"]), 1),
            "expected_goals_xg": round(float(r["expected_goals_xg"]), 2),
            "expected_assists_xa": round(float(r["expected_assists_xa"]), 2),
            "total_minutes_tournament": int(r["total_minutes_tournament"]),
            "player_of_match_awards": int(r["player_of_match_awards"]),
        })
        return base


# Singleton
_engine: DataEngine | None = None

def get_engine() -> DataEngine:
    global _engine
    if _engine is None:
        _engine = DataEngine()
    return _engine
