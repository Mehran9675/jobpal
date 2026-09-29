import type { Profile } from '@/types';
import { withListEntry } from '../helpers/editorContent';
import { ListField } from './ListField';
import { Show } from '@/ui/components';

const LEVELS = ['native', 'fluent', 'professional', 'intermediate', 'basic'];

export function ResumeEditor({ profile, onChange }: { profile: Profile; onChange: (profile: Profile) => void }) {
  const renderInput = (label: string, value: string | undefined, onValue: (value: string) => void, placeholder?: string) => (
    <label className="jp-field">
      <span className="jp-field-label">{label}</span>
      <input className="jp-input" value={value ?? ''} placeholder={placeholder} onChange={(event) => onValue(event.target.value)} />
    </label>
  );

  const renderTextArea = (label: string, value: string, onValue: (value: string) => void, rows = 3) => (
    <label className="jp-field">
      <span className="jp-field-label">{label}</span>
      <textarea className="jp-textarea" rows={rows} value={value} onChange={(event) => onValue(event.target.value)} />
    </label>
  );

  const renderHeading = (title: string) => <div className="jp-edit-heading">{title}</div>;

  const renderLevelOption = (level: string) => (
    <option key={level} value={level}>
      {level}
    </option>
  );

  const renderSkillGroup = (group: Profile['skills'][number], index: number) => (
    <div className="jp-edit-grid" key={`skill-${index}`}>
      {renderInput('Category', group.category, (value) => onChange({ ...profile, skills: withListEntry(profile.skills, index, { category: value }) }))}
      <ListField
        label="Skills"
        items={group.items}
        placeholder="React, TypeScript, Node.js"
        onChange={(items) => onChange({ ...profile, skills: withListEntry(profile.skills, index, { items }) })}
      />
    </div>
  );

  const renderExperience = (entry: Profile['experience'][number], index: number) => (
    <div className="jp-edit-entry" key={entry.id || `experience-${index}`}>
      <div className="jp-edit-grid">
        {renderInput('Job title', entry.title, (value) => onChange({ ...profile, experience: withListEntry(profile.experience, index, { title: value }) }))}
        {renderInput('Company', entry.company, (value) => onChange({ ...profile, experience: withListEntry(profile.experience, index, { company: value }) }))}
        {renderInput('Location', entry.location, (value) => onChange({ ...profile, experience: withListEntry(profile.experience, index, { location: value }) }))}
        {renderInput('Start (YYYY-MM)', entry.start, (value) => onChange({ ...profile, experience: withListEntry(profile.experience, index, { start: value }) }))}
        {renderInput('End (YYYY-MM)', entry.end ?? '', (value) => onChange({ ...profile, experience: withListEntry(profile.experience, index, { end: value }) }))}
      </div>
      <label className="jp-edit-check">
        <input
          type="checkbox"
          checked={entry.current}
          onChange={(event) => onChange({ ...profile, experience: withListEntry(profile.experience, index, { current: event.target.checked }) })}
        />
        <span>Current role</span>
      </label>
      {renderTextArea('Context sentence', entry.description, (value) => onChange({ ...profile, experience: withListEntry(profile.experience, index, { description: value }) }), 2)}
      <ListField
        label="Highlights (one per line)"
        items={entry.highlights}
        separator={'\n'}
        placeholder="Scaled the pipeline to 4B events/day"
        onChange={(highlights) => onChange({ ...profile, experience: withListEntry(profile.experience, index, { highlights }) })}
      />
    </div>
  );

  const renderEducation = (entry: Profile['education'][number], index: number) => (
    <div className="jp-edit-entry" key={entry.id || `education-${index}`}>
      <div className="jp-edit-grid">
        {renderInput('School', entry.school, (value) => onChange({ ...profile, education: withListEntry(profile.education, index, { school: value }) }))}
        {renderInput('Degree', entry.degree, (value) => onChange({ ...profile, education: withListEntry(profile.education, index, { degree: value }) }))}
        {renderInput('Field', entry.field, (value) => onChange({ ...profile, education: withListEntry(profile.education, index, { field: value }) }))}
        {renderInput('Location', entry.location, (value) => onChange({ ...profile, education: withListEntry(profile.education, index, { location: value }) }))}
        {renderInput('Start', entry.start ?? '', (value) => onChange({ ...profile, education: withListEntry(profile.education, index, { start: value }) }))}
        {renderInput('End', entry.end ?? '', (value) => onChange({ ...profile, education: withListEntry(profile.education, index, { end: value }) }))}
      </div>
    </div>
  );

  const renderCertification = (entry: Profile['certifications'][number], index: number) => (
    <div className="jp-edit-grid" key={entry.id || `certification-${index}`}>
      {renderInput('Name', entry.name, (value) => onChange({ ...profile, certifications: withListEntry(profile.certifications, index, { name: value }) }))}
      {renderInput('Issuer', entry.issuer, (value) => onChange({ ...profile, certifications: withListEntry(profile.certifications, index, { issuer: value }) }))}
      {renderInput('Date', entry.date ?? '', (value) => onChange({ ...profile, certifications: withListEntry(profile.certifications, index, { date: value }) }))}
    </div>
  );

  const renderLanguage = (entry: Profile['languages'][number], index: number) => (
    <div className="jp-edit-grid" key={`language-${index}`}>
      {renderInput('Language', entry.language, (value) => onChange({ ...profile, languages: withListEntry(profile.languages, index, { language: value }) }))}
      <label className="jp-field">
        <span className="jp-field-label">Level</span>
        <select
          className="jp-input"
          value={entry.level}
          onChange={(event) => onChange({ ...profile, languages: withListEntry(profile.languages, index, { level: event.target.value as Profile['languages'][number]['level'] }) })}
        >
          {LEVELS.map(renderLevelOption)}
        </select>
      </label>
    </div>
  );

  const renderProject = (entry: Profile['projects'][number], index: number) => (
    <div className="jp-edit-entry" key={entry.id || `project-${index}`}>
      <div className="jp-edit-grid">
        {renderInput('Name', entry.name, (value) => onChange({ ...profile, projects: withListEntry(profile.projects, index, { name: value }) }))}
        {renderInput('URL', entry.url ?? '', (value) => onChange({ ...profile, projects: withListEntry(profile.projects, index, { url: value }) }))}
      </div>
      {renderTextArea('Description', entry.description, (value) => onChange({ ...profile, projects: withListEntry(profile.projects, index, { description: value }) }), 2)}
    </div>
  );

  const renderAward = (entry: Profile['awards'][number], index: number) => (
    <div className="jp-edit-grid" key={entry.id || `award-${index}`}>
      {renderInput('Title', entry.title, (value) => onChange({ ...profile, awards: withListEntry(profile.awards, index, { title: value }) }))}
      {renderInput('Issuer', entry.issuer ?? '', (value) => onChange({ ...profile, awards: withListEntry(profile.awards, index, { issuer: value }) }))}
      {renderInput('Date', entry.date ?? '', (value) => onChange({ ...profile, awards: withListEntry(profile.awards, index, { date: value }) }))}
    </div>
  );

  return (
    <div className="jp-edit-stack">
      <div className="jp-edit-section">
        {renderHeading('Headline and summary')}
        {renderInput('Headline', profile.contact.headline ?? '', (value) => onChange({ ...profile, contact: { ...profile.contact, headline: value } }))}
        {renderTextArea('Summary', profile.summary, (value) => onChange({ ...profile, summary: value }), 4)}
      </div>

      <Show if={profile.skills.length > 0}>
        <div className="jp-edit-section">
          {renderHeading('Skills')}
          {profile.skills.map(renderSkillGroup)}
        </div>
      </Show>

      <Show if={profile.experience.length > 0}>
        <div className="jp-edit-section">
          {renderHeading('Work experience')}
          {profile.experience.map(renderExperience)}
        </div>
      </Show>

      <Show if={profile.education.length > 0}>
        <div className="jp-edit-section">
          {renderHeading('Education')}
          {profile.education.map(renderEducation)}
        </div>
      </Show>

      <Show if={profile.certifications.length > 0}>
        <div className="jp-edit-section">
          {renderHeading('Certifications')}
          {profile.certifications.map(renderCertification)}
        </div>
      </Show>

      <Show if={profile.languages.length > 0}>
        <div className="jp-edit-section">
          {renderHeading('Languages')}
          {profile.languages.map(renderLanguage)}
        </div>
      </Show>

      <Show if={profile.projects.length > 0}>
        <div className="jp-edit-section">
          {renderHeading('Projects')}
          {profile.projects.map(renderProject)}
        </div>
      </Show>

      <Show if={profile.awards.length > 0}>
        <div className="jp-edit-section">
          {renderHeading('Awards')}
          {profile.awards.map(renderAward)}
        </div>
      </Show>
    </div>
  );
}
