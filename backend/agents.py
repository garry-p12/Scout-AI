"""
Multi-agent orchestrator.
The orchestrator calls Claude with tool definitions; Claude decides which
specialist tools to invoke, then we call them against the DataEngine and
return a composed response to the frontend.
"""
import json
import os
import numpy as np
from anthropic import Anthropic
from .data_engine import get_engine, EMBED_COLS
from .simulation import simulate_second_half

client = Anthropic()

# ── Tool definitions (Claude will decide which to call) ───────────────────

TOOLS = [
    {
        "name": "search_players",
        "description": (
            "Search for players by name, team, position, max market value (EUR), "
            "or minimum player rating. Use this for scout queries like "
            "'find defenders under 10M EUR' or 'who plays for Brazil'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name":       {"type": "string",  "description": "Partial player name"},
                "team":       {"type": "string",  "description": "Team name (partial match)"},
                "position":   {"type": "string",  "description": "One of: Forward, Midfielder, Defender, Goalkeeper"},
                "max_value":  {"type": "number",  "description": "Maximum market value in EUR"},
                "min_rating": {"type": "number",  "description": "Minimum player_rating (0-10 scale)"},
                "limit":      {"type": "integer", "description": "Max results (default 10)"},
            },
        },
    },
    {
        "name": "find_clones",
        "description": (
            "Find players most similar to a given player using cosine similarity "
            "across 15 performance dimensions. Great for 'who plays like X?' queries."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "player_id": {"type": "string", "description": "The player_id to find clones for"},
                "k":         {"type": "integer", "description": "Number of similar players to return (default 5)"},
            },
            "required": ["player_id"],
        },
    },
    {
        "name": "get_player",
        "description": "Get full stats for a specific player by player_id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "player_id": {"type": "string"},
            },
            "required": ["player_id"],
        },
    },
    {
        "name": "get_leaderboard",
        "description": (
            "Get top players ranked by a metric. Metrics: total_goals_tournament, "
            "total_assists_tournament, tournament_rating, player_rating, "
            "creativity_score, clutch_performance_score, market_value_eur."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "metric": {"type": "string"},
                "limit":  {"type": "integer"},
            },
        },
    },
    {
        "name": "get_hidden_gems",
        "description": (
            "Find undervalued players: high performance score relative to low market value. "
            "Returns players sorted by 'gem_score' (performance z-score minus value z-score)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "position": {"type": "string", "description": "Filter by position (optional)"},
                "limit":    {"type": "integer"},
            },
        },
    },
    {
        "name": "analyze_match",
        "description": (
            "Get detailed stats for a specific match including all player performances. "
            "Use when user asks about a specific game."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "match_id": {"type": "string"},
            },
            "required": ["match_id"],
        },
    },
    {
        "name": "list_matches",
        "description": "List matches filtered by stage or team.",
        "input_schema": {
            "type": "object",
            "properties": {
                "stage": {"type": "string", "description": "e.g. Group Stage, Quarter Finals, Final"},
                "team":  {"type": "string"},
                "limit": {"type": "integer"},
            },
        },
    },
    {
        "name": "simulate_substitution",
        "description": (
            "Simulate the second half of a match given a set of substitution decisions. "
            "Returns win/draw/loss probabilities. Use for Manager Sim questions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "team_players":    {
                    "type": "array",
                    "description": "List of player dicts with stamina_score, player_rating, performance_score",
                    "items": {"type": "object"},
                },
                "sub_indices":     {
                    "type": "array",
                    "description": "0-based indices of players to substitute",
                    "items": {"type": "integer"},
                },
                "team_goals_ht":   {"type": "integer"},
                "opp_goals_ht":    {"type": "integer"},
            },
            "required": ["team_players", "sub_indices", "team_goals_ht", "opp_goals_ht"],
        },
    },
]

# ── Tool dispatch ──────────────────────────────────────────────────────────

def dispatch_tool(name: str, inputs: dict) -> str:
    engine = get_engine()

    if name == "search_players":
        results = engine.search_players(
            name=inputs.get("name"),
            team=inputs.get("team"),
            position=inputs.get("position"),
            max_value=inputs.get("max_value"),
            min_rating=inputs.get("min_rating"),
            limit=inputs.get("limit", 10),
        )
        return json.dumps(results)

    if name == "find_clones":
        results = engine.find_clones(inputs["player_id"], k=inputs.get("k", 5))
        return json.dumps(results)

    if name == "get_player":
        result = engine.get_player(inputs["player_id"])
        return json.dumps(result)

    if name == "get_leaderboard":
        results = engine.get_leaderboard(
            metric=inputs.get("metric", "total_goals_tournament"),
            limit=inputs.get("limit", 15),
        )
        return json.dumps(results)

    if name == "get_hidden_gems":
        scatter = engine.get_value_scatter()
        pos = inputs.get("position")
        if pos:
            scatter = [p for p in scatter if p["position"].lower() == pos.lower()]
        scatter.sort(key=lambda x: x["gem_score"], reverse=True)
        return json.dumps(scatter[:inputs.get("limit", 10)])

    if name == "analyze_match":
        result = engine.get_match(inputs["match_id"])
        return json.dumps(result)

    if name == "list_matches":
        results = engine.list_matches(
            stage=inputs.get("stage"),
            team=inputs.get("team"),
            limit=inputs.get("limit", 20),
        )
        return json.dumps(results)

    if name == "simulate_substitution":
        result = simulate_second_half(
            team_players=inputs["team_players"],
            sub_indices=inputs.get("sub_indices", []),
            team_goals_ht=inputs.get("team_goals_ht", 0),
            opp_goals_ht=inputs.get("opp_goals_ht", 0),
        )
        return json.dumps(result)

    return json.dumps({"error": f"Unknown tool: {name}"})


# ── Orchestrator ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Scout AI, an elite football intelligence analyst for the 2026 FIFA World Cup.
You have access to a comprehensive dataset of 1,248 players across 48 teams with 75 performance metrics each.

Your job is to:
1. Understand what the user is asking — scouting, analysis, match simulation, or value hunting
2. Call the right tools (you can chain multiple tool calls)
3. Synthesize results into a sharp, insightful answer

Style guide:
- Be direct and confident like a real scout or football analyst
- Lead with the most interesting finding, then support it with data
- Quote specific stats to back your claims
- When listing players, always include team, position, and one key differentiating stat
- Keep responses focused — don't pad with generic football commentary
- Use football terminology naturally (xG, pressing, box-to-box, etc.)

You have real 2026 World Cup data. Treat it as ground truth."""


def chat(messages: list[dict], stream_callback=None) -> dict:
    """
    Run the orchestrator loop.
    messages: OpenAI-style [{"role": "user"/"assistant", "content": "..."}]
    Returns {"content": str, "tool_calls": [...]}
    """
    tool_calls_made = []

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Collect any tool use blocks
        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
        text_blocks     = [b for b in response.content if b.type == "text"]

        if response.stop_reason == "tool_use" and tool_use_blocks:
            # Execute all tool calls
            tool_results = []
            for block in tool_use_blocks:
                result_str = dispatch_tool(block.name, block.input)
                tool_calls_made.append({
                    "tool": block.name,
                    "input": block.input,
                    "result_preview": result_str[:200],
                })
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_str,
                })

            # Append assistant turn + tool results and loop
            messages = messages + [
                {"role": "assistant", "content": response.content},
                {"role": "user",      "content": tool_results},
            ]
            continue

        # Final text response
        final_text = "\n".join(b.text for b in text_blocks)
        return {
            "content": final_text,
            "tool_calls": tool_calls_made,
        }
