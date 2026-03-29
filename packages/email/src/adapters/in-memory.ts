import type { EmailAdapter, EmailSendParams, EmailSendResult } from "../interface.js";

/**
 * A sent email record captured by InMemoryEmailAdapter.
 */
export interface SentEmail {
  readonly id: string;
  readonly to: string | readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly from: string | undefined;
  readonly replyTo: string | undefined;
  readonly sentAt: Date;
}

/**
 * In-memory email adapter that captures sent messages for test assertions.
 *
 * Provides helper methods to inspect and clear the sent message history.
 */
export class InMemoryEmailAdapter implements EmailAdapter {
  readonly providerName = "in-memory" as const;
  private readonly _sent: SentEmail[] = [];
  private _counter = 0;

  send(params: EmailSendParams): Promise<EmailSendResult> {
    this._counter += 1;
    const messageId = `in-memory-${String(this._counter)}`;
    this._sent.push({
      id: messageId,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      from: params.from,
      replyTo: params.replyTo,
      sentAt: new Date(),
    });
    return Promise.resolve({ messageId });
  }

  /** Returns all captured sent emails. */
  get sent(): readonly SentEmail[] {
    return this._sent;
  }

  /** Returns the last sent email, or undefined if none have been sent. */
  get lastSent(): SentEmail | undefined {
    return this._sent[this._sent.length - 1];
  }

  /** Returns the number of emails sent. */
  get sentCount(): number {
    return this._sent.length;
  }

  /** Clears all captured sent emails. */
  clear(): void {
    this._sent.length = 0;
  }
}
