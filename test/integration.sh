#!/bin/bash
set -e

BASE="http://localhost:3001/api/v1"

echo "=== Registering 5 agents ==="
KEY0=$(curl -s -X POST "$BASE/agents/register" -H "Content-Type: application/json" -d '{"name":"SheriffBot"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
echo "SheriffBot registered"
KEY1=$(curl -s -X POST "$BASE/agents/register" -H "Content-Type: application/json" -d '{"name":"TrustNoOne"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
echo "TrustNoOne registered"
KEY2=$(curl -s -X POST "$BASE/agents/register" -H "Content-Type: application/json" -d '{"name":"LogicLord"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
echo "LogicLord registered"
KEY3=$(curl -s -X POST "$BASE/agents/register" -H "Content-Type: application/json" -d '{"name":"VibeCheck"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
echo "VibeCheck registered"
KEY4=$(curl -s -X POST "$BASE/agents/register" -H "Content-Type: application/json" -d '{"name":"ByteMe"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
echo "ByteMe registered"

echo ""
echo "=== Creating game (5 players, 1 human) ==="
GAME_ID=$(curl -s -X POST "$BASE/games/create" -H "Content-Type: application/json" -H "Authorization: Bearer $KEY0" -d '{"max_players":5,"min_players":5,"humans_count":1}' | python3 -c "import sys,json; print(json.load(sys.stdin)['game_id'])")
echo "Game: $GAME_ID"

echo ""
echo "=== Joining agents ==="
for KEY in "$KEY1" "$KEY2" "$KEY3"; do
  curl -s -X POST "$BASE/games/$GAME_ID/join" -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" > /dev/null
  echo "Joined"
done

echo ""
echo "=== Last player joins (auto-start) ==="
RESULT=$(curl -s -X POST "$BASE/games/$GAME_ID/join" -H "Content-Type: application/json" -H "Authorization: Bearer $KEY4")
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'game_started={d.get(\"game_started\")}')"

sleep 1

echo ""
echo "=== Game State ==="
curl -s "$BASE/games/$GAME_ID/state" -H "Authorization: Bearer $KEY0" | python3 -m json.tool

echo ""
echo "=== Roles ==="
for i in 0 1 2 3 4; do
  KEY_VAR="KEY$i"
  NAMES=("SheriffBot" "TrustNoOne" "LogicLord" "VibeCheck" "ByteMe")
  ROLE=$(curl -s "$BASE/games/$GAME_ID/role" -H "Authorization: Bearer ${!KEY_VAR}" | python3 -c "import sys,json; print(json.load(sys.stdin)['role'])")
  echo "${NAMES[$i]}: $ROLE"
done

echo ""
echo "=== Done! ==="
