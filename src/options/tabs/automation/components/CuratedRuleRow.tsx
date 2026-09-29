import type { RuleDef } from '@/types';
import { Input, Show, Toggle } from '@/ui/components';
import { IconRobot } from '@/ui/components/Icons';

export function CuratedRuleRow({
  rule,
  state,
  onSetRule,
}: {
  rule: RuleDef;
  state: { enabled: boolean; value?: string | number };
  onSetRule: (id: string, enabled: boolean, value?: number) => void;
}) {
  return (
    <div className="list-item">
      <IconRobot size={16} />
      <div className="list-item__main">
        <div className="list-item__title">{rule.label}</div>
        <div className="list-item__meta">{rule.description}</div>
      </div>
      <div className="row">
        <Show if={rule.configurable === 'number'}>
          <Input
            type="number"
            style={{ width: 110 }}
            value={(state.value as number) ?? (rule.defaultValue as number) ?? 0}
            onChange={(event) => onSetRule(rule.id, state.enabled, Number(event.target.value))}
          />
        </Show>
        <Toggle checked={state.enabled} onChange={(enabled) => onSetRule(rule.id, enabled)} />
      </div>
    </div>
  );
}
