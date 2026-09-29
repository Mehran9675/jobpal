import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/ui/styles/app.scss';
import { ToastProvider } from '@/ui/components/Toast';
import { OptionsApp } from './App';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ToastProvider>
        <OptionsApp />
      </ToastProvider>
    </StrictMode>,
  );
}
