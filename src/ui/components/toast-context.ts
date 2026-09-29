import { createContext } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface ToastApi {
  push: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
