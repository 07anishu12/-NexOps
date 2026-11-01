export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly providerRequestId?: string
  ) {
    super(`[${provider}] ${code}: ${message}`);
    this.name = 'IntegrationError';
  }
}

export class IntegrationAuthError extends IntegrationError {
  constructor(provider: string, message: string = 'OAuth token expired or invalid') {
    super(message, provider, 'AUTH_INVALID', false);
    this.name = 'IntegrationAuthError';
  }
}

export class IntegrationRateLimitError extends IntegrationError {
  constructor(provider: string, message: string = 'Provider rate limit exceeded') {
    super(message, provider, 'RATE_LIMIT_EXCEEDED', true);
    this.name = 'IntegrationRateLimitError';
  }
}
