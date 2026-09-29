import type { AppSettings } from '@/types';
import { TERMS_CHECKS, TERMS_VERSION, termsAccepted, type LegalCheck } from '@/lib/legal';
import { Badge, SectionCard, Show, TermsSections } from '@/ui/components';
import { IconCheck } from '@/ui/components/Icons';
import { relativeTime } from '@/lib/utils';

export function TermsTab({ settings }: { settings: AppSettings }) {
  const accepted = termsAccepted(settings);
  const acceptedAt = settings.terms?.acceptedAt;

  const renderCheck = (check: LegalCheck) => (
    <div className="terms__check terms__check--readonly" key={check.id}>
      <IconCheck size={14} />
      <span>{check.statement}</span>
    </div>
  );

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Terms and privacy</h1>
          <p className="main__subtitle">
            The full agreement, version {TERMS_VERSION}. It is always available here, and you had to accept every statement before using the extension.
          </p>
        </div>
      </header>

      <SectionCard title="Your acceptance" hint="Recorded locally when you ticked every box on first run. Changing the terms later requires accepting the new version.">
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <Show if={accepted}>
            <Badge tone="success">Accepted</Badge>
          </Show>
          <Show if={!accepted}>
            <Badge tone="warning">Not accepted</Badge>
          </Show>
          <Show if={Boolean(acceptedAt)}>
            <span className="small muted">{`Version ${settings.terms.version} - accepted ${relativeTime(acceptedAt as number)}`}</span>
          </Show>
        </div>
      </SectionCard>

      <SectionCard title="What you agreed to">
        <div className="terms__checks">{TERMS_CHECKS.map(renderCheck)}</div>
      </SectionCard>

      <SectionCard title="Full text" hint="JobPaal is open source under the Apache License, Version 2.0.">
        <TermsSections />
      </SectionCard>
    </>
  );
}
