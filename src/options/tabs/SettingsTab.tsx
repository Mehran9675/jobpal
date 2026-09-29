import { useRef, useState } from 'react';
import type { AppSettings } from '@/types';
import { sendMessage, errorMessage } from '@/lib/messaging';
import { ACCENT_PRESETS } from '@/lib/doc/templates';
import { Badge, Button, Field, SectionCard, Select, Toggle } from '@/ui/components';
import { IconDownload, IconExternal, IconShield, IconTrash, IconUpload } from '@/ui/components/Icons';
import { useToast } from '@/ui/components/Toast';

export function SettingsTab({ settings, patchSettings }: { settings: AppSettings; patchSettings: (patch: Record<string, unknown>) => Promise<AppSettings> }) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const patchUi = (patch: Partial<AppSettings['ui']>) => patchSettings({ ui: { ...settings.ui, ...patch } });

  const exportAll = async () => {
    setBusy('export');
    try {
      const applicationsExport = await sendMessage('applications.export', undefined);
      const blob = new Blob([applicationsExport.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `jobpaal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success('Backup downloaded. API keys are excluded for safety.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const importAll = async (file: File) => {
    setBusy('import');
    try {
      const text = await file.text();
      const result = await sendMessage('app.import', { json: text }, { timeout: 120000 });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const clearData = async (scope: 'documents' | 'applications' | 'all') => {
    const label = scope === 'all' ? 'all applications, jobs and documents' : scope;
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setBusy(`clear:${scope}`);
    try {
      const result = await sendMessage('app.clearData', { scope });
      toast.success(`Cleared: ${result.cleared.join(', ')}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const renderAccentPreset = (color: string) => (
    <button
      key={color}
      aria-label={color}
      onClick={() => void patchUi({ accent: color })}
      style={{
        width: 24,
        height: 24,
        borderRadius: 7,
        border: settings.ui.accent === color ? '2px solid var(--text)' : '1px solid var(--border)',
        background: color,
        cursor: 'pointer',
      }}
    />
  );

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Settings</h1>
          <p className="main__subtitle">Appearance, data portability and privacy controls. Everything lives locally in your browser.</p>
        </div>
      </header>

      <div className="grid grid--2">
        <SectionCard title="Appearance">
          <Field label="Theme">
            <Select value={settings.ui.theme} onChange={(event) => void patchUi({ theme: event.target.value as AppSettings['ui']['theme'] })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">Match system</option>
            </Select>
          </Field>
          <Field label="Accent colour">
            <div className="row row--wrap">
              <input
                type="color"
                value={settings.ui.accent}
                onChange={(event) => void patchUi({ accent: event.target.value })}
                style={{ width: 46, height: 34, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              {ACCENT_PRESETS.slice(0, 8).map(renderAccentPreset)}
            </div>
          </Field>
          <Toggle checked={settings.ui.compactDensity} onChange={(compactDensity) => void patchUi({ compactDensity })} label="Compact interface" />
          <div className="mt-2">
            <Toggle
              checked={settings.ui.autoOpenSidePanel}
              onChange={(autoOpenSidePanel) => void patchUi({ autoOpenSidePanel })}
              label="Show a hint on job pages"
              hint="Displays a ready status in the page overlay when a job posting is detected."
            />
          </div>
        </SectionCard>

        <SectionCard title="Autofill" hint="Controls how JobPaal fills application forms.">
          <Toggle checked={settings.autofill.enabled} onChange={(enabled) => void patchSettings({ autofill: { ...settings.autofill, enabled } })} label="Autofill enabled" />
          <div className="mt-2">
            <Toggle
              checked={settings.autofill.overwriteExisting}
              onChange={(overwriteExisting) => void patchSettings({ autofill: { ...settings.autofill, overwriteExisting } })}
              label="Overwrite fields that already have content"
            />
          </div>
          <div className="mt-2">
            <Toggle
              checked={settings.autofill.highlightFilled}
              onChange={(highlightFilled) => void patchSettings({ autofill: { ...settings.autofill, highlightFilled } })}
              label="Highlight fields after filling them"
            />
          </div>
          <div className="mt-2">
            <Toggle
              checked={settings.autofill.fillSensitive}
              onChange={(fillSensitive) => void patchSettings({ autofill: { ...settings.autofill, fillSensitive } })}
              label="Fill sensitive fields (EEO, date of birth)"
              hint="Requires enabling EEO answers in your profile."
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Data & backup" hint="Export your profile, settings and application history as JSON. Generated documents stay in the browser.">
        <div className="row row--wrap">
          <Button variant="primary" icon={<IconDownload size={15} />} loading={busy === 'export'} onClick={() => void exportAll()}>
            Export backup
          </Button>
          <Button variant="outline" icon={<IconUpload size={15} />} loading={busy === 'import'} onClick={() => fileInput.current?.click()}>
            Import backup
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importAll(file);
              event.target.value = '';
            }}
          />
        </div>
      </SectionCard>

      <SectionCard title="Danger zone" hint="Deleting data cannot be undone. Your profile and settings are kept.">
        <div className="row row--wrap">
          <Button variant="danger" loading={busy === 'clear:documents'} onClick={() => void clearData('documents')}>
            Delete all documents
          </Button>
          <Button variant="danger" loading={busy === 'clear:applications'} onClick={() => void clearData('applications')}>
            Delete applications
          </Button>
          <Button variant="danger" loading={busy === 'clear:all'} onClick={() => void clearData('all')}>
            Delete everything
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Privacy" hint="What leaves your browser, and when.">
        <div className="list">
          <div className="list-item">
            <IconShield size={16} />
            <div className="list-item__main">
              <div className="list-item__title">No JobPaal servers</div>
              <div className="list-item__meta">There is no backend. Prompts go directly from your browser to the AI provider you configured.</div>
            </div>
          </div>
          <div className="list-item">
            <IconShield size={16} />
            <div className="list-item__main">
              <div className="list-item__title">Resumes and profile stay local</div>
              <div className="list-item__meta">Stored in chrome.storage and IndexedDB. Exported only when you click export.</div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="About">
        <div className="grid grid--2">
          <Field label="Version">
            <div className="strong">v{chrome.runtime.getManifest().version}</div>
          </Field>
          <Field label="Engine">
            <div className="strong">{settings.ai.activeProviderId ? `${settings.ai.activeProviderId}${settings.ai.connections[settings.ai.activeProviderId]?.model ? ` · ${settings.ai.connections[settings.ai.activeProviderId]?.model}` : ''}` : 'No AI connected - AI features disabled'}</div>
          </Field>
        </div>
        <div className="row">
          <Button variant="outline" icon={<IconExternal size={15} />} onClick={() => void chrome.tabs.create({ url: 'https://jsonresume.org/schema' })}>
            JSON Resume schema
          </Button>
          <Button variant="ghost" icon={<IconTrash size={15} />} onClick={() => void chrome.runtime.reload()}>
            Reload extension
          </Button>
        </div>
      </SectionCard>
    </>
  );
}
