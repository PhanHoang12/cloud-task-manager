export const HOUR = 60 * 60 * 1000;
export const REMINDER_ZONE = 'Asia/Ho_Chi_Minh';
export type ReminderStage = '24h' | '2h';
export const validEmail = (email: string) => email.length <= 254 && /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/.test(email);
export function emailConfig() {
  if (process.env.DEADLINE_EMAIL_ENABLED !== 'true') return null;
  const user = process.env.SMTP_USER?.trim() ?? '';
  const pass = process.env.SMTP_PASS ?? '';
  const from = process.env.SMTP_FROM?.trim() || user;
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || '465');
  if (!validEmail(user) || !validEmail(from) || !pass || !/^[a-zA-Z0-9.-]+$/.test(host) || ![465, 587].includes(port)) return null;
  try {
    const url = new URL(process.env.EMAIL_APP_URL ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return { user, pass, from, host, port, baseUrl: url.origin };
  } catch { return null; }
}
export function reminderWindow(dueDate: string, now: number): ReminderStage | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const date = new Date(`${dueDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dueDate) return null;
  const remaining = Date.parse(`${dueDate}T00:00:00+07:00`) + 24 * HOUR - now;
  return remaining > 0 && remaining <= 24 * HOUR ? (remaining <= 2 * HOUR ? '2h' : '24h') : null;
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
export type EmailTask = { title: string; project: string; dueDate: string; workspaceId: string; projectId: string; taskId: string };
export function deadlineMessage(baseUrl: string, stage: ReminderStage, items: EmailTask[]) {
  const label = stage === '2h' ? '2 hours' : '24 hours';
  const subject = `CloudTask Pro: ${items.length} ${items.length === 1 ? 'task due' : 'tasks due'} within ${label}`;
  const rows = items.map(item => {
    const url = `${baseUrl}/workspaces/${encodeURIComponent(item.workspaceId)}/projects/${encodeURIComponent(item.projectId)}?task=${encodeURIComponent(item.taskId)}`;
    const due = `${item.dueDate}, 23:59 (${REMINDER_ZONE}, UTC+7)`;
    return { ...item, url, due };
  });
  return {
    subject,
    text: `${subject}\n\n${rows.map(item => `${item.title}\nProject: ${item.project}\nDue: ${item.due}\nOpen task: ${item.url}`).join('\n\n')}\n\nManage email reminders: ${baseUrl}/profile\nYou receive this because you enabled deadline email reminders in CloudTask Pro.`,
    html: `<div style="font-family:Arial,sans-serif;color:#192640;max-width:620px;margin:auto;padding:24px"><p style="color:#4965ed;font-weight:bold">CloudTask Pro</p><h1 style="font-size:22px">Your upcoming deadlines</h1><p>These assigned tasks are due within ${label}.</p>${rows.map(item => `<div style="border-top:1px solid #e1e6ef;padding:18px 0"><h2 style="font-size:17px;margin:0 0 8px">${escape(item.title)}</h2><p>${escape(item.project)}<br>Due: ${escape(item.due)}</p><a style="color:#3453d9;font-weight:bold" href="${escape(item.url)}">Open task &rarr;</a></div>`).join('')}<p style="font-size:12px;color:#65738a">You enabled deadline email reminders. <a href="${escape(baseUrl)}/profile">Manage preferences</a>. Sign in to access your tasks.</p></div>`,
  };
}
