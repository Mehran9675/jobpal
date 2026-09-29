import type { ResumeTemplate } from '@/types';
import { Show } from '@/ui/components';

export function TemplatePreview({ template, accent }: { template: ResumeTemplate; accent: string }) {
  if (template.layout === 'sidebar-left' || template.layout === 'sidebar-right') {
    const isRight = template.layout === 'sidebar-right';
    return (
      <div className="template-card__mini">
        <div className="mini-sidebar" style={{ [isRight ? 'right' : 'left']: 0, background: accent }} />
        <div style={{ marginLeft: isRight ? 0 : '36%', marginRight: isRight ? '36%' : 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="mini-name" style={{ background: accent }} />
          <div className="mini-line" style={{ width: '80%' }} />
          <div className="mini-heading" style={{ background: accent }} />
          <div className="mini-line" />
          <div className="mini-line" style={{ width: '92%' }} />
          <div className="mini-line" style={{ width: '74%' }} />
          <div className="mini-heading" style={{ background: accent, marginTop: 4 }} />
          <div className="mini-line" />
          <div className="mini-line" style={{ width: '85%' }} />
        </div>
      </div>
    );
  }
  if (template.layout === 'two-column') {
    return (
      <div className="template-card__mini">
        <div className="mini-name" style={{ background: accent }} />
        <div className="row" style={{ gap: 8, alignItems: 'flex-start', flex: 1 }}>
          <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="mini-heading" style={{ background: accent }} />
            <div className="mini-line" />
            <div className="mini-line" style={{ width: '90%' }} />
            <div className="mini-line" style={{ width: '78%' }} />
            <div className="mini-heading" style={{ background: accent, marginTop: 4 }} />
            <div className="mini-line" />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="mini-heading" style={{ background: accent }} />
            <div className="mini-line" />
            <div className="mini-line" style={{ width: '70%' }} />
            <div className="mini-heading" style={{ background: accent, marginTop: 4 }} />
            <div className="mini-line" />
          </div>
        </div>
      </div>
    );
  }
  if (template.layout === 'modern-header' || template.layout === 'timeline') {
    return (
      <div className="template-card__mini">
        <div style={{ height: 34, borderRadius: 6, background: accent, marginBottom: 6 }} />
        <div className="mini-line" />
        <div className="mini-line" style={{ width: '88%' }} />
        <div className="mini-heading" style={{ background: accent, marginTop: 5 }} />
        <div className="mini-line" />
        <div className="mini-line" style={{ width: '72%' }} />
        <Show if={template.layout === 'timeline'}>
          <div className="mini-line" style={{ width: '94%' }} />
        </Show>
      </div>
    );
  }
  return (
    <div className="template-card__mini" style={{ alignItems: template.layout === 'classic' || template.layout === 'compact' ? 'center' : 'flex-start' }}>
      <div className="mini-name" style={{ background: '#111827' }} />
      <div className="mini-line" style={{ width: '54%' }} />
      <div style={{ width: '100%', height: 1, background: accent, margin: '4px 0' }} />
      <div className="mini-heading" style={{ background: accent }} />
      <div className="mini-line" style={{ width: '90%' }} />
      <div className="mini-line" style={{ width: '76%' }} />
      <div className="mini-heading" style={{ background: accent, marginTop: 4 }} />
      <div className="mini-line" />
    </div>
  );
}
