/**
 * NauticShield Notifier
 * Sends email via Resend and/or SMS via Twilio based on notification prefs.
 * All sends are non-fatal — a failed notification never crashes the agent.
 */
import { Resend } from 'resend';
import twilio from 'twilio';
import * as db from './db';
import type { NotificationCategory } from './db';

// ── Clients (lazy — only created when env vars are present) ───────

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function getTwilio(): ReturnType<typeof twilio> | null {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  return sid && token ? twilio(sid, token) : null;
}

// ── Send helpers ──────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const resend   = getResend();
  const fromAddr = process.env.RESEND_FROM ?? 'NauticShield <alerts@nauticshield.io>';
  if (!resend || !to) return;
  try {
    await resend.emails.send({
      from:    fromAddr,
      to:      [to],
      subject,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;
                    background:#0d1421;color:#f0f4f8;border-radius:12px;padding:28px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            <span style="font-size:22px;">⚓</span>
            <span style="font-size:18px;font-weight:800;color:#d4a847;">NauticShield</span>
          </div>
          <h2 style="margin:0 0 12px;font-size:16px;color:#f0f4f8;">${subject}</h2>
          <p style="margin:0 0 20px;font-size:14px;color:#8a9ab0;line-height:1.6;">${body}</p>
          <div style="border-top:1px solid #1a2535;padding-top:16px;
                      font-size:11px;color:#4a5a6a;">
            This alert was sent by NauticShield — Marine Cybersecurity Platform.<br/>
            Manage notification preferences in Settings → Notifications.
          </div>
        </div>`,
    });
  } catch (e) {
    console.warn('[Notifier] Email send failed:', e instanceof Error ? e.message : e);
  }
}

async function sendSms(to: string, body: string): Promise<void> {
  const client = getTwilio();
  const from   = process.env.TWILIO_FROM_NUMBER;
  if (!client || !from || !to) return;
  try {
    await client.messages.create({ to, from, body: `NauticShield Alert: ${body}` });
  } catch (e) {
    console.warn('[Notifier] SMS send failed:', e instanceof Error ? e.message : e);
  }
}

// ── Public API ────────────────────────────────────────────────────

export interface NotifyPayload {
  category: NotificationCategory;
  subject:  string;
  body:     string;
}

export async function notify(payload: NotifyPayload): Promise<void> {
  const prefs = db.getNotificationPrefs();
  const catPref = prefs.categories[payload.category];
  if (!catPref) return;

  const tasks: Promise<void>[] = [];

  if (catPref.email && prefs.emailTo) {
    tasks.push(sendEmail(prefs.emailTo, payload.subject, payload.body));
  }
  if (catPref.sms && prefs.phoneTo) {
    tasks.push(sendSms(prefs.phoneTo, payload.body));
  }

  await Promise.allSettled(tasks);
}
