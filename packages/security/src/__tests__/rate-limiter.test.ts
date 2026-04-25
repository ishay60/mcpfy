import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../rate-limiter.js';

describe('RateLimiter', () => {
  it('allows up to perMinute calls then rejects', async () => {
    const rl = new RateLimiter({ perMinute: 3, maxConcurrent: 10 });
    await rl.check('demo.query', 'session-1');
    await rl.check('demo.query', 'session-1');
    await rl.check('demo.query', 'session-1');
    await expect(rl.check('demo.query', 'session-1')).rejects.toThrow(/Rate limit/);
  });

  it('uses independent buckets per session and tool', async () => {
    const rl = new RateLimiter({ perMinute: 2, maxConcurrent: 10 });
    await rl.check('demo.query', 'session-a');
    await rl.check('demo.query', 'session-a');
    // Different session: fresh bucket
    await expect(rl.check('demo.query', 'session-b')).resolves.not.toThrow();
    // Different tool, same session: fresh bucket
    await expect(rl.check('demo.list_tables', 'session-a')).resolves.not.toThrow();
  });
});
