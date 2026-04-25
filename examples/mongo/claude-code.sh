#!/usr/bin/env bash
# Add mcpfy to Claude Code (https://docs.claude.com/en/docs/claude-code/mcp).
set -euo pipefail

CONFIG="$(cd "$(dirname "$0")" && pwd)/mcpfy.config.ts"

claude mcp add mcpfy -- npx -y @mcpfy/cli serve --config "$CONFIG"
echo "Added mcpfy to Claude Code (config: $CONFIG)"
