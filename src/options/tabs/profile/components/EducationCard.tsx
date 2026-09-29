import type { EducationItem } from '@/types';
import { Badge, Button, Field, Input } from '@/ui/components';
import { IconTrash } from '@/ui/components/Icons';

export function EducationCard({
  item,
  onChange,
  onRemove,
}: {
  item: EducationItem;
  onChange: (patch: Partial<EducationItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="card card--flat">
      <div className="row row--between mb-2">
        <Badge tone="primary">{item.school || 'New entry'}</Badge>
        <Button size="sm" variant="ghost" icon={<IconTrash size={13} />} onClick={onRemove} />
      </div>
      <div className="grid grid--3">
        <Field label="School">
          <Input value={item.school} onChange={(event) => onChange({ school: event.target.value })} />
        </Field>
        <Field label="Degree">
          <Input value={item.degree} onChange={(event) => onChange({ degree: event.target.value })} />
        </Field>
        <Field label="Field of study">
          <Input value={item.field} onChange={(event) => onChange({ field: event.target.value })} />
        </Field>
        <Field label="Start">
          <Input value={item.start ?? ''} onChange={(event) => onChange({ start: event.target.value })} />
        </Field>
        <Field label="End">
          <Input value={item.end ?? ''} onChange={(event) => onChange({ end: event.target.value })} />
        </Field>
        <Field label="GPA / grade">
          <Input value={item.gpa ?? ''} onChange={(event) => onChange({ gpa: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}
