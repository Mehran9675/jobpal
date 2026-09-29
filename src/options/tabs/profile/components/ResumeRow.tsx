import type { BaseResume } from '@/types';
import { Badge, Button, Show } from '@/ui/components';
import { IconSparkles, IconTrash } from '@/ui/components/Icons';

export function ResumeRow({
  resume,
  busy,
  aiReady,
  onParse,
  onDelete,
}: {
  resume: BaseResume;
  busy: string | null;
  aiReady: boolean;
  onParse: (resume: BaseResume) => void;
  onDelete: (resume: BaseResume) => void;
}) {
  return (
    <tr>
      <td>
        <div className="strong">{resume.fileName ?? resume.name}</div>
        <div className="tiny muted">{resume.rawText.slice(0, 90)}…</div>
      </td>
      <td className="muted small nowrap">{new Date(resume.createdAt).toLocaleDateString()}</td>
      <td>
        <Show if={Boolean(resume.parsedAt)}>
          <Badge tone="success">Parsed</Badge>
        </Show>
        <Show if={!resume.parsedAt}>
          <Badge>Raw</Badge>
        </Show>
      </td>
      <td className="text-right">
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="outline"
            icon={<IconSparkles size={13} />}
            loading={busy === `parse:${resume.id}`}
            disabled={!aiReady}
            title={aiReady ? 'Parse with AI into structured fields' : 'Connect an AI provider to enable parsing'}
            onClick={() => onParse(resume)}
          >
            Parse
          </Button>
          <Button size="sm" variant="ghost" icon={<IconTrash size={13} />} onClick={() => onDelete(resume)} />
        </div>
      </td>
    </tr>
  );
}
