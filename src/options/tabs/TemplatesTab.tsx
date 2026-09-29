import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { AppSettings, DocumentRecord, ResumeTemplate, SectionId } from '@/types';
import { sendMessage } from '@/lib/messaging';
import { deleteDocument, listDocuments, saveDocument } from '@/lib/db';
import { ACCENT_PRESETS, RESUME_TEMPLATES, getTemplate } from '@/lib/doc/templates';
import { ALL_SECTIONS, DEFAULT_DOCUMENT_SETTINGS } from '@/lib/defaults';
import { Badge, Button, Field, Input, SectionCard, Select, Show, Toggle } from '@/ui/components';
import { IconCheck, IconRefresh, IconTrash, IconUpload } from '@/ui/components/Icons';
import { useToast } from '@/ui/components/Toast';
import { uid } from '@/lib/utils';
import { OwnFileCard } from './templates/components/OwnFileCard';
import { SectionRow } from './templates/components/SectionRow';
import { TemplateCard } from './templates/components/TemplateCard';

export function TemplatesTab({ settings, patchSettings }: { settings: AppSettings; patchSettings: (patch: Record<string, unknown>) => Promise<AppSettings> }) {
  const toast = useToast();
  const document = settings.document;
  const selected = getTemplate(document.templateId);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewKind, setPreviewKind] = useState<'resume' | 'cover_letter'>('resume');
  const [uploadedDocs, setUploadedDocs] = useState<DocumentRecord[]>([]);
  const resumeInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const loadUploaded = useMemo(
    () => async () => {
      try {
        const all = await listDocuments();
        setUploadedDocs(all.filter((item) => item.uploaded));
      } catch {
        setUploadedDocs([]);
      }
    },
    [],
  );

  useEffect(() => {
    void loadUploaded();
  }, [loadUploaded]);

  const uploadedFor = (kind: 'resume' | 'cover_letter') => uploadedDocs.find((item) => item.kind === kind);

  const uploadOwnFile = async (kind: 'resume' | 'cover_letter', file: File) => {
    try {
      const extension = (file.name.split('.').pop() ?? 'pdf').toLowerCase();
      const format = (['pdf', 'docx', 'html', 'md', 'txt', 'json'].includes(extension) ? extension : 'pdf') as DocumentRecord['format'];
      const existing = uploadedFor(kind);
      if (existing) await deleteDocument(existing.id);
      const record: DocumentRecord = {
        id: uid('upload'),
        kind,
        format,
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        createdAt: Date.now(),
        blob: file,
        uploaded: true,
        templateId: 'user-file',
      };
      await saveDocument(record);
      await loadUploaded();
      await patchDocument(kind === 'resume' ? { uploadedResumeId: record.id, fileSource: 'uploaded' } : { uploadedCoverLetterId: record.id, fileSource: 'uploaded' });
      toast.success(`${file.name} saved - JobPal will attach your own file.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const removeOwnFile = async (kind: 'resume' | 'cover_letter') => {
    const existing = uploadedFor(kind);
    if (!existing) return;
    await deleteDocument(existing.id);
    await loadUploaded();
    await patchDocument(kind === 'resume' ? { uploadedResumeId: null } : { uploadedCoverLetterId: null });
    toast.push('Uploaded file removed.');
  };

  const refreshPreview = useMemo(
    () => async () => {
      try {
        const { html } = await sendMessage('doc.preview', { kind: previewKind });
        setPreviewHtml(html);
      } catch {
        setPreviewHtml('');
      }
    },
    [previewKind],
  );

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview, settings.document, settings.ai]);

  const patchDocument = (patch: Record<string, unknown>) => patchSettings({ document: { ...document, ...patch } });

  const toggleSection = (section: SectionId) => {
    const hidden = document.hiddenSections.includes(section)
      ? document.hiddenSections.filter((entry) => entry !== section)
      : [...document.hiddenSections, section];
    void patchDocument({ hiddenSections: hidden });
  };

  const moveSection = (section: SectionId, direction: -1 | 1) => {
    const order = [...(document.sectionOrderOverride ?? selected.sectionOrder)];
    const index = order.indexOf(section);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    void patchDocument({ sectionOrderOverride: order });
  };

  const uploadFont = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    const dataUrl = `data:font/ttf;base64,${btoa(binary)}`;
    await patchDocument({ customFont: { name: file.name, dataUrl } });
    toast.success('Custom font applied to PDF output.');
  };

  const order = document.sectionOrderOverride ?? selected.sectionOrder;

  const ownFileEntries: { kind: 'resume' | 'cover_letter'; label: string; ref: RefObject<HTMLInputElement> }[] = [
    { kind: 'resume', label: 'Resume', ref: resumeInput },
    { kind: 'cover_letter', label: 'Cover letter', ref: coverInput },
  ];

  const renderTemplate = (template: ResumeTemplate) => (
    <TemplateCard
      key={template.id}
      template={template}
      selected={template.id === selected.id}
      accent={document.accentOverride ?? template.accent}
      onSelect={() => {
        void patchDocument({ templateId: template.id, accentOverride: null });
        toast.push(`${template.name} selected.`);
      }}
    />
  );

  const renderOwnFile = (entry: { kind: 'resume' | 'cover_letter'; label: string; ref: RefObject<HTMLInputElement> }) => (
    <OwnFileCard
      key={entry.kind}
      kind={entry.kind}
      label={entry.label}
      inputRef={entry.ref}
      existing={uploadedFor(entry.kind)}
      onUpload={(kind, file) => void uploadOwnFile(kind, file)}
      onRemove={(kind) => void removeOwnFile(kind)}
    />
  );

  const renderAccentPreset = (color: string) => (
    <button
      key={color}
      aria-label={color}
      onClick={() => void patchDocument({ accentOverride: color })}
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        border: (document.accentOverride ?? selected.accent) === color ? '2px solid var(--text)' : '1px solid var(--border)',
        background: color,
        cursor: 'pointer',
      }}
    />
  );

  const renderSection = (section: SectionId, index: number) => {
    const meta = ALL_SECTIONS.find((entry) => entry.id === section);
    if (!meta) return null;
    return (
      <SectionRow
        key={section}
        label={meta.label}
        index={index}
        total={order.length}
        hidden={document.hiddenSections.includes(section)}
        onMoveUp={() => moveSection(section, -1)}
        onMoveDown={() => moveSection(section, 1)}
        onToggle={() => toggleSection(section)}
      />
    );
  };

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Resume designs</h1>
          <p className="main__subtitle">
            Pick a layout, accent colour and section order. Changes apply to every document generated from now on - existing files keep their original design.
          </p>
        </div>
        <div className="row">
          <Button
            variant="outline"
            icon={<IconRefresh size={15} />}
            onClick={() => {
              void patchSettings({ document: DEFAULT_DOCUMENT_SETTINGS }).then(() => toast.push('Design reset to defaults.'));
            }}
          >
            Reset design
          </Button>
        </div>
      </header>

      <SectionCard title="Design catalogue" hint={`${RESUME_TEMPLATES.length} curated layouts. ATS-friendly single-column designs score highest.`}>
        <div className="template-grid">{RESUME_TEMPLATES.map(renderTemplate)}</div>
      </SectionCard>

      <SectionCard
        title="My own files"
        hint="Prefer applying with files you already have? Upload your own resume and cover letter, then switch JobPal to attach them instead of the generated documents."
      >
        <Toggle
          checked={document.fileSource === 'uploaded'}
          onChange={(useOwn) => void patchDocument({ fileSource: useOwn ? 'uploaded' : 'generated' })}
          label="Attach my own uploaded files instead of generated ones"
          hint={
            document.fileSource === 'uploaded'
              ? uploadedDocs.length > 0
                ? 'Autofill and the agent will attach your uploads.'
                : 'Upload at least one file below, otherwise generated documents are used.'
              : 'Generated documents are attached.'
          }
        />
        <div className="grid grid--2 mt-2">{ownFileEntries.map(renderOwnFile)}</div>
      </SectionCard>

      <div className="grid grid--2">
        <SectionCard title="Colour & typography">
          <Field label="Accent colour">
            <div className="row row--wrap">
              <input
                type="color"
                value={document.accentOverride ?? selected.accent}
                onChange={(event) => void patchDocument({ accentOverride: event.target.value })}
                style={{ width: 46, height: 34, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              {ACCENT_PRESETS.map(renderAccentPreset)}
              <Button size="sm" variant="ghost" onClick={() => void patchDocument({ accentOverride: null })}>
                Use template default
              </Button>
            </div>
          </Field>
          <div className="grid grid--2">
            <Field label="Page size">
              <Select value={document.pageSize} onChange={(event) => void patchDocument({ pageSize: event.target.value as 'a4' | 'letter' })}>
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="letter">US Letter (8.5 × 11 in)</option>
              </Select>
            </Field>
            <Field label="Density">
              <Select
                value={document.densityOverride ?? ''}
                onChange={(event) => void patchDocument({ densityOverride: event.target.value || null })}
              >
                <option value="">Template default ({selected.density})</option>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </Select>
            </Field>
          </div>
          <Field
            label="Headline (the subtitle under your name)"
            hint="Tailored rewrites it for each posting at your real level - it never copies the posting's seniority or claims skills you did not report. Your profile headline stays untouched. Choose “My profile headline” to always print your own wording verbatim."
          >
            <Select value={document.headlineMode} onChange={(event) => void patchDocument({ headlineMode: event.target.value })}>
              <option value="tailored">Tailor per job (recommended)</option>
              <option value="profile">Always use my profile headline</option>
            </Select>
          </Field>
          <Field
            label="Resume wording"
            hint="Left reworks your headline, summary and experience descriptions to match the job. Right keeps your own wording almost verbatim. Either way JobPal never adds experience, skills or seniority you did not report."
          >
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={document.faithfulness ?? 60}
                onChange={(event) => void patchDocument({ faithfulness: Number(event.target.value) })}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span className="tiny muted" style={{ minWidth: 66, textAlign: 'right' }}>
                {(document.faithfulness ?? 60) >= 70 ? 'Exact' : (document.faithfulness ?? 60) >= 40 ? 'Balanced' : 'Reworded'}
              </span>
            </div>
          </Field>
          <Field
            label="Missing job description"
            hint="By default documents cannot be generated without a job description. Leave this off and the overlay simply asks you to confirm each time you try; turn it on to allow generation without any prompt."
          >
            <Toggle
              checked={document.allowGenerateWithoutDescription}
              onChange={(allowGenerateWithoutDescription) => void patchDocument({ allowGenerateWithoutDescription })}
              label="Allow generating without a description"
            />
          </Field>
          <Field
            label="File name pattern"
            hint="Default: {{name}}-{{kind}} - job-agnostic file names. Add {{company}}, {{role}}, {{date}} or {{template}} only if you want them."
          >
            <Input value={document.fileNamePattern} onChange={(event) => void patchDocument({ fileNamePattern: event.target.value })} />
          </Field>
          <Field label="Output format" hint="One file per document. PDF is the default and the safest choice for applications; pick another only if the employer requires it.">
            <Select value={document.outputFormat} onChange={(event) => void patchDocument({ outputFormat: event.target.value })}>
              <option value="pdf">PDF - recommended, ATS-safe</option>
              <option value="docx">Word document (.docx)</option>
              <option value="html">Web page (.html)</option>
              <option value="md">Markdown (.md)</option>
              <option value="txt">Plain text (.txt)</option>
              <option value="json">JSON Resume (.json)</option>
            </Select>
          </Field>
          <Field label="Custom font (PDF)" hint="Upload a .ttf/.otf for full Unicode support (CJK, Cyrillic, Arabic).">
            <div className="row">
              <label className="btn btn--outline btn--sm">
                <IconUpload size={14} /> Upload font
                <input
                  type="file"
                  accept=".ttf,.otf"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadFont(file);
                    event.target.value = '';
                  }}
                />
              </label>
              <Show if={Boolean(document.customFont)}>
                <Badge tone="success">
                  <IconCheck size={11} /> {document.customFont?.name}
                </Badge>
                <Button size="sm" variant="ghost" icon={<IconTrash size={13} />} onClick={() => void patchDocument({ customFont: null })} />
              </Show>
            </div>
          </Field>
        </SectionCard>

        <SectionCard title="Sections" hint="Order and visibility of resume sections. Drag-free reordering with the arrows.">
          <div className="col">{order.map(renderSection)}</div>
          <div className="divider" />
          <Toggle
            checked={document.includePhoto}
            onChange={(includePhoto) => void patchDocument({ includePhoto })}
            label="Include a photo placeholder"
            hint="Only useful for regions where photos are expected (most ATS systems prefer without)."
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Live preview"
        hint="Rendered from your real profile data using the selected design."
        action={
          <div className="row">
            <Button size="sm" variant={previewKind === 'resume' ? 'primary' : 'outline'} onClick={() => setPreviewKind('resume')}>
              Resume
            </Button>
            <Button size="sm" variant={previewKind === 'cover_letter' ? 'primary' : 'outline'} onClick={() => setPreviewKind('cover_letter')}>
              Cover letter
            </Button>
            <Button size="sm" variant="ghost" icon={<IconRefresh size={14} />} onClick={() => void refreshPreview()} />
          </div>
        }
      >
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: '#fff' }}>
          <iframe title="Resume preview" srcDoc={previewHtml} style={{ width: '100%', height: 560, border: 'none' }} />
        </div>
      </SectionCard>
    </>
  );
}
