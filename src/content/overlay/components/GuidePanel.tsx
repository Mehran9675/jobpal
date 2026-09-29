import { useOverlayState } from '../store';
import { runForgetRecipe, runSaveRecipe } from '../actions';
import { GUIDE_TARGETS } from '../constants';
import { MiniButton } from './MiniButton';
import { GuideTargetRow } from './GuideTargetRow';
import { GuidePasteBox } from './GuidePasteBox';
import { GuideMappings } from './GuideMappings';

export function GuidePanel() {
  const state = useOverlayState();

  const renderGuideTarget = (entry: (typeof GUIDE_TARGETS)[number]) => (
    <GuideTargetRow key={entry.target} target={entry.target} label={entry.label} icon={entry.icon} />
  );

  return (
    <div className="jp-guide">
      <div className="jp-guide-title">Guide JobPal on this page</div>
      <div className="jp-guide-hint">
        Pick the elements that hold each piece of information. Selections are remembered for this site, so detection works next time too.
      </div>
      {GUIDE_TARGETS.map(renderGuideTarget)}
      <GuidePasteBox />
      <GuideMappings />
      <div className="jp-guide-footer">
        <MiniButton onClick={() => void runSaveRecipe()}>{state.recipeSaved ? 'Update saved recipe' : 'Save for this site'}</MiniButton>
        <MiniButton className="jp-mini-danger" onClick={() => void runForgetRecipe()}>
          Forget this site
        </MiniButton>
      </div>
    </div>
  );
}
