import type { ToastItem } from './toast-context';

const TOAST_ICONS: Record<ToastItem['tone'], string> = {
  success: '✅',
  error: '⛔',
  warning: '⚠️',
  info: 'ℹ️',
};

export function ToastStack({ items }: { items: ToastItem[] }) {
  const renderToast = (item: ToastItem) => (
    <div key={item.id} className={`toast toast--${item.tone}`}>
      <span>{TOAST_ICONS[item.tone]}</span>
      <span>{item.message}</span>
    </div>
  );

  return <div className="toast-stack">{items.map(renderToast)}</div>;
}
