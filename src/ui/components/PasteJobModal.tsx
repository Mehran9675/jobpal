import { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Textarea } from './Primitives';
import { errorMessage } from '@/lib/messaging';

export interface PastedJobInput {
  text: string;
  title: string;
  company: string;
}

export function PasteJobModal({
  open,
  onClose,
  defaultTitle,
  defaultCompany,
  onTailor,
}: {
  open: boolean;
  onClose: () => void;
  defaultTitle?: string;
  defaultCompany?: string;
  onTailor: (input: PastedJobInput) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState(defaultTitle ?? '');
  const [company, setCompany] = useState(defaultCompany ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle ?? '');
    setCompany(defaultCompany ?? '');
    setError(null);
  }, [open, defaultTitle, defaultCompany]);

  if (!open) return null;

  const submit = async () => {
    if (text.trim().length < 40) {
      setError('Paste the full job description first (at least a few sentences) so the tailoring has something to work with.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onTailor({ text: text.trim(), title: title.trim(), company: company.trim() });
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="Paste job description"
      subtitle="For postings that have no readable description - “email us your resume” pages, images, PDFs or portals. JobPaal treats it exactly like a scraped description."
      onClose={onClose}
      wide
    >
      <Field label="Job description">
        <Textarea
          rows={10}
          value={text}
          placeholder="Paste the full posting here - responsibilities, requirements, everything…"
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />
      </Field>
      <div className="grid grid--2">
        <Field label="Role title (optional)" hint="Falls back to the page title when empty.">
          <Input value={title} placeholder="Senior Platform Engineer" onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Company (optional)" hint="Falls back to the site name when empty.">
          <Input value={company} placeholder="Northwind Systems" onChange={(event) => setCompany(event.target.value)} />
        </Field>
      </div>
      {error && <div className="field__error mb-2">{error}</div>}
      <div className="modal__footer">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" loading={busy} onClick={() => void submit()}>
          Save & tailor
        </Button>
      </div>
    </Modal>
  );
}
