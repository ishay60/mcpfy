# @mcpolyglot/connector-mongo

MongoDB connector for [mcpolyglot](https://github.com/ishay60/mcpolyglot). Sample-based schema inference, read-only `find` / `aggregate` primitives, prompt-injection-safe results.

## Tools exposed

For every Mongo source mcpolyglot generates:

- `<id>.list_collections` — all collections with a sampled-field schema for each.
- `<id>.describe_collection` — one collection's sampled-field schema (paths, types, nullability).
- `<id>.find` — read-only `find` with filter, projection, sort, and a bounded limit.
- `<id>.aggregate` — read-only aggregation pipeline; mutating stages are rejected.

## How read-only is enforced

Mongo doesn't have a one-shot "read-only transaction" knob, so mcpolyglot enforces it at the API surface:

1. Only `find` and `aggregate` are exposed — no `update`, `insert`, `delete`, or `drop` primitives.
2. Aggregation pipelines are walked **before** they reach the driver. Any stage with `$out` or `$merge` (the two stages that write back) is rejected with `forbidden.read_only`.
3. Every operation is bounded by `maxTimeMS` so a runaway aggregation can't pin the cluster.
4. Schema is inferred from a 25-doc `$sample` per collection — no full-collection scans on `list_collections`.

## Driver is an optional dep

`mongodb` is declared as an optional dep. Install it once with your project and you're set.

## Docs

- Architecture → https://github.com/ishay60/mcpolyglot/blob/develop/ARCHITECTURE.md
- Example → [examples/mongo](https://github.com/ishay60/mcpolyglot/tree/develop/examples/mongo)

MIT licensed.
