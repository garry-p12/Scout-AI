"""
RL simulation model using PPO (stable-baselines3).
State  = [team_avg_stamina, team_avg_rating, team_goals, opp_goals,
          minute, sub_budget, player_staminas x 11]
Action = which player slot to substitute (0-10) or 11 = no sub
Reward = sign(goal_diff_change) · stamina_improvement
"""
import os
import json
import random
import pickle
import numpy as np
import pandas as pd
from pathlib import Path

try:
    import gymnasium as gym
    from gymnasium import spaces
    from stable_baselines3 import PPO
    from stable_baselines3.common.env_util import make_vec_env
    RL_AVAILABLE = True
except ImportError:
    RL_AVAILABLE = False

MODEL_PATH = Path(__file__).parent.parent / "models" / "ppo_manager.zip"
DATA_PATH  = Path(__file__).parent.parent / "data" / "fifa_wc2026.csv"


class MatchEnv(gym.Env):
    """Simplified second-half match environment."""

    metadata = {}

    def __init__(self, df: pd.DataFrame):
        super().__init__()
        self.df = df
        self.player_pool = self._build_pool()
        # State: [team_stamina, team_rating, team_goals, opp_goals, minute,
        #         subs_remaining] + 11 player staminas = 17 dims
        self.observation_space = spaces.Box(low=0.0, high=100.0, shape=(17,), dtype=np.float32)
        self.action_space = spaces.Discrete(12)  # sub player 0-10, or 11=pass
        self.state = None

    def _build_pool(self) -> list:
        """Build a pool of player stat snapshots."""
        cols = ["stamina_score", "player_rating", "offensive_contribution",
                "defensive_contribution", "clutch_performance_score"]
        return self.df[cols].fillna(50).values.tolist()

    def _sample_team(self) -> np.ndarray:
        """Sample 11 random players."""
        return np.array(random.choices(self.player_pool, k=11), dtype=np.float32)

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.team = self._sample_team()       # shape (11, 5)
        self.bench = self._sample_team()[:3]  # 3 sub players
        self.minute = 45
        self.subs_remaining = 3
        self.team_goals = random.randint(0, 2)
        self.opp_goals = random.randint(0, 2)
        return self._obs(), {}

    def _obs(self) -> np.ndarray:
        staminas = self.team[:, 0]  # stamina of each player
        return np.array([
            staminas.mean(),
            self.team[:, 1].mean(),
            self.team_goals,
            self.opp_goals,
            self.minute,
            self.subs_remaining,
            *staminas,
        ], dtype=np.float32)

    def step(self, action):
        done = False
        reward = 0.0
        minutes_left = 90 - self.minute
        tick = min(5, minutes_left)
        self.minute += tick

        # Apply substitution
        if action < 11 and self.subs_remaining > 0 and len(self.bench) > 0:
            fresh = self.bench.pop(0)
            stamina_gain = fresh[0] - self.team[action, 0]
            self.team[action] = fresh
            self.subs_remaining -= 1
            reward += max(stamina_gain, 0) * 0.02  # small reward for fresher player

        # Simulate goal events
        avg_offense = self.team[:, 2].mean() / 100
        avg_stamina = self.team[:, 0].mean() / 100
        goal_prob = avg_offense * avg_stamina * (tick / 45) * 0.4
        if random.random() < goal_prob:
            self.team_goals += 1
            reward += 1.0
        if random.random() < 0.25 * (tick / 45):
            self.opp_goals += 1
            reward -= 0.5

        # Decay stamina each tick
        decay = np.random.uniform(0.3, 0.8, size=11)
        self.team[:, 0] = np.clip(self.team[:, 0] - decay, 0, 100)

        if self.minute >= 90:
            done = True
            # Terminal reward: win/draw/loss
            diff = self.team_goals - self.opp_goals
            reward += (2.0 if diff > 0 else 0.5 if diff == 0 else -1.0)

        return self._obs(), reward, done, False, {}


def train_model(timesteps: int = 50_000):
    if not RL_AVAILABLE:
        print("stable-baselines3 not available, skipping training")
        return
    df = pd.read_csv(DATA_PATH)
    env = make_vec_env(lambda: MatchEnv(df), n_envs=4)
    model = PPO("MlpPolicy", env, verbose=1, n_steps=512, batch_size=64)
    model.learn(total_timesteps=timesteps)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(MODEL_PATH))
    print(f"Model saved to {MODEL_PATH}")
    env.close()


