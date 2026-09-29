import { useState } from 'react';
import { TERMS_CHECKS, TERMS_VERSION, type LegalCheck } from '@/lib/legal';
import { Button } from './Button';
import { TermsSections } from './TermsSections';

/**
 * Full-page agreement gate. Every statement needs its own checkbox and the
 * accept button stays disabled until all of them are ticked.
 */
export function TermsGate({ onAccept }: { onAccept: () => void | Promise<void> }) {
  const [checked, setChecked] = useState<boolean[]>(() => TERMS_CHECKS.map(() => false));
  const [busy, setBusy] = useState(false);
  const allAccepted = checked.every(Boolean);

  const renderCheck = (check: LegalCheck, index: number) => (
    <label className="terms__check" key={check.id}>
      <input
        type="checkbox"
        checked={checked[index]}
        onChange={(event) => setChecked((current) => current.map((entry, position) => (position === index ? event.target.checked : entry)))}
      />
      <span>{check.statement}</span>
    </label>
  );

  const accept = async () => {
    setBusy(true);
    try {
      await onAccept();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="terms">
      <div className="terms__card">
        <header className="terms__header">
          <h1 className="terms__title">JobPaal Terms of Use and Privacy Policy</h1>
          <p className="terms__intro">
            Version {TERMS_VERSION}. You must read and accept the following before using the extension.
          </p>
        </header>
        <div className="terms__body">
          <TermsSections />
          <h3 className="terms__heading">Agreement</h3>
          <div className="terms__checks">{TERMS_CHECKS.map(renderCheck)}</div>
        </div>
        <footer className="terms__footer">
          <Button variant="primary" disabled={!allAccepted || busy} loading={busy} onClick={() => void accept()}>
            {allAccepted ? 'Accept and continue' : 'Tick every box to continue'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
