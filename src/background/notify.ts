import { notificationsCreate, openOptionsPage, runtime } from '@/lib/browser';
import type { AgentState } from '@/types';

const ICON = runtime.getURL('icons/icon128.png');

export async function notify(title: string, message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info'): Promise<void> {
  const prefix = level === 'success' ? '✅ ' : level === 'warning' ? '⚠️ ' : level === 'error' ? '⛔ ' : '';
  await notificationsCreate({
    type: 'basic',
    iconUrl: ICON,
    title: `${prefix}${title}`,
    message: message.slice(0, 400),
    priority: level === 'error' || level === 'warning' ? 2 : 1,
    silent: level === 'info',
  } as chrome.notifications.NotificationOptions<true>);
}

export async function notifyNeedsAttention(title: string, message: string): Promise<void> {
  await notify(title, `${message}\nClick to open the JobPaal management page.`, 'warning');
}

export function installNotificationClickHandler(): void {
  chrome.notifications?.onClicked.addListener(async () => {
    await openOptionsPage();
  });
}

export async function notifyAgentState(state: AgentState): Promise<void> {
  if (!state.running) return;
  await notify(
    state.paused ? 'JobPaal agent paused' : 'JobPaal agent working',
    state.paused ? 'The agent needs your attention.' : `Queue: ${state.queue.filter((item) => item.status === 'queued').length} remaining · ${state.appliedToday} applied today.`,
    state.paused ? 'warning' : 'info',
  );
}
