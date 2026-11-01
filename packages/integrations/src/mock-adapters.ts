import { IntegrationConnector, ToolExecutionContext, ConnectionHealth } from './connector.js';

export interface GmailSendInput {
  to: string;
  subject: string;
  body: string;
}

export interface GmailSendOutput {
  messageId: string;
  threadId: string;
  sentAt: string;
}

export class MockGmailConnector implements IntegrationConnector<GmailSendInput, GmailSendOutput> {
  readonly id = 'gmail_send';
  readonly provider = 'google';
  readonly name = 'Gmail Send Message';
  readonly risk = 'external_side_effect' as const;

  async validate(input: GmailSendInput, _context: ToolExecutionContext): Promise<void> {
    if (!input.to || !input.to.includes('@')) {
      throw new Error("Invalid recipient email address 'to'");
    }
    if (!input.subject) {
      throw new Error("Email 'subject' is required");
    }
  }

  async execute(input: GmailSendInput, context: ToolExecutionContext): Promise<GmailSendOutput> {
    await this.validate(input, context);
    return {
      messageId: `msg_${context.operationId}`,
      threadId: `thread_${context.operationId}`,
      sentAt: new Date().toISOString()
    };
  }

  async healthCheck(_context: ToolExecutionContext): Promise<ConnectionHealth> {
    return {
      healthy: true,
      status: 'connected',
      latencyMs: 12
    };
  }
}

export interface CalendarCreateEventInput {
  summary: string;
  startTime: string;
  endTime: string;
  attendees?: string[];
}

export interface CalendarCreateEventOutput {
  eventId: string;
  htmlLink: string;
  status: string;
}

export class MockCalendarConnector
  implements IntegrationConnector<CalendarCreateEventInput, CalendarCreateEventOutput>
{
  readonly id = 'calendar_create';
  readonly provider = 'google';
  readonly name = 'Google Calendar Create Event';
  readonly risk = 'external_side_effect' as const;

  async validate(input: CalendarCreateEventInput, _context: ToolExecutionContext): Promise<void> {
    if (!input.summary) throw new Error("Event 'summary' is required");
    if (!input.startTime || !input.endTime) throw new Error("Event 'startTime' and 'endTime' are required");
  }

  async execute(
    input: CalendarCreateEventInput,
    context: ToolExecutionContext
  ): Promise<CalendarCreateEventOutput> {
    await this.validate(input, context);
    return {
      eventId: `event_${context.operationId}`,
      htmlLink: `https://calendar.google.com/event?id=mock_${context.operationId}`,
      status: 'confirmed'
    };
  }

  async healthCheck(_context: ToolExecutionContext): Promise<ConnectionHealth> {
    return {
      healthy: true,
      status: 'connected',
      latencyMs: 15
    };
  }
}
