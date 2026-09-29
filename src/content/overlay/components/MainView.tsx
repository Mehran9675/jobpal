import { useOverlayState } from '../store';
import { Show } from '@/ui/components';
import { JobCard } from './JobCard';
import { ActionsRow } from './ActionsRow';
import { AiNotice } from './AiNotice';
import { PickingNotice } from './PickingNotice';
import { NoJobNotice } from './NoJobNotice';
import { MatchPanel } from './MatchPanel';
import { GuidePanel } from './GuidePanel';
import { BusyRow } from './BusyRow';
import { StatusMessage } from './StatusMessage';
import { DocumentsSection } from './DocumentsSection';
import { AnswersSection } from './AnswersSection';
import { UsageRow } from './UsageRow';
import { PanelFooter } from './PanelFooter';

export function MainView() {
  const state = useOverlayState();

  return (
    <>
      <JobCard />
      <ActionsRow />
      <Show if={!state.aiReady}>
        <AiNotice />
      </Show>
      <Show if={state.picking}>
        <PickingNotice />
      </Show>
      <Show if={!state.job && !state.guideOpen}>
        <NoJobNotice />
      </Show>
      <MatchPanel />
      <Show if={state.guideOpen}>
        <GuidePanel />
      </Show>
      <Show if={state.busy}>
        <BusyRow />
      </Show>
      <Show if={Boolean(state.status)}>
        <StatusMessage tone={state.statusTone}>{state.status}</StatusMessage>
      </Show>
      <DocumentsSection />
      <AnswersSection />
      <UsageRow />
      <PanelFooter />
    </>
  );
}
