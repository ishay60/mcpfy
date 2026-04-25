import { describe, expect, it } from 'vitest';
import { ScopeGuard } from '../scope-guard.js';

describe('ScopeGuard', () => {
  const guard = new ScopeGuard();

  it('passes when granted is a superset of required', () => {
    expect(() =>
      guard.check('demo.query', ['tables:read'], new Set(['tables:read', 'schema:read'])),
    ).not.toThrow();
  });

  it('throws ScopeError when a required scope is missing', () => {
    expect(() => guard.check('demo.query', ['tables:write'], new Set(['tables:read']))).toThrow(
      /tables:write/,
    );
  });

  it('reports every missing scope', () => {
    let caught: Error | undefined;
    try {
      guard.check('demo.query', ['tables:write', 'query:raw'], new Set([]));
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).toMatch(/tables:write/);
    expect(caught!.message).toMatch(/query:raw/);
  });
});
