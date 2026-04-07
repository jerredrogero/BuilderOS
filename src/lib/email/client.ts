import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResend() as any)[prop];
  },
});

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  try {
    const { error } = await getResend().emails.send(params);
    if (error) {
      console.error("[email] Resend API error", {
        to: params.to,
        subject: params.subject,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    console.error("[email] Failed to send", {
      to: params.to,
      subject: params.subject,
      error: message,
    });
    return { success: false, error: message };
  }
}
