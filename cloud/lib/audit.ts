import { supabase } from './supabase';
import type { VercelRequest } from '@vercel/node';

export interface AuditEntry {
  org_id?:   string;
  actor:     string;   // userId, 'system', or 'agent'
  action:    string;   // e.g. 'vessel.register', 'sync.push', 'subscription.updated'
  resource?: string;   // e.g. vessel ID
  metadata?: Record<string, unknown>;
  ip?:       string;
}

/** Write an audit log entry. Never throws — failures are logged to stderr only. */
export async function writeAudit(entry: AuditEntry, req?: VercelRequest): Promise<void> {
  try {
    const ip = req
      ? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        ?? (req.socket?.remoteAddress ?? undefined)
      : undefined;

    await supabase.from('audit_log').insert({
      org_id:   entry.org_id   ?? null,
      actor:    entry.actor,
      action:   entry.action,
      resource: entry.resource ?? null,
      metadata: entry.metadata ?? {},
      ip:       entry.ip ?? ip ?? null,
    });
  } catch (err) {
    console.error('[audit] failed to write audit log:', err);
  }
}
