# SQLite example

The fastest way to see mcpfy in action — point it at a local `.db` file.

## 1. Create a sample database

```bash
sqlite3 data.db <<'SQL'
CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT);
INSERT INTO users (email, name) VALUES
  ('alice@example.com', 'Alice'),
  ('bob@example.com', 'Bob');
SQL
```

## 2. Validate

```bash
npx @mcpfy/cli doctor --config ./mcpfy.config.ts
```

## 3. Wire into Claude Desktop

Copy [`claude-desktop.json`](./claude-desktop.json) into your config (replacing the absolute path) and restart.

Ask: _"What tables do we have? Show me a sample of users."_ — note that emails will be redacted by mcpfy's built-in patterns. To allow them, override the rule in your config or remove `email` from the redaction set.
