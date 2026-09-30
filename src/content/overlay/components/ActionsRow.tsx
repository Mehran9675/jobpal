import type { IconName } from './Icon';
import { patchOverlay, useOverlayState } from '../store';
import { runFill, runOpen, runTailorOrFill } from '../actions';
import { ActionButton } from './ActionButton';

interface ActionDefinition {
  label: string;
  icon: IconName;
  variant?: string;
  disabled: boolean;
  title?: string;
  onClick: () => void;
}

export function ActionsRow() {
  const state = useOverlayState();
  const aiTitle = state.aiReady ? undefined : 'Connect an AI provider to enable tailoring';
  const hasDocuments = state.documents.length > 0;

  const actions: ActionDefinition[] = [
    {
      label: hasDocuments ? 'Fill this page' : 'Tailor & fill',
      icon: hasDocuments ? 'keyboard' : 'sparkles',
      variant: 'jp-btn primary',
      disabled: hasDocuments ? false : !state.aiReady || !state.job,
      title: hasDocuments ? 'Use the documents already generated for this page - no new AI run' : aiTitle,
      onClick: () => void runTailorOrFill(),
    },
    {
      label: 'Fill this form',
      icon: 'keyboard',
      disabled: !state.context.hasApplicationForm,
      onClick: () => void runFill(),
    },
    {
      label: state.guideOpen ? 'Hide field guide' : 'Guide me',
      icon: 'target',
      variant: 'jp-btn ghost',
      disabled: false,
      onClick: () => patchOverlay({ guideOpen: !state.guideOpen }),
    },
    {
      label: state.context.site === 'linkedin-profile' ? 'Scan profile' : 'Open JobPaal',
      icon: 'gear',
      variant: 'jp-btn ghost',
      disabled: false,
      onClick: () => void runOpen(),
    },
  ];

  const renderAction = (action: ActionDefinition) => (
    <ActionButton
      key={action.label}
      label={action.label}
      icon={action.icon}
      variant={action.variant}
      disabled={action.disabled}
      title={action.title}
      onClick={action.onClick}
    />
  );

  return <div className="jp-actions">{actions.map(renderAction)}</div>;
}
