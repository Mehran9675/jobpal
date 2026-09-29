import type { RefObject } from 'react';
import type { DocumentRecord } from '@/types';
import { Badge, Button, Show } from '@/ui/components';
import { IconTrash, IconUpload } from '@/ui/components/Icons';

export function OwnFileCard({
  kind,
  label,
  inputRef,
  existing,
  onUpload,
  onRemove,
}: {
  kind: 'resume' | 'cover_letter';
  label: string;
  inputRef: RefObject<HTMLInputElement>;
  existing?: DocumentRecord;
  onUpload: (kind: 'resume' | 'cover_letter', file: File) => void;
  onRemove: (kind: 'resume' | 'cover_letter') => void;
}) {
  return (
    <div className="card card--flat">
      <div className="row row--between mb-2">
        <div className="card__title">{label}</div>
        <Show if={Boolean(existing)}>
          <Badge tone="success">Uploaded</Badge>
        </Show>
        <Show if={!existing}>
          <Badge>Not uploaded</Badge>
        </Show>
      </div>
      <div className="tiny muted mb-2" style={{ wordBreak: 'break-all' }}>
        {existing ? `${existing.filename} · ${Math.max(1, Math.round(existing.size / 1024))} KB` : 'PDF or DOCX recommended.'}
      </div>
      <div className="row">
        <Button size="sm" variant="outline" icon={<IconUpload size={14} />} onClick={() => inputRef.current?.click()}>
          {existing ? 'Replace file' : 'Upload file'}
        </Button>
        <Show if={Boolean(existing)}>
          <Button size="sm" variant="ghost" icon={<IconTrash size={14} />} onClick={() => onRemove(kind)}>
            Remove
          </Button>
        </Show>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.html,.md,.txt,.json"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(kind, file);
          event.target.value = '';
        }}
      />
    </div>
  );
}