def simulate_second_half(
    team_players: list[dict],
    sub_indices: list[int],
    team_goals_ht: int,
    opp_goals_ht: int,
    n_sims: int = 200,
) -> dict:
    """
    Monte Carlo simulation of the second half.
    sub_indices: list of player slot indices (0-based) to substitute at HT.
    Returns win/draw/loss probabilities and expected final score.
    """
    results = {"W": 0, "D": 0, "L": 0}

    # Build stamina/rating arrays from provided player dicts
    staminas = np.array([p.get("stamina_score", 70) for p in team_players], dtype=float)
    ratings  = np.array([p.get("player_rating", 6.5) for p in team_players], dtype=float)
    offense  = np.array([p.get("performance_score", 60) for p in team_players], dtype=float)
    clutch   = np.array([p.get("clutch_performance_score", 55) for p in team_players], dtype=float)

    # Substitutions: boost stamina by 20 for swapped-out players
    for idx in sub_indices:
        if 0 <= idx < len(staminas):
            staminas[idx] = min(staminas[idx] + 20, 100)

    timelines = []       # list of per-sim tick arrays
    goal_diffs = []

    for _ in range(n_sims):
        team_g = team_goals_ht
        opp_g  = opp_goals_ht
        s = staminas.copy()
        ticks = []

        for minute in range(46, 91, 5):
            s = np.clip(s - np.random.uniform(0.2, 0.6, size=len(s)), 0, 100)
            avg_off    = offense.mean() / 100
            avg_stam   = s.mean() / 100
            avg_clutch = clutch.mean() / 100 if minute > 75 else 1.0
            goal_p     = avg_off * avg_stam * avg_clutch * 0.18
            scored     = 1 if random.random() < goal_p else 0
            conceded   = 1 if random.random() < 0.13 else 0
            team_g    += scored
            opp_g     += conceded
            ticks.append({
                "min": minute,
                "tg":  team_g,
                "og":  opp_g,
                "st":  round(float(s.mean()), 2),   # avg stamina this tick
                "gp":  round(float(goal_p), 4),      # goal probability
                "sc":  scored,
                "cc":  conceded,
            })

        diff = team_g - opp_g
        goal_diffs.append(diff)
        results["W" if diff > 0 else "D" if diff == 0 else "L"] += 1
        timelines.append(ticks)

    # ── Aggregate stats from timelines ────────────────────────────────────
    total    = n_sims
    avg_diff = float(np.mean(goal_diffs))

    # Score distribution: {"1-0": 38, "1-1": 46, ...}
    score_dist: dict[str, int] = {}
    lead_changes = 0
    goal_fests   = 0   # sims where total goals >= 4
    clean_sheets = 0   # sims where opp scored 0 in 2nd half
    total_goals  = 0

    for i, tl in enumerate(timelines):
        final_tg = tl[-1]["tg"]
        final_og = tl[-1]["og"]
        key = f"{final_tg}-{final_og}"
        score_dist[key] = score_dist.get(key, 0) + 1
        total_goals += final_tg + final_og
        if final_tg + final_og >= 4:
            goal_fests += 1
        if final_og == opp_goals_ht:    # no goals conceded in 2nd half
            clean_sheets += 1
        prev_diff = team_goals_ht - opp_goals_ht
        changed = False
        for tick in tl:
            curr_diff = tick["tg"] - tick["og"]
            if not changed and (
                (prev_diff > 0 and curr_diff <= 0) or
                (prev_diff <= 0 and curr_diff > 0)
            ):
                lead_changes += 1
                changed = True
            prev_diff = curr_diff

    # Goals and stamina by minute (averaged across all sims)
    minutes = [t["min"] for t in timelines[0]]
    goals_by_min = {
        m: {
            "sc": sum(tl[i]["sc"] for tl in timelines),
            "cc": sum(tl[i]["cc"] for tl in timelines),
        }
        for i, m in enumerate(minutes)
    }
    stam_by_min = {
        m: round(float(np.mean([tl[i]["st"] for tl in timelines])), 2)
        for i, m in enumerate(minutes)
    }

    # Top 6 scorelines for the chart, sorted by frequency
    top_scores = sorted(score_dist.items(), key=lambda x: -x[1])[:6]

    return {
        # ── Summary (same keys as before so nothing else breaks) ──────────
        "win_prob":            round(results["W"] / total, 3),
        "draw_prob":           round(results["D"] / total, 3),
        "loss_prob":           round(results["L"] / total, 3),
        "expected_goal_diff":  round(avg_diff, 2),
        "n_sims":              n_sims,
        # ── Rich data (new) ───────────────────────────────────────────────
        "timelines":           timelines,          # 200 × 9 ticks
        "top_scores":          top_scores,         # [["1-0", 38], ...]
        "goals_by_min":        goals_by_min,       # {46: {sc:17, cc:19}, ...}
        "stam_by_min":         stam_by_min,        # {46: 68.3, 51: 67.9, ...}
        "lead_changes":        lead_changes,
        "goal_fests":          goal_fests,
        "clean_sheets":        clean_sheets,
        "avg_goals_per_game":  round(total_goals / total, 2),
    }


if __name__ == "__main__":
    train_model(timesteps=50_000)
