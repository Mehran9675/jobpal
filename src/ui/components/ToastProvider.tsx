import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type ToastApi, type ToastItem, type ToastTone } from './toast-context';
import { ToastStack } from './ToastStack';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), tone === 'error' ? 8000 : 4500);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      warning: (message) => push(message, 'warning'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack items={items} />
    </ToastContext.Provider>
  );
}
