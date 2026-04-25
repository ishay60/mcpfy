export class McpfyError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'McpfyError';
    this.code = code;
    this.details = details;
  }
}

export class ScopeError extends McpfyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('forbidden.scope', message, details);
    this.name = 'ScopeError';
  }
}

export class RateLimitError extends McpfyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('rate_limited', message, details);
    this.name = 'RateLimitError';
  }
}

export class TimeoutError extends McpfyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('timeout', message, details);
    this.name = 'TimeoutError';
  }
}

export class ConfigError extends McpfyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('config.invalid', message, details);
    this.name = 'ConfigError';
  }
}
