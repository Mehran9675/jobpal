import type { SkillGroup } from '@/types';
import { Button, Input, Textarea } from '@/ui/components';
import { IconTrash } from '@/ui/components/Icons';

export function SkillGroupCard({ group, onChange, onRemove }: { group: SkillGroup; onChange: (patch: Partial<SkillGroup>) => void; onRemove: () => void }) {
  return (
    <div className="card card--flat">
      <div className="row mb-2">
        <Input value={group.category} style={{ maxWidth: 220 }} onChange={(event) => onChange({ category: event.target.value })} />
        <Button size="sm" variant="ghost" icon={<IconTrash size={13} />} onClick={onRemove} />
      </div>
      <Textarea
        rows={2}
        value={group.items.join(', ')}
        placeholder="TypeScript, React, Node.js, PostgreSQL"
        onChange={(event) => onChange({ items: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
      />
    </div>
  );
}
