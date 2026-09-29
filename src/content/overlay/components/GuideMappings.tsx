import { useOverlayState } from '../store';
import { runMapField } from '../actions';
import { MiniButton } from './MiniButton';
import { GuideMappingRow } from './GuideMappingRow';
import { Icon } from './Icon';

export function GuideMappings() {
  const state = useOverlayState();

  const renderMapping = (mapping: { selector: string; key: string; label?: string }) => (
    <GuideMappingRow key={mapping.selector} selector={mapping.selector} fieldKey={mapping.key} label={mapping.label} />
  );

  return (
    <div className="jp-guide-mappings">
      <div className="jp-guide-label">
        <Icon name="keyboard" size={13} />
        <span>Application fields</span>
      </div>
      {state.mappings.length === 0 ? (
        <div className="jp-guide-value">No manual field mappings - autofill uses its own detection.</div>
      ) : (
        state.mappings.map(renderMapping)
      )}
      <MiniButton icon="target" onClick={() => void runMapField()} disabled={state.picking || state.busy}>
        Map a field on this page
      </MiniButton>
    </div>
  );
}
