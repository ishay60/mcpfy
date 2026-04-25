#!/usr/bin/env bash
# Regenerate the captured CLI outputs in this directory.
#
# These are real captures of `mcpolyglot <command>` against a local sample SQLite
# database — used by the README and ARCHITECTURE.md as the "screenshot"
# replacement that survives renaming, link-rot, and grayscale terminals.
#
# Run from the repo root:
#   pnpm build && bash docs/demo/regenerate.sh
#
# The captures are deterministic except for:
#   - the bearer token in serve-http.txt (random per run)
#   - the sessionId UUID
#   - latency numbers
# We hand-edit those after regen to keep the diff focused on real behavior.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="$ROOT/packages/cli/dist/bin.js"
DEMO_DIR="$ROOT/docs/demo"
DB="$(mktemp -t mcpolyglot-demo.XXXXXX.db)"
CFG="$(mktemp -t mcpolyglot-demo.XXXXXX.json)"

trap 'rm -f "$DB" "$CFG"' EXIT

if [[ ! -x "$CLI" ]]; then
  echo "build the CLI first: pnpm build" >&2
  exit 1
fi

# Sample data
sqlite3 "$DB" <<'SQL'
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total_cents INTEGER NOT NULL,
  status TEXT CHECK(status IN ('pending','paid','shipped','cancelled'))
);
INSERT INTO users (email, name, password_hash) VALUES
  ('alice@example.com', 'Alice Anderson', 'argon2id$...'),
  ('bob@example.com',   'Bob Bishop',     'argon2id$...'),
  ('carol@example.com', 'Carol Chen',     'argon2id$...');
INSERT INTO orders (user_id, total_cents, status) VALUES
  (1, 4995, 'paid'),
  (1, 12000, 'shipped'),
  (2, 2500, 'pending');
SQL

# Config (JSON so there's no module-resolution dance for the demo)
cat > "$CFG" <<JSON
{
  "server": { "name": "mcpolyglot", "version": "0.0.1" },
  "transport": { "kind": "stdio" },
  "sources": [
    {
      "id": "sqlite.demo",
      "kind": "sqlite",
      "url": "$DB",
      "scopes": ["schema:read", "tables:read", "query:raw"],
      "perEntityTools": { "enabled": false },
      "limits": { "rowCap": 200, "timeoutMs": 10000, "maxBytes": 262144 },
      "redact": { "columns": ["users.password_hash"], "patterns": [] }
    }
  ],
  "audit": { "path": "~/.mcpolyglot/audit.log" },
  "rateLimit": { "defaultPerMinute": 30, "maxConcurrent": 5 },
  "security": { "wrapMode": "strict" }
}
JSON

run() {
  echo "regenerating $1.txt"
  echo "\$ $2" > "$DEMO_DIR/$1.txt"
  echo "" >> "$DEMO_DIR/$1.txt"
  NO_COLOR=1 eval "$3" >> "$DEMO_DIR/$1.txt" 2>&1 || true
}

run help    "mcpolyglot --help" \
            "node \"$CLI\" --help"
run doctor  "mcpolyglot doctor --config ./mcpolyglot.config.json" \
            "node \"$CLI\" doctor --config \"$CFG\""
run tools   "mcpolyglot tools --config ./mcpolyglot.config.json" \
            "node \"$CLI\" tools --config \"$CFG\""

echo "regenerating serve-http.txt"
{
  echo "\$ mcpolyglot serve --http --port 7339 --config ./mcpolyglot.config.json"
  echo ""
} > "$DEMO_DIR/serve-http.txt"
NO_COLOR=1 node "$CLI" serve --http --port 7339 --config "$CFG" >> "$DEMO_DIR/serve-http.txt" 2>&1 &
PID=$!
sleep 1
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true

echo ""
echo "Done. Hand-edit serve-http.txt to redact the bearer token before committing."
