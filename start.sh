#!/bin/bash
# start.sh — launches backend + frontend concurrently
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting WC 2026 Scout AI..."

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  ANTHROPIC_API_KEY not set — Scout Chat will fail."
  echo "   Export it: export ANTHROPIC_API_KEY=sk-ant-..."
fi

# Backend
echo "▶ Starting FastAPI backend on http://localhost:8000"
cd "$PROJECT_DIR"
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be ready
echo "   Waiting for backend..."
for i in {1..20}; do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "   ✓ Backend ready"
    break
  fi
  sleep 1
done

# Frontend
echo "▶ Starting React frontend on http://localhost:5173"
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Scout AI running:"
echo "   Frontend → http://localhost:5173"
echo "   Backend  → http://localhost:8000"
echo "   API docs → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
