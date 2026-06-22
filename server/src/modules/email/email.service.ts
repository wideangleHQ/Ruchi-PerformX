import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Resend } from 'resend';

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
