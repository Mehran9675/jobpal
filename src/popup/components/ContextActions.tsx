import { Button } from '@/ui/components';
import { IconGauge, IconKeyboard, IconPaste, IconSparkles, IconTarget } from '@/ui/components/Icons';

export interface ContextAction {
  label: string;
  icon: 'sparkles' | 'gauge' | 'target' | 'paste' | 'keyboard';
  variant: 'primary' | 'outline' | 'default';
  disabled: boolean;
  title?: string;
  loading?: boolean;
  onSelect: () => void;
}

const ACTION_ICONS = {
  sparkles: <IconSparkles size={14} />,
  gauge: <IconGauge size={14} />,
  target: <IconTarget size={14} />,
  paste: <IconPaste size={14} />,
  keyboard: <IconKeyboard size={14} />,
};

export function ContextActions({ actions }: { actions: ContextAction[] }) {
  const renderAction = (action: ContextAction) => (
    <Button
      key={action.label}
      variant={action.variant}
      size="sm"
      icon={ACTION_ICONS[action.icon]}
      disabled={action.disabled}
      title={action.title}
      loading={action.loading}
      onClick={action.onSelect}
    >
      {action.label}
    </Button>
  );

  return <div className="context-card__actions">{actions.map(renderAction)}</div>;
}
