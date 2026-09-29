import { useOverlayState } from '../store';
import { clearStoredJob, openJobPicker, pasteDescriptionFromClipboard, runPick, toggleDescription } from '../actions';
import { MiniButton } from './MiniButton';
import { Icon } from './Icon';
import { Show } from '@/ui/components';

const STATUS_WORDS: Record<string, string> = {
  page: 'Detected',
  stored: 'Found',
  manual: 'Selected',
  none: 'Not detected',
};

const SOURCE_DETAILS: Record<string, string> = {
  page: 'read from this page',
  stored: 'from your stored jobs',
  manual: 'from your selection or pasted text',
  none: '',
};

const PREVIEW_CHARS = 1200;

export function DescriptionStatus() {
  const state = useOverlayState();
  const description = state.job?.description ?? '';
  const hasDescription = state.descriptionWords >= 20;
  const showScopeHint = !hasDescription && state.jobSource === 'none';

  const labelParts = [STATUS_WORDS[state.jobSource] ?? 'Not detected', SOURCE_DETAILS[state.jobSource] ?? '', `${state.descriptionWords.toLocaleString()} words`];
  const statusLabel = hasDescription ? labelParts.filter(Boolean).join(' - ') : 'Not detected - pick it on the page or paste it';

  return (
    <div className="jp-desc">
      <div className="jp-docs-head">
        <span className="jp-guide-label">
          <Icon name="file" size={13} />
          <span>Job description</span>
        </span>
        <span className={`jp-desc-state ${hasDescription ? 'ok' : 'missing'}`}>{statusLabel}</span>
      </div>

      <div className="jp-doc-actions">
        <MiniButton onClick={() => void runPick('description')} disabled={state.picking || state.busy}>
          Pick on page
        </MiniButton>
        <MiniButton title="Read the clipboard and use it as the job description" onClick={() => void pasteDescriptionFromClipboard()}>
          Paste
        </MiniButton>
        <MiniButton onClick={() => void openJobPicker()}>Recent jobs</MiniButton>
        <Show if={state.jobSource === 'stored'}>
          <MiniButton onClick={() => void clearStoredJob()}>Use this page</MiniButton>
        </Show>
        <Show if={hasDescription}>
          <MiniButton onClick={() => toggleDescription()}>{state.showDescription ? 'Hide' : 'View'}</MiniButton>
        </Show>
      </div>

      <Show if={state.picking}>
        <div className="jp-guide-hint">Click the element on the page that contains the text you want. Press Esc to cancel.</div>
      </Show>

      <Show if={showScopeHint}>
        <div className="jp-guide-hint">
          JobPaal covers the common cases - single-page forms, Easy Apply and standard ATS pages (Greenhouse, Lever, Workday, Ashby, SmartRecruiters...). For
          unusual forms, pick or paste the description here and fill the rest yourself; your files stay available below to download and attach.
        </div>
      </Show>

      <Show if={state.showDescription && hasDescription}>
        <div className="jp-desc-preview">{description.slice(0, PREVIEW_CHARS)}</div>
      </Show>
      <Show if={state.showDescription && !hasDescription}>
        <div className="jp-guide-value">No description captured yet.</div>
      </Show>
    </div>
  );
}
