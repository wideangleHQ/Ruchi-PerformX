import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Resend } from 'resend';

/**
 * Escapes the five characters that let a string break out of HTML text or an
 * attribute value.
 *
 * Notification bodies carry free text written by one employee and read by
 * another: an approver's rejection remark, an HR cancellation reason, a
 * project message. Interpolating that raw lets the author put arbitrary markup
 * into a mail that carries RUCHI's from-address, which is a phishing link in a
 * message the recipient has every reason to trust. Email clients block script,
 * so this is not stored XSS; an injected anchor or form is the real risk and
 * this closes it.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is missing');
    }

    this.resend = new Resend(apiKey);

    this.fromEmail =
      process.env.RESEND_FROM_EMAIL ??
      'onboarding@resend.dev';

    this.logger.log(
      `EmailService initialized. From Email: ${this.fromEmail}`,
    );
  }

  /**
   * Generic notification email, used by NotificationsService for every type
   * whose channel map includes EMAIL.
   *
   * `body` is the notification message verbatim, which is why rejections and
   * cancellations carry their reason: the caller already put it there. An
   * email that says "your leave was rejected" with no reason is worse than no
   * email, because the recipient then has to go and ask.
   *
   * Throws whatever Resend throws. The caller swallows it: email is best
   * effort and must never roll back the notification row.
   */
  async sendNotificationEmail(
    email: string,
    fullName: string,
    subject: string,
    body: string,
  ): Promise<void> {
    // Every interpolation below is attacker-influenced. fullName is chosen at
    // registration, subject and body come from whichever employee triggered
    // the notification. appUrl is ours but is escaped anyway so a bad env
    // value cannot break the attribute.
    const appUrl = escapeHtml(
      process.env.CLIENT_URL ?? 'https://app.ruchiperformx.in',
    );
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <p style="color:#0f172a;font-size:15px">Hello ${escapeHtml(fullName)},</p>
        <div style="background:#f8fafc;border-left:3px solid #15803d;padding:16px;margin:16px 0">
          <p style="margin:0 0 8px;color:#0f172a;font-size:16px;font-weight:600">${escapeHtml(subject)}</p>
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.6">${escapeHtml(body)}</p>
        </div>
        <p style="color:#64748b;font-size:13px">
          Open <a href="${appUrl}" style="color:#15803d">RUCHI PerformX</a> to act on this.
        </p>
      </div>`;

    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      // Header, not markup. Strip CR and LF so a crafted subject cannot inject
      // another header, and leave the rest unescaped so it reads as text.
      subject: `RUCHI PerformX - ${subject.replace(/[\r\n]+/g, ' ')}`,
      html,
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async sendOtpEmail(
    email: string,
    otp: string,
    type: 'REGISTRATION' | 'PASSWORD_RESET',
  ): Promise<void> {
    const subject =
      type === 'REGISTRATION'
        ? 'RUCHI PerformX - Verify Your Email'
        : 'RUCHI PerformX Password Reset OTP';

    const heading =
      type === 'REGISTRATION'
        ? 'Email Verification'
        : 'Password Reset';

    const message =
      type === 'REGISTRATION'
        ? 'Use the OTP below to verify your email and complete registration.'
        : 'Use the OTP below to reset your password.';

    try {
      this.logger.log(`Sending ${type} OTP email to ${email}`);

      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to: [email],
        subject,
        html: this.buildOtpTemplate(heading, message, otp),
      });

      this.logger.log(
        `Email API Response: ${JSON.stringify(response, null, 2)}`,
      );

      if ('error' in response && response.error) {
        this.logger.error(
          `Resend Error: ${JSON.stringify(response.error)}`,
        );

        throw new InternalServerErrorException(
          response.error.message,
        );
      }

      this.logger.log(
        `OTP Email Sent Successfully to ${email}`,
      );
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed sending OTP email to ${email}`,
        stack,
      );

      console.error('FULL EMAIL ERROR =>', error);

      throw new InternalServerErrorException(
        'Failed to send email',
      );
    }
  }

  private buildOtpTemplate(
    heading: string,
    message: string,
    otp: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;">
        <h1 style="color:#e8502a;">RUCHI PerformX</h1>

        <h2>${heading}</h2>

        <p>${message}</p>

        <div style="
          background:#f4f4f4;
          padding:20px;
          text-align:center;
          font-size:32px;
          font-weight:bold;
          letter-spacing:8px;
          border-radius:8px;
          margin:24px 0;
        ">
          ${otp}
        </div>

        <p>
          This OTP is valid for
          <strong>10 minutes</strong>.
        </p>

        <p>
          If you did not request this email,
          please ignore it.
        </p>
      </div>
    `;
  }
}
