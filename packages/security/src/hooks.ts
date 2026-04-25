import type { Scope, ToolResult, SecurityHooks } from '@mcpfy/core';
import { ScopeGuard } from './scope-guard.js';
import { Redactor, type RedactionRule, type ColumnDenyEntry } from './redactor.js';
import { RateLimiter, type RateLimitOptions } from './rate-limiter.js';
import { AuditLogger, type AuditLoggerOptions } from './audit.js';
import { wrapUntrusted, enforceSize, type WrapMode } from './wrap.js';

export interface DefaultHookOptions {
  rateLimit?: RateLimitOptions;
  audit?: AuditLoggerOptions;
  redactor?: { customRules?: RedactionRule[]; denyColumns?: ColumnDenyEntry[] };
  wrapMode?: WrapMode;
}

export function defaultSecurityHooks(opts: DefaultHookOptions = {}): SecurityHooks {
  const guard = new ScopeGuard();
  const limiter = new RateLimiter(opts.rateLimit);
  const redactor = new Redactor(opts.redactor);
  const audit = new AuditLogger(opts.audit);
  const wrapMode: WrapMode = opts.wrapMode ?? 'strict';

  return {
    checkScopes(toolName: string, required: readonly Scope[], granted: ReadonlySet<Scope>) {
      guard.check(toolName, required, granted);
    },
    async checkRateLimit(toolName: string, sessionId: string) {
      await limiter.check(toolName, sessionId);
    },
    redact(toolName: string, result: ToolResult) {
      return redactor.apply(toolName, result);
    },
    enforceSize(toolName: string, result: ToolResult, maxBytes: number) {
      return enforceSize(toolName, result, maxBytes);
    },
    wrapUntrusted(result: ToolResult) {
      return wrapUntrusted(result, wrapMode);
    },
    async audit(entry) {
      await audit.append(entry as unknown as Record<string, unknown>);
    },
  };
}

/** Compose multiple SecurityHooks objects, running each phase in order. */
export function composeHooks(...hooks: SecurityHooks[]): SecurityHooks {
  return {
    checkScopes(toolName, required, granted) {
      for (const h of hooks) h.checkScopes(toolName, required, granted);
    },
    async checkRateLimit(toolName, sessionId) {
      for (const h of hooks) await h.checkRateLimit(toolName, sessionId);
    },
    redact(toolName, result) {
      let acc = result;
      let count = 0;
      for (const h of hooks) {
        const r = h.redact(toolName, acc);
        acc = r.result;
        count += r.redactionsApplied;
      }
      return { result: acc, redactionsApplied: count };
    },
    enforceSize(toolName, result, maxBytes) {
      let acc = result;
      for (const h of hooks) acc = h.enforceSize(toolName, acc, maxBytes);
      return acc;
    },
    wrapUntrusted(result) {
      let acc = result;
      for (const h of hooks) acc = h.wrapUntrusted(acc);
      return acc;
    },
    async audit(entry) {
      for (const h of hooks) await h.audit(entry);
    },
  };
}
