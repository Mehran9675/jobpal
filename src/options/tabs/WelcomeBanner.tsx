import { useEffect, useState } from 'react';
import { sendMessage } from '@/lib/messaging';
import { Button } from '@/ui/components';
import { IconSparkles, IconX } from '@/ui/components/Icons';

const STORAGE_KEY = 'jobpal.welcome.dismissed';

export function WelcomeBanner({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [dismissed, setDismissed] = useState(true);
  const [hasProfile, setHasProfile] = useState(true);
  const [hasAI, setHasAI] = useState(true);

  useEffect(() => {
    void (async () => {
      const stored = await chrome.storage.local.get([STORAGE_KEY]);
      const settings = await sendMessage('settings.get', undefined).catch(() => undefined);
      const profiles = await sendMessage('profile.list', undefined).catch(() => []);
      const profile = profiles.find((item) => item.isDefault) ?? profiles[0];
      setHasProfile(Boolean(profile?.contact?.email));
      setHasAI(Boolean(settings?.ai.activeProviderId));
      setDismissed(Boolean(stored[STORAGE_KEY]) && !window.location.hash.includes('welcome'));
    })();
  }, []);

  if (dismissed || (hasProfile && hasAI)) return null;

  const steps = [
    { done: hasProfile, label: 'Add your details and work history', tab: 'profile' },
    { done: hasAI, label: 'Connect an AI provider (required for tailoring)', tab: 'ai' },
    { done: false, label: 'Pick a resume design', tab: 'templates' },
    { done: false, label: 'Open any job posting and press “Tailor & fill”', tab: 'dashboard' },
  ];

  const renderStep = (step: { done: boolean; label: string; tab: string }) => (
    <div key={step.tab} className="list-item" style={{ cursor: 'pointer' }} onClick={() => onNavigate(step.tab)}>
      <span style={{ fontSize: 16 }}>{step.done ? '✅' : '⬜'}</span>
      <div className="list-item__main">
        <div className="list-item__title">{step.label}</div>
      </div>
    </div>
  );

  return (
    <div className="panel" style={{ background: 'linear-gradient(135deg, var(--accent-soft), transparent 70%)' }}>
      <div className="row row--between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="panel__title">
            <IconSparkles size={16} /> Welcome to JobPaal
          </div>
          <div className="panel__hint">Four quick steps and your next application will take seconds instead of an hour.</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<IconX size={13} />}
          onClick={() => {
            setDismissed(true);
            void chrome.storage.local.set({ [STORAGE_KEY]: true });
          }}
        />
      </div>
      <div className="grid grid--2">{steps.map(renderStep)}</div>
    </div>
  );
}
