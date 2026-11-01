import { redactValue } from './redaction.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  workspaceId?: string;
  runId?: string;
  agentId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
}

export class JsonLogger implements Logger {
  constructor(
    private readonly serviceName: string,
    private readonly minLevel: LogLevel = 'info'
  ) {}

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 10,
      info: 20,
      warn: 30,
      error: 40
    };
    return levels[level] >= levels[this.minLevel];
  }

  private write(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    if (!this.shouldLog(level)) return;

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      context: context ? redactValue(context) : undefined,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack
            }
          : error
          ? redactValue(error)
          : undefined
    };

    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.write('error', message, context, error);
  }
}

export function createLogger(serviceName: string, minLevel: LogLevel = 'info'): Logger {
  return new JsonLogger(serviceName, minLevel);
}
