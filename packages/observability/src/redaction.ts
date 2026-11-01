const SENSITIVE_KEY_PATTERNS = [
  /passw(or)?d/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth(orization)?/i,
  /bearer/i,
  /credential/i,
  /private[_-]?key/i
];

export function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Check for bearer token strings
    if (/bearer\s+[a-z0-9._~+/-]+=*/i.test(value)) {
      return '[REDACTED_BEARER_TOKEN]';
    }
    // Check for potential API keys
    if (/^(sk-[a-zA-Z0-9_-]{20,}|rzp_(test|live)_[a-zA-Z0-9]+)$/.test(value)) {
      return '[REDACTED_API_KEY]';
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (typeof value === 'object') {
    const redactedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        redactedObj[key] = '[REDACTED]';
      } else {
        redactedObj[key] = redactValue(val);
      }
    }
    return redactedObj;
  }

  return value;
}
