import { Button, Toggle } from '@/ui/components';

export function SectionRow({
  label,
  index,
  total,
  hidden,
  onMoveUp,
  onMoveDown,
  onToggle,
}: {
  label: string;
  index: number;
  total: number;
  hidden: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="list-item">
      <div className="list-item__main">
        <div className="list-item__title">{label}</div>
        <div className="list-item__meta">Position {index + 1}</div>
      </div>
      <div className="row">
        <Button size="sm" variant="ghost" disabled={index === 0} onClick={onMoveUp}>
          ↑
        </Button>
        <Button size="sm" variant="ghost" disabled={index === total - 1} onClick={onMoveDown}>
          ↓
        </Button>
        <Toggle checked={!hidden} onChange={onToggle} />
      </div>
    </div>
  );
}
