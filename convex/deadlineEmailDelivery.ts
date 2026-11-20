"use node";
import nodemailer from 'nodemailer';
import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { emailConfig } from './deadlineEmailConfig';
import { smtpOutcome } from './smtpOutcome';

function smtpTransport(config: NonNullable<ReturnType<typeof emailConfig>>) {
  return nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.port === 465, requireTLS: true,
    auth: { user: config.user, pass: config.pass },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
  });
}
// Administrator-only diagnostic: no email is sent and no credentials are returned.
export const checkConnection = internalAction({ args: {}, handler: async () => {
  const config = emailConfig();
  if (!config) return { configured: false, connected: false, reason: 'setup_pending' };
  const transport = smtpTransport(config);
  try { await transport.verify(); return { configured: true, connected: true, reason: 'ready' }; }
  catch (error) { return { configured: true, connected: false, reason: (error as {code?:string})?.code === 'EAUTH' ? 'authentication_failed' : 'connection_failed' }; }
  finally { transport.close(); }
} });

export const send = internalAction({ args: { batchId: v.id('deadlineEmailBatches'), lease: v.number() }, handler: async (ctx, { batchId, lease }): Promise<void> => {
  const config = emailConfig(); if (!config) return;
  const attempt = await ctx.runMutation(internal.deadlineEmails.claim, { batchId, lease });
  if (attempt === null) return;
  const transport = smtpTransport(config);
  try {
    const message = await ctx.runMutation(internal.deadlineEmails.beginSend, { batchId, attempt });
    if (!message) return;
    let outcome: 'sent' | 'retry' | 'failed' | 'uncertain';
    try {
      const info = await transport.sendMail({ ...message, from: { name: 'CloudTask Pro', address: config.from },
        messageId: `<deadline-${batchId}@${new URL(config.baseUrl).hostname}>` });
      outcome = info.accepted.length === 1 ? 'sent' : 'failed';
    } catch (error) { outcome = smtpOutcome(error); }
    // If recording acceptance fails, leave 'sending' for conservative recovery.
    await ctx.runMutation(internal.deadlineEmails.complete, { batchId, attempt, outcome });
  } finally { transport.close(); }
} });
