import { useContext } from 'react';
import { ToastContext } from './toast-context';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      push: (message: string) => console.log('[toast]', message),
      success: (message: string) => console.log('[toast:success]', message),
      error: (message: string) => console.error('[toast:error]', message),
      warning: (message: string) => console.warn('[toast:warning]', message),
    };
  }
  return context;
}
