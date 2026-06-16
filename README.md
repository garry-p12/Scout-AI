# ⚽ WC 2026 Scout AI

A full-stack football intelligence platform for the FIFA World Cup 2026 dataset.

## Architecture

```
Frontend (React + Recharts)
  └─ 4 views: Scout Chat · Player DNA · Manager Sim · Hidden Gems

Orchestrator Agent (OpenAI gpt-4o + function calling)
  └─ 4 specialist tools: search_players · find_clones · simulate_substitution · get_hidden_gems

Data & ML Layer (Python / FastAPI)
  ├─ DataEngine     — pandas aggregation, FAISS nearest-neighbour index
  ├─ Simulation     — Monte Carlo second-half simulator (200 runs)
  └─ FastAPI        — REST API serving all views
```

## Setup

### 1. Install Python deps
```bash
pip install fastapi uvicorn pandas numpy scikit-learn faiss-cpu \
            stable-baselines3 gymnasium openai python-dotenv
```

### 2. Set your OpenAI API key
Create a `.env` file in the project root (recommended):
```bash
OPENAI_API_KEY=sk-...
# optional — defaults to gpt-4o
OPENAI_MODEL=gpt-4o
```
…or export it in your shell:
```bash
export OPENAI_API_KEY=sk-...
```

### 3. Install frontend deps
```bash
cd frontend && npm install
```

### 4. Start everything
```bash
chmod +x start.sh && ./start.sh
```

Open **http://localhost:5173**

---

## Views

### 💬 Scout Chat
Natural language interface powered by the orchestrator agent. Claude decides
which tools to call (player search, clone finder, leaderboard, simulation) and
composes an analyst-quality response.

**Example queries:**
- "Find midfielders under €15M with high creativity"
- "Who plays most like Memphis Depay?"
- "Which team has the highest clutch performers in the Final?"

### 📡 Player DNA
Search any player → see their 8-axis performance radar vs. position average →
find their 4 closest tactical clones via FAISS cosine similarity across 15 dimensions.

### 🎮 Manager Sim
Pick a real WC 2026 match, see the half-time state, choose up to 3 substitutions,
run 200 Monte Carlo simulations of the second half. Win/draw/loss probabilities
update instantly based on player stamina and performance scores.

### 💎 Hidden Gems
Value scatter plot (performance vs. market value) with gem scores
(performance z-score − value z-score). Leaderboard switchable across 6 metrics.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Status + counts |
| GET | `/players` | Search with filters |
| GET | `/players/{id}` | Full player stats |
| GET | `/players/{id}/radar` | Radar chart data |
| GET | `/players/{id}/clones` | FAISS clone search |
| GET | `/leaderboard` | Top N by metric |
| GET | `/matches` | List matches |
| GET | `/matches/{id}` | Match detail |
| GET | `/scatter` | Value scatter data |
| POST | `/simulate` | Run second-half MC sim |
| POST | `/chat` | Orchestrator agent |

Full interactive docs: **http://localhost:8000/docs**

---

## Dataset

`data/fifa_wc2026.csv` — 54,600 rows · 75 columns · 1,248 players · 48 teams · 1,050 matches

Source: [Kaggle – FIFA World Cup 2026 Player Performance Dataset](https://www.kaggle.com/datasets/rauffauzanrambe/fifa-world-cup-2026-player-performance-dataset)
