import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

export async function getSmtpTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  let host = config.ethereal.host;
  let port = config.ethereal.port;
  let user = config.ethereal.user;
  let pass = config.ethereal.pass;

  if (!user || !pass) {
    console.log('[SMTP] Creating Ethereal test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      host = testAccount.smtp.host;
      port = testAccount.smtp.port;
      user = testAccount.user;
      pass = testAccount.pass;
      console.log(`[SMTP] Ethereal account ready (User: ${user})`);
    } catch (err: any) {
      console.error('[SMTP] Failed to create Ethereal test account:', err.message);
      throw err;
    }
  } else {
    console.log(`[SMTP] Using configured Ethereal credentials for user '${user}'.`);
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  console.log('[SMTP] SMTP transporter initialized.');

  // Safe background verification (does not block or fail process startup on network timeout)
  transporter.verify().then(() => {
    console.log('[SMTP] Ethereal SMTP connection verified successfully.');
  }).catch((err) => {
    console.warn(`[SMTP] Ethereal SMTP connection verification warning: ${err.message}. (Sending will be attempted per job).`);
  });

  return transporter;
}

export interface SendMailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
}

export async function sendEmailViaSmtp(params: SendMailParams): Promise<{ messageId: string; previewUrl: string | false }> {
  console.log(`[SMTP] Sending email to ${params.to}...`);
  const mailer = await getSmtpTransporter();
  
  const info = await mailer.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: `<div style="font-family: sans-serif; line-height: 1.5;">${params.body.replace(/\n/g, '<br/>')}</div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[SMTP] Email sent successfully to ${params.to}.`);
  if (previewUrl) {
    console.log(`[SMTP] Ethereal preview: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || false,
  };
}
