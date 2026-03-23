#!/bin/bash

# Start backend (FastAPI)
cd backend
source .venv/bin/activate 2>/dev/null || (uv venv && source .venv/bin/activate && uv pip install -r requirements.txt)
uvicorn main:app --reload --timeout-graceful-shutdown 1 &
BACKEND_PID=$!
cd ..

# Start frontend (Next.js)
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both"

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
