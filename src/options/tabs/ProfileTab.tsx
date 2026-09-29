import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppSettings, BaseResume, EducationItem, Profile, ProjectItem, SkillGroup, WorkExperience } from '@/types';
import { sendMessage, errorMessage } from '@/lib/messaging';
import { Badge, Button, EmptyState, Field, Input, SectionCard, Select, Show, Textarea, Toggle } from '@/ui/components';
import { IconCheck, IconPlus, IconRefresh, IconTrash, IconUpload } from '@/ui/components/Icons';
import { useProfiles } from '@/ui/hooks';
import { useToast } from '@/ui/components/Toast';
import { aiStatusFor } from '@/lib/ai/status';
import { extractTextFromFile } from '../resume-import';
import { EducationCard } from './profile/components/EducationCard';
import { ExperienceCard } from './profile/components/ExperienceCard';
import { ResumeRow } from './profile/components/ResumeRow';
import { SkillGroupCard } from './profile/components/SkillGroupCard';
import { mergeParsedIntoProfile } from './profile/helpers/mergeParsedIntoProfile';
import { uid } from '@/lib/utils';

type PatchSettings = (patch: Record<string, unknown>) => Promise<AppSettings>;

export function ProfileTab({ settings, patchSettings }: { settings: AppSettings; patchSettings: PatchSettings }) {
  const { profiles, save, remove, reload } = useProfiles();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [resumes, setResumes] = useState<BaseResume[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedId && profiles.length > 0) {
      const preferred = profiles.find((profile) => profile.isDefault) ?? profiles[0];
      setSelectedId(preferred.id);
      setDraft(structuredClone(preferred));
    }
  }, [profiles, selectedId]);

  useEffect(() => {
    void sendMessage('resume.list', undefined).then(setResumes).catch(() => setResumes([]));
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = await chrome.storage.local.get(['jobpal.pendingProfile']);
      const pending = stored['jobpal.pendingProfile'] as { profile?: Partial<Profile>; at?: number } | undefined;
      if (pending?.profile && Date.now() - (pending.at ?? 0) < 1000 * 60 * 30) {
        toast.push('LinkedIn profile captured - press “Apply LinkedIn data” to merge it into your profile.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(() => draft && JSON.stringify(draft) !== JSON.stringify(profiles.find((profile) => profile.id === draft.id)), [draft, profiles]);
  const ai = aiStatusFor(settings);

  const update = (patch: Partial<Profile>) => setDraft((current) => (current ? { ...current, ...patch } : current));
  const updateContact = (patch: Partial<Profile['contact']>) => update({ contact: { ...draft!.contact, ...patch } });
  const updatePresence = (patch: Partial<Profile['presence']>) => update({ presence: { ...draft!.presence, ...patch } });
  const updateEligibility = (patch: Partial<Profile['eligibility']>) => update({ eligibility: { ...draft!.eligibility, ...patch } });
  const updateEeo = (patch: Partial<Profile['eeo']>) => update({ eeo: { ...draft!.eeo, ...patch } });

  const selectVariant = (id: string) => {
    const found = profiles.find((profile) => profile.id === id);
    if (!found) return;
    setSelectedId(id);
    setDraft(structuredClone(found));
  };

  const addVariant = () => {
    const base = draft ? structuredClone(draft) : profiles[0];
    const variant: Profile = { ...base, id: uid('profile'), variantName: `Variant ${profiles.length + 1}`, isDefault: false, updatedAt: Date.now() };
    void save(variant).then(() => {
      setSelectedId(variant.id);
      setDraft(variant);
      toast.success('Variant created. Adjust it for this style of role.');
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    setBusy('save');
    try {
      await save({ ...draft, updatedAt: Date.now() });
      toast.success('Profile saved.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!draft) return;
    if (!confirm(`Delete the profile variant “${draft.variantName}”?`)) return;
    await remove(draft.id);
    setSelectedId(null);
    setDraft(null);
    toast.push('Variant deleted.');
  };

  const importFromText = async (text: string, source: BaseResume['source'], fileName?: string) => {
    const resume: BaseResume = { id: uid('resume'), name: fileName ?? `${source} import`, source, fileName, rawText: text, createdAt: Date.now() };
    await sendMessage('resume.save', { resume });
    setResumes(await sendMessage('resume.list', undefined));
    toast.success('Resume captured. Press “Parse” to structure it with AI.');
  };

  const handleFile = async (file: File) => {
    setBusy('file');
    try {
      const text = await extractTextFromFile(file);
      if (!text.trim()) throw new Error('No text could be extracted from this file.');
      await importFromText(text, 'upload', file.name);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const parseResume = async (resume: BaseResume) => {
    setBusy(`parse:${resume.id}`);
    try {
      const result = await sendMessage('resume.parse', { resumeId: resume.id, profileId: draft?.id });
      if (!draft) return;
      const merged = mergeParsedIntoProfile(draft, result.profile);
      setDraft(merged);
      setResumes(await sendMessage('resume.list', undefined));
      toast.success(`Parsed with ${result.usedAI ? 'AI' : 'the local parser'}. Review the fields, then press Save.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const applyLinkedIn = async () => {
    const stored = await chrome.storage.local.get(['jobpal.pendingProfile']);
    const pending = stored['jobpal.pendingProfile'] as { profile?: Partial<Profile> } | undefined;
    if (!pending?.profile || !draft) return;
    setDraft(mergeParsedIntoProfile(draft, pending.profile));
    await chrome.storage.local.remove('jobpal.pendingProfile');
    toast.success('LinkedIn data merged. Review, then press Save.');
  };

  const pasteResume = async () => {
    const text = prompt('Paste your resume text (or use the file upload):');
    if (!text || text.length < 80) return;
    await importFromText(text, 'paste');
  };

  const deleteResume = (resume: BaseResume) => {
    void sendMessage('resume.delete', { id: resume.id }).then(async () => setResumes(await sendMessage('resume.list', undefined)));
  };

  if (!draft) {
    return (
      <>
        <header className="main__header">
          <div>
            <h1 className="main__title">My profile</h1>
            <p className="main__subtitle">Loading your profile…</p>
          </div>
        </header>
        <EmptyState title="No profile found" text="Create a profile to get started." action={<Button onClick={() => void reload()}>Reload</Button>} />
      </>
    );
  }

  const toggleExperience = (id: string, patch: Partial<WorkExperience>) =>
    update({ experience: draft.experience.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const toggleEducation = (id: string, patch: Partial<EducationItem>) =>
    update({ education: draft.education.map((item) => (item.id === id ? { ...item, ...patch } : item)) });

  const renderVariantButton = (profile: Profile) => (
    <Button key={profile.id} size="sm" variant={profile.id === draft.id ? 'primary' : 'outline'} onClick={() => selectVariant(profile.id)}>
      {profile.variantName}
      <Show if={profile.isDefault}> ★</Show>
    </Button>
  );

  const renderResume = (resume: BaseResume) => (
    <ResumeRow key={resume.id} resume={resume} busy={busy} aiReady={ai.ready} onParse={(entry) => void parseResume(entry)} onDelete={deleteResume} />
  );

  const renderExperience = (item: WorkExperience, index: number) => (
    <ExperienceCard
      key={item.id}
      item={item}
      index={index}
      onChange={(patch) => toggleExperience(item.id, patch)}
      onRemove={() => update({ experience: draft.experience.filter((entry) => entry.id !== item.id) })}
    />
  );

  const renderEducation = (item: EducationItem) => (
    <EducationCard
      key={item.id}
      item={item}
      onChange={(patch) => toggleEducation(item.id, patch)}
      onRemove={() => update({ education: draft.education.filter((entry) => entry.id !== item.id) })}
    />
  );

  const renderSkillGroup = (group: SkillGroup, index: number) => (
    <SkillGroupCard
      key={index}
      group={group}
      onChange={(patch) => update({ skills: draft.skills.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)) })}
      onRemove={() => update({ skills: draft.skills.filter((_, entryIndex) => entryIndex !== index) })}
    />
  );

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">My profile</h1>
          <p className="main__subtitle">
            This is the single source of truth for every document. Keep variants for different role types - JobPal picks the default variant, and you can
            switch per application.
          </p>
        </div>
        <div className="row">
          <Show if={Boolean(dirty)}>
            <Badge tone="warning">Unsaved changes</Badge>
          </Show>
          <Button icon={<IconCheck size={15} />} variant="primary" loading={busy === 'save'} onClick={() => void handleSave()}>
            Save profile
          </Button>
        </div>
      </header>

      <SectionCard
        title="Profile variants"
        hint="Variants let you keep different summaries, emphasis and contact preferences for different role types."
        action={
          <div className="row">
            <Button size="sm" variant="outline" onClick={() => void reload()}>
              Reload
            </Button>
            <Button size="sm" icon={<IconPlus size={14} />} onClick={addVariant}>
              Duplicate as variant
            </Button>
          </div>
        }
      >
        <div className="row row--wrap">
          {profiles.map(renderVariantButton)}
          <div className="grow" />
          <Button size="sm" variant="ghost" disabled={draft.isDefault} onClick={() => void save({ ...draft, isDefault: true }).then(() => toast.success('Default variant updated.'))}>
            Make default
          </Button>
          <Button size="sm" variant="danger" icon={<IconTrash size={14} />} onClick={() => void handleDelete()}>
            Delete variant
          </Button>
        </div>
        <div className="mt-2" style={{ maxWidth: 360 }}>
          <Field label="Variant name">
            <Input value={draft.variantName} onChange={(event) => update({ variantName: event.target.value })} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Resume sources" hint="Upload a PDF/DOCX/JSON Resume, paste text, or scan your LinkedIn profile. JobPal parses it into structured data.">
        <Show if={!ai.ready}>
          <div className="card card--flat mb-2" style={{ borderColor: 'var(--warning)' }}>
            <div className="row row--between">
              <div>
                <div className="strong">Parsing needs an AI connection</div>
                <div className="tiny muted">
                  {ai.reason ?? 'Connect a provider'} - uploading and pasting still works, but extraction into structured fields stays disabled until then.
                </div>
              </div>
              <Button size="sm" variant="primary" onClick={() => void sendMessage('app.openOptions', { tab: 'ai' })}>
                Connect AI
              </Button>
            </div>
          </div>
        </Show>
        <div className="row row--wrap mb-2">
          <Button icon={<IconUpload size={15} />} loading={busy === 'file'} onClick={() => fileInput.current?.click()}>
            Upload resume
          </Button>
          <Button variant="outline" onClick={() => void pasteResume()}>
            Paste text
          </Button>
          <Button variant="outline" icon={<IconRefresh size={15} />} onClick={() => void applyLinkedIn()}>
            Apply LinkedIn data
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt,.md,.json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = '';
            }}
          />
        </div>
        <Show if={resumes.length === 0}>
          <EmptyState title="No resume sources yet" text="Upload your current resume so JobPal can import your history in one click." />
        </Show>
        <Show if={resumes.length > 0}>
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Captured</th>
                <th>Parsed</th>
                <th />
              </tr>
            </thead>
            <tbody>{resumes.map(renderResume)}</tbody>
          </table>
        </Show>
      </SectionCard>

      <SectionCard title="Basics">
        <div className="grid grid--3">
          <Field label="First name">
            <Input value={draft.contact.firstName} onChange={(event) => updateContact({ firstName: event.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={draft.contact.lastName} onChange={(event) => updateContact({ lastName: event.target.value })} />
          </Field>
          <Field label="Middle name">
            <Input value={draft.contact.middleName ?? ''} onChange={(event) => updateContact({ middleName: event.target.value })} />
          </Field>
          <Field label="Headline">
            <Input value={draft.contact.headline ?? ''} placeholder="Senior Backend Engineer" onChange={(event) => updateContact({ headline: event.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={draft.contact.email} onChange={(event) => updateContact({ email: event.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={draft.contact.phone} onChange={(event) => updateContact({ phone: event.target.value })} />
          </Field>
          <Field label="Address">
            <Input value={draft.contact.address ?? ''} onChange={(event) => updateContact({ address: event.target.value })} />
          </Field>
          <Field label="City">
            <Input value={draft.contact.city ?? ''} onChange={(event) => updateContact({ city: event.target.value })} />
          </Field>
          <Field label="State / region">
            <Input value={draft.contact.state ?? ''} onChange={(event) => updateContact({ state: event.target.value })} />
          </Field>
          <Field label="Postal code">
            <Input value={draft.contact.postalCode ?? ''} onChange={(event) => updateContact({ postalCode: event.target.value })} />
          </Field>
          <Field label="Country">
            <Input value={draft.contact.country ?? ''} onChange={(event) => updateContact({ country: event.target.value })} />
          </Field>
          <Field label="Date of birth" hint="Optional - used only for forms that require it.">
            <Input value={draft.contact.dateOfBirth ?? ''} onChange={(event) => updateContact({ dateOfBirth: event.target.value })} />
          </Field>
        </div>
        <div className="grid grid--3">
          <Field label="LinkedIn">
            <Input value={draft.presence.linkedin ?? ''} onChange={(event) => updatePresence({ linkedin: event.target.value })} />
          </Field>
          <Field label="GitHub">
            <Input value={draft.presence.github ?? ''} onChange={(event) => updatePresence({ github: event.target.value })} />
          </Field>
          <Field label="Portfolio">
            <Input value={draft.presence.portfolio ?? ''} onChange={(event) => updatePresence({ portfolio: event.target.value })} />
          </Field>
          <Field label="Website">
            <Input value={draft.presence.website ?? ''} onChange={(event) => updatePresence({ website: event.target.value })} />
          </Field>
          <Field label="Twitter / X">
            <Input value={draft.presence.twitter ?? ''} onChange={(event) => updatePresence({ twitter: event.target.value })} />
          </Field>
        </div>
        <Field label="Professional summary" hint="The AI rewrites this per application, but the tone and facts come from here.">
          <Textarea value={draft.summary} rows={4} onChange={(event) => update({ summary: event.target.value })} />
        </Field>
      </SectionCard>

      <SectionCard
        title="Work experience"
        hint="Bullets are the raw material for tailoring. Quantity beats prose: numbers, scope, outcomes."
        action={
          <Button
            size="sm"
            icon={<IconPlus size={14} />}
            onClick={() =>
              update({
                experience: [
                  {
                    id: uid('exp'),
                    company: '',
                    title: '',
                    start: '',
                    current: true,
                    description: '',
                    highlights: [],
                    skills: [],
                  },
                  ...draft.experience,
                ],
              })
            }
          >
            Add role
          </Button>
        }
      >
        <Show if={draft.experience.length === 0}>
          <EmptyState title="No roles yet" text="Add your most recent role first - JobPal lists experience in the order you set." />
        </Show>
        <div className="col">{draft.experience.map(renderExperience)}</div>
      </SectionCard>

      <SectionCard
        title="Education"
        action={
          <Button
            size="sm"
            icon={<IconPlus size={14} />}
            onClick={() => update({ education: [{ id: uid('edu'), school: '', degree: '', field: '', highlights: [] }, ...draft.education] })}
          >
            Add education
          </Button>
        }
      >
        <div className="col">{draft.education.map(renderEducation)}</div>
      </SectionCard>

      <SectionCard
        title="Skills"
        hint="Grouped skills render as categories on your resume and are used for match scoring."
        action={
          <Button size="sm" icon={<IconPlus size={14} />} onClick={() => update({ skills: [...draft.skills, { category: 'New category', items: [] }] })}>
            Add group
          </Button>
        }
      >
        <div className="col">{draft.skills.map(renderSkillGroup)}</div>
      </SectionCard>

      <div className="grid grid--2">
        <SectionCard title="Certifications & languages">
          <Field label="Certifications" hint="One per line: Name - Issuer - YYYY-MM">
            <Textarea
              rows={4}
              value={draft.certifications.map((cert) => [cert.name, cert.issuer, cert.date].filter(Boolean).join(' - ')).join('\n')}
              onChange={(event) =>
                update({
                  certifications: event.target.value
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                      const [name = '', issuer = '', date = ''] = line.split('-').map((part) => part.trim());
                      return { id: uid('cert'), name, issuer, date };
                    }),
                })
              }
            />
          </Field>
          <Field label="Languages" hint="One per line: Language - level (native, fluent, professional, intermediate, basic)">
            <Textarea
              rows={3}
              value={draft.languages.map((language) => `${language.language} - ${language.level}`).join('\n')}
              onChange={(event) =>
                update({
                  languages: event.target.value
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                      const [language = '', level = 'professional'] = line.split('-').map((part) => part.trim().toLowerCase());
                      const allowed = ['native', 'fluent', 'professional', 'intermediate', 'basic'] as const;
                      return { language, level: (allowed.includes(level as never) ? level : 'professional') as Profile['languages'][number]['level'] };
                    }),
                })
              }
            />
          </Field>
        </SectionCard>

        <SectionCard title="Projects & awards">
          <Field label="Projects" hint="One per line: Name - description - url">
            <Textarea
              rows={4}
              value={draft.projects.map((project: ProjectItem) => [project.name, project.description, project.url].filter(Boolean).join(' - ')).join('\n')}
              onChange={(event) =>
                update({
                  projects: event.target.value
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                      const [name = '', description = '', url = ''] = line.split('-').map((part) => part.trim());
                      return { id: uid('proj'), name, description, url, highlights: [], skills: [] };
                    }),
                })
              }
            />
          </Field>
          <Field label="Awards" hint="One per line: Title - issuer - YYYY">
            <Textarea
              rows={3}
              value={draft.awards.map((award) => [award.title, award.issuer, award.date].filter(Boolean).join(' - ')).join('\n')}
              onChange={(event) =>
                update({
                  awards: event.target.value
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                      const [title = '', issuer = '', date = ''] = line.split('-').map((part) => part.trim());
                      return { id: uid('award'), title, issuer, date };
                    }),
                })
              }
            />
          </Field>
        </SectionCard>
      </div>

      <SectionCard title="Eligibility & preferences" hint="Used to answer screening questions truthfully and to auto-fill forms.">
        <div className="grid grid--3">
          <Field label="Work authorisation">
            <Select value={draft.eligibility.workAuthorization} onChange={(event) => updateEligibility({ workAuthorization: event.target.value })}>
              <option value="">Select…</option>
              <option value="Authorised to work without restriction">Authorised without restriction</option>
              <option value="Require visa sponsorship">Require sponsorship</option>
              <option value="Student visa / limited hours">Student visa / limited hours</option>
              <option value="Permanent resident">Permanent resident</option>
              <option value="Citizen">Citizen</option>
            </Select>
          </Field>
          <Field label="Requires sponsorship">
            <Select
              value={draft.eligibility.requiresSponsorship === null ? '' : String(draft.eligibility.requiresSponsorship)}
              onChange={(event) => updateEligibility({ requiresSponsorship: event.target.value === '' ? null : event.target.value === 'true' })}
            >
              <option value="">Prefer not to say</option>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </Select>
          </Field>
          <Field label="Willing to relocate">
            <Select
              value={draft.eligibility.willingToRelocate === null ? '' : String(draft.eligibility.willingToRelocate)}
              onChange={(event) => updateEligibility({ willingToRelocate: event.target.value === '' ? null : event.target.value === 'true' })}
            >
              <option value="">Prefer not to say</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </Field>
          <Field label="Notice period">
            <Input value={draft.eligibility.noticePeriod ?? ''} placeholder="4 weeks" onChange={(event) => updateEligibility({ noticePeriod: event.target.value })} />
          </Field>
          <Field label="Desired salary">
            <Input value={draft.eligibility.desiredSalary ?? ''} placeholder="90000" onChange={(event) => updateEligibility({ desiredSalary: event.target.value })} />
          </Field>
          <Field label="Currency">
            <Input value={draft.eligibility.desiredSalaryCurrency ?? ''} placeholder="USD" onChange={(event) => updateEligibility({ desiredSalaryCurrency: event.target.value })} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Voluntary EEO answers" hint="Off by default. If enabled and you allow sensitive-field filling, these are used on voluntary self-identification forms only.">
        <Toggle checked={draft.eeo.enabled} onChange={(enabled) => updateEeo({ enabled })} label="Allow JobPal to fill EEO questions" />
        <Show if={draft.eeo.enabled}>
          <div className="grid grid--2 mt-2">
            <Field label="Gender">
              <Select value={draft.eeo.gender ?? ''} onChange={(event) => updateEeo({ gender: event.target.value })}>
                <option value="">Prefer not to say</option>
                <option>Woman</option>
                <option>Man</option>
                <option>Non-binary</option>
                <option>Decline to self-identify</option>
              </Select>
            </Field>
            <Field label="Race / ethnicity">
              <Select value={draft.eeo.race ?? ''} onChange={(event) => updateEeo({ race: event.target.value })}>
                <option value="">Prefer not to say</option>
                <option>Asian</option>
                <option>Black or African American</option>
                <option>Hispanic or Latino</option>
                <option>White</option>
                <option>Native American or Alaska Native</option>
                <option>Native Hawaiian or Pacific Islander</option>
                <option>Two or more races</option>
                <option>Decline to self-identify</option>
              </Select>
            </Field>
            <Field label="Veteran status">
              <Select value={draft.eeo.veteranStatus ?? ''} onChange={(event) => updateEeo({ veteranStatus: event.target.value })}>
                <option value="">Prefer not to say</option>
                <option>I am not a protected veteran</option>
                <option>I am a protected veteran</option>
                <option>Decline to self-identify</option>
              </Select>
            </Field>
            <Field label="Disability status">
              <Select value={draft.eeo.disabilityStatus ?? ''} onChange={(event) => updateEeo({ disabilityStatus: event.target.value })}>
                <option value="">Prefer not to say</option>
                <option>Yes, I have a disability</option>
                <option>No, I do not have a disability</option>
                <option>Decline to self-identify</option>
              </Select>
            </Field>
          </div>
        </Show>
        <div className="divider" />
        <Toggle
          checked={settings.autofill.fillSensitive}
          onChange={(fillSensitive) => void patchSettings({ autofill: { fillSensitive } })}
          label="Allow autofill of sensitive fields"
          hint="Required before EEO answers are ever filled in."
        />
      </SectionCard>
    </>
  );
}
