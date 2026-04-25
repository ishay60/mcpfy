export class McpolyglotError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'McpolyglotError';
    this.code = code;
    this.details = details;
  }
}

export class ScopeError extends McpolyglotError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('forbidden.scope', message, details);
    this.name = 'ScopeError';
  }
}

export class RateLimitError extends McpolyglotError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('rate_limited', message, details);
    this.name = 'RateLimitError';
  }
}

export class TimeoutError extends McpolyglotError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('timeout', message, details);
    this.name = 'TimeoutError';
  }
}

export class ConfigError extends McpolyglotError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('config.invalid', message, details);
    this.name = 'ConfigError';
  }
}
