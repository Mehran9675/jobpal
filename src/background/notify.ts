import { notificationsCreate, openOptionsPage, runtime } from '@/lib/browser';

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

export function installNotificationClickHandler(): void {
  chrome.notifications?.onClicked.addListener(async () => {
    await openOptionsPage();
  });
}
