import type { WorkExperience } from '@/types';
import { Badge, Button, Field, Input, Textarea, Toggle } from '@/ui/components';
import { IconTrash } from '@/ui/components/Icons';

export function ExperienceCard({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: WorkExperience;
  index: number;
  onChange: (patch: Partial<WorkExperience>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="card card--flat">
      <div className="row row--between mb-2">
        <Badge tone="primary">Role {index + 1}</Badge>
        <div className="row">
          <Toggle checked={item.current} onChange={(current) => onChange({ current, end: current ? undefined : item.end })} label="Current" />
          <Button size="sm" variant="ghost" icon={<IconTrash size={13} />} onClick={onRemove} />
        </div>
      </div>
      <div className="grid grid--3">
        <Field label="Job title">
          <Input value={item.title} onChange={(event) => onChange({ title: event.target.value })} />
        </Field>
        <Field label="Company">
          <Input value={item.company} onChange={(event) => onChange({ company: event.target.value })} />
        </Field>
        <Field label="Location">
          <Input value={item.location ?? ''} onChange={(event) => onChange({ location: event.target.value })} />
        </Field>
        <Field label="Start (YYYY-MM)">
          <Input value={item.start} onChange={(event) => onChange({ start: event.target.value })} />
        </Field>
        <Field label="End (YYYY-MM)">
          <Input value={item.end ?? ''} disabled={item.current} onChange={(event) => onChange({ end: event.target.value })} />
        </Field>
        <Field label="Skills used" hint="Comma separated">
          <Input value={item.skills.join(', ')} onChange={(event) => onChange({ skills: event.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </Field>
      </div>
      <Field label="Context (one sentence)">
        <Input value={item.description} onChange={(event) => onChange({ description: event.target.value })} />
      </Field>
      <Field label="Achievements" hint="One per line. Include numbers wherever possible.">
        <Textarea rows={4} value={item.highlights.join('\n')} onChange={(event) => onChange({ highlights: event.target.value.split('\n').filter(Boolean) })} />
      </Field>
    </div>
  );
}
