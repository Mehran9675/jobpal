import type { ResumeTemplate } from '@/types';
import { Badge } from '@/ui/components';
import { TemplatePreview } from './TemplatePreview';

export function TemplateCard({
  template,
  selected,
  accent,
  onSelect,
}: {
  template: ResumeTemplate;
  selected: boolean;
  accent: string;
  onSelect: () => void;
}) {
  const renderTag = (tag: string) => (
    <span className="chip" key={tag}>
      {tag}
    </span>
  );

  return (
    <button className={`template-card ${selected ? 'active' : ''}`} onClick={onSelect}>
      <div className="template-card__preview">
        <TemplatePreview template={template} accent={accent} />
      </div>
      <div className="row row--between">
        <span className="template-card__name">{template.name}</span>
        <Badge tone={template.atsScore >= 95 ? 'success' : 'neutral'}>ATS {template.atsScore}</Badge>
      </div>
      <div className="template-card__desc">{template.description}</div>
      <div className="template-card__tags">{template.tags.map(renderTag)}</div>
    </button>
  );
}
