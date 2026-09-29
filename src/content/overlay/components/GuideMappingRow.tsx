import { patchOverlay } from '../store';
import { applyMapping } from '../actions';
import { MAPPING_KEYS } from '../helpers/mappingKeys';

export function GuideMappingRow({ selector, fieldKey, label }: { selector: string; fieldKey: string; label?: string }) {
  return (
    <div className="jp-guide-row">
      <div className="jp-guide-value mono">{label || selector.slice(0, 46)}</div>
      <select
        className="jp-select"
        value={fieldKey}
        onChange={(event) => {
          applyMapping(selector, event.target.value, label);
          const option = MAPPING_KEYS.find((definition) => definition.key === event.target.value);
          patchOverlay({ status: `Field mapped to “${option?.label ?? event.target.value}”.`, statusTone: 'success' });
        }}
      >
        {MAPPING_KEYS.map((definition) => (
          <option key={definition.key} value={definition.key}>
            {definition.label}
          </option>
        ))}
      </select>
    </div>
  );
}
