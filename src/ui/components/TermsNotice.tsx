import { TERMS_VERSION } from '@/lib/legal';
import { Button } from './Button';

/** Compact gate for the popup and side panel, which link to the full gate. */
export function TermsNotice({ onReview }: { onReview: () => void }) {
  return (
    <div className="terms-notice">
      <h2 className="terms-notice__title">Before you can use JobPaal</h2>
      <p className="terms-notice__text">
        Read and accept the Terms of Use and Privacy Policy (version {TERMS_VERSION}) in the JobPaal management page. It explains what JobPaal does with your
        data, that the developer cannot retain or harvest it, that your AI provider's policies are outside JobPaal's control, and your responsibilities when
        applying.
      </p>
      <Button variant="primary" onClick={onReview}>
        Review and accept
      </Button>
    </div>
  );
}
