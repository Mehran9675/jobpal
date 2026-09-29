import { GUIDE_TARGETS } from '../constants';
import { GuideTargetRow } from './GuideTargetRow';
import { GuideMappings } from './GuideMappings';

export function GuidePanel() {
  const renderGuideTarget = (entry: (typeof GUIDE_TARGETS)[number]) => (
    <GuideTargetRow key={entry.target} target={entry.target} label={entry.label} icon={entry.icon} />
  );

  return (
    <div className="jp-guide">
      <div className="jp-guide-title">Guide JobPal on this page</div>
      <div className="jp-guide-hint">
        Pick the elements that hold each piece of information, or paste the text when a value lives inside a frame JobPal cannot read. Every change is saved for this site automatically, so detection works next time too.
      </div>
      {GUIDE_TARGETS.map(renderGuideTarget)}
      <GuideMappings />
    </div>
  );
}
