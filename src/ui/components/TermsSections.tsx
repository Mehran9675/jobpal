import { TERMS_SECTIONS, type LegalSection } from '@/lib/legal';

/** Read-only rendering of the full terms text, shared by the gate and the terms page. */
export function TermsSections() {
  const renderSection = (section: LegalSection) => (
    <section className="terms__section" key={section.title}>
      <h3 className="terms__heading">{section.title}</h3>
      <p className="terms__text">{section.body}</p>
    </section>
  );

  return <div className="terms__sections">{TERMS_SECTIONS.map(renderSection)}</div>;
}
