import { useOverlayState } from '../store';
import { Show } from '@/ui/components';
import { JobCard } from './JobCard';
import { ActionsRow } from './ActionsRow';
import { AiNotice } from './AiNotice';
import { AutofillNotice } from './AutofillNotice';
import { DetectionNotice } from './DetectionNotice';
import { NoJobNotice } from './NoJobNotice';
import { MatchPanel } from './MatchPanel';
import { GuidePanel } from './GuidePanel';
import { BusyRow } from './BusyRow';
import { StatusMessage } from './StatusMessage';
import { DocumentsSection } from './DocumentsSection';
import { AnswersSection } from './AnswersSection';
import { DescriptionStatus } from './DescriptionStatus';
import { JobPicker } from './JobPicker';
import { NoDescriptionDialog } from './NoDescriptionDialog';
import { UsageRow } from './UsageRow';
import { PanelFooter } from './PanelFooter';

export function MainView() {
  const state = useOverlayState();

  return (
    <>
      <JobCard />
      <Show if={!state.health.ok}>
        <DetectionNotice />
      </Show>
      <DescriptionStatus />
      <Show if={state.confirmNoDescription}>
        <NoDescriptionDialog />
      </Show>
      <Show if={state.jobPickerOpen}>
        <JobPicker />
      </Show>
      <ActionsRow />
      <Show if={state.context.hasApplicationForm}>
        <AutofillNotice />
      </Show>
      {/*<Show if={!state.aiReady}>*/}
      {/*  <AiNotice />*/}
      {/*</Show>*/}
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
