import { cancelGenerateWithoutDescription, confirmGenerateWithoutDescription } from '../actions';

export function NoDescriptionDialog() {
  return (
    <div className="jp-confirm">
      <div className="jp-confirm-title">No job description found</div>
      <div className="jp-confirm-text">
        JobPaal could not read a description on this page, so the resume would not be tailored to anything. Are you sure you want to generate anyway?
      </div>
      <div className="jp-confirm-actions">
        <button type="button" className="jp-btn ghost" onClick={() => cancelGenerateWithoutDescription()}>
          Cancel
        </button>
        <button type="button" className="jp-btn primary" onClick={() => void confirmGenerateWithoutDescription()}>
          Generate anyway
        </button>
      </div>
    </div>
  );
}
