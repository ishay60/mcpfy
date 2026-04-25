# MongoDB example

A minimal mcpolyglot config that exposes a single MongoDB database to Claude Desktop, Cursor, or Claude Code over stdio.

## 1. Install

```bash
npx @mcpolyglot/cli --version
```

The Mongo driver (`mongodb`) is pulled in as an optional dep of `@mcpolyglot/connector-mongo`.

## 2. Configure

Set `MONGO_URL` in your environment:

```bash
export MONGO_URL="mongodb://localhost:27017/app"
```

## 3. Validate

```bash
npx @mcpolyglot/cli doctor --config ./mcpolyglot.config.ts
```

You should see `✓ mongo.main: connected` and the list of generated tools.

## 4. Wire into your agent

- **Claude Desktop** — copy [`claude-desktop.json`](./claude-desktop.json) into `~/Library/Application Support/Claude/claude_desktop_config.json` (replace the absolute path) and restart.
- **Cursor** — copy [`cursor.json`](./cursor.json) into `~/.cursor/mcp.json`.
- **Claude Code** — run [`./claude-code.sh`](./claude-code.sh).

Then ask: _"What collections do we have? Show me five recent users."_

## What you get

| Tool                             | Description                                                           |
| -------------------------------- | --------------------------------------------------------------------- |
| `mongo.main.list_collections`    | All collections in the database with a sampled-field schema for each. |
| `mongo.main.describe_collection` | One collection's sampled-field schema (paths, types, nullability).    |
| `mongo.main.find`                | Read-only `find` with filter, projection, sort, and bounded limit.    |
| `mongo.main.aggregate`           | Read-only aggregation pipeline; mutating stages rejected (see below). |

## How read-only is enforced

Mongo doesn't have a one-shot "read-only transaction" knob, so mcpolyglot enforces it at the API surface:

1. The connector exposes only `find` and `aggregate` — no `update`, `insert`, `delete`, or `drop` primitives.
2. Aggregation pipelines are walked **before** they reach the driver. Any stage with `$out` or `$merge` (the two stages that write back to the database) is rejected with `forbidden.read_only`.
3. Every operation is bounded by `maxTimeMS` so a runaway aggregation can't pin the cluster.
4. Schema is inferred from a 25-doc `$sample` per collection — no full-collection scans on `list_collections`.
5. Results are redacted, size-capped, and wrapped in an `<mcpolyglot-data>` "untrusted-data" block before reaching the model.
