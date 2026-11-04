export interface InvitationEmailOptions {
  to: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  invitationToken: string;
  acceptUrl: string;
}

export interface EmailDeliveryResult {
  delivered: boolean;
  provider: 'mock' | 'resend' | 'sendgrid' | 'smtp' | 'disabled';
  messageId?: string;
  simulated?: boolean;
}

export interface EmailDeliveryService {
  sendInvitationEmail(options: InvitationEmailOptions): Promise<EmailDeliveryResult>;
}

/**
 * Mock Email Service for hermetic unit and integration testing.
 * Captures outgoing emails in memory and verifies delivery invariants without external network calls.
 */
export class MockEmailService implements EmailDeliveryService {
  readonly sentEmails: InvitationEmailOptions[] = [];

  async sendInvitationEmail(options: InvitationEmailOptions): Promise<EmailDeliveryResult> {
    this.sentEmails.push({ ...options });
    return {
      delivered: true,
      provider: 'mock',
      messageId: `mock-msg-${Date.now()}-${this.sentEmails.length}`,
      simulated: true
    };
  }

  clear() {
    this.sentEmails.length = 0;
  }
}
