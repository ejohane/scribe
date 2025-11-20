#!/usr/bin/env bash

#
# Development script - runs all dev servers concurrently
#

set -e

echo "🚀 Starting Scribe development environment..."

# Kill all background processes on exit
trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Start Vite dev server for renderer
echo "📦 Starting Vite dev server..."
cd apps/desktop/renderer
bun run dev &
VITE_PID=$!
cd ../../..

# Wait for Vite to start
echo "⏳ Waiting for Vite dev server..."
sleep 2

# Start Electron
echo "⚡ Starting Electron..."
cd apps/desktop
NODE_ENV=development bun run dev &
ELECTRON_PID=$!
cd ../..

echo "✅ Development environment ready!"
echo ""
echo "Processes:"
echo "  Vite:     PID $VITE_PID (http://localhost:5173)"
echo "  Electron: PID $ELECTRON_PID"
echo ""
echo "Press Ctrl+C to stop all processes"

# Wait for any process to exit
wait
