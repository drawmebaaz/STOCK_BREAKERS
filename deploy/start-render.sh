#!/bin/sh
set -eu

uvicorn main:app --app-dir /app/ml-service --host 127.0.0.1 --port 8000 &
ML_PID="$!"

cleanup() {
  kill "$ML_PID" 2>/dev/null || true
  wait "$ML_PID" 2>/dev/null || true
}

trap cleanup INT TERM

node /app/server/index.js &
NODE_PID="$!"

wait "$NODE_PID"
