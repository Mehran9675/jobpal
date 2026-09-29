import { Button } from '@/ui/components';
import { IconPaste, IconRobot, IconSparkles, IconTarget } from '@/ui/components/Icons';

export function JobActions({
  hasJob,
  aiReady,
  busy,
  tailoring,
  onTailor,
  onQueue,
  onGuide,
  onPaste,
}: {
  hasJob: boolean;
  aiReady: boolean;
  busy: boolean;
  tailoring: boolean;
  onTailor: () => void;
  onQueue: () => void;
  onGuide: () => void;
  onPaste: () => void;
}) {
  const tailorDisabled = !hasJob || !aiReady || busy;

  return (
    <div className="row row--wrap mt-2">
      <Button
        variant="primary"
        icon={<IconSparkles size={15} />}
        loading={tailoring}
        disabled={tailorDisabled}
        title={aiReady ? 'Tailor documents for this job' : 'Connect an AI provider to enable tailoring'}
        onClick={onTailor}
      >
        Tailor & fill
      </Button>
      <Button variant="ghost" icon={<IconRobot size={15} />} disabled={!hasJob} onClick={onQueue}>
        Queue
      </Button>
      <Button variant={hasJob ? 'ghost' : 'outline'} icon={<IconTarget size={15} />} title="Point JobPal at the job title, company and description yourself" onClick={onGuide}>
        Select fields
      </Button>
      <Button variant="outline" icon={<IconPaste size={15} />} title="Paste a job description when this page has none" onClick={onPaste}>
        Paste JD
      </Button>
    </div>
  );
}
