import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(tmpdir(), 'jobpaal-smoke');

const entry = `
import { renderFiles } from './src/lib/doc/renderer.ts';
import { RESUME_TEMPLATES } from './src/lib/doc/templates.ts';
import { PDFArray, PDFDocument, PDFName } from 'pdf-lib';

const profile = {
  id: 'p1', variantName: 'Primary', isDefault: true, updatedAt: Date.now(),
  contact: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+44 20 7946 0000', city: 'London', country: 'United Kingdom', headline: 'Principal Software Engineer', state: '', postalCode: '' },
  presence: { linkedin: 'https://linkedin.com/in/ada', github: 'https://github.com/ada', other: [] },
  summary: 'Principal engineer with 12 years building distributed systems and developer platforms.',
  skills: [{ category: 'Languages', items: ['TypeScript', 'Go', 'Python'] }, { category: 'Cloud', items: ['AWS', 'Kubernetes', 'Terraform'] }],
  experience: [
    { id: 'e1', company: 'Analytical Engines Ltd', title: 'Principal Engineer', start: '2020-01', current: true, description: 'Leads the platform group.', highlights: ['Scaled the event pipeline to 4B events/day, cutting latency 38%.', 'Mentored 14 engineers; 6 promoted within two years.'], skills: ['TypeScript', 'Kubernetes'], location: 'London' },
    { id: 'e2', company: 'Babbage Cloud', title: 'Senior Engineer', start: '2016-04', end: '2019-12', current: false, description: 'Built multi-region infrastructure.', highlights: ['Designed a multi-region failover strategy with 99.99% uptime.'], skills: ['Go', 'Terraform'], location: 'Remote' }
  ],
  education: [{ id: 'ed1', school: 'University of London', degree: 'BSc', field: 'Computer Science', start: '2011', end: '2015', gpa: 'First class', highlights: [] }],
  certifications: [{ id: 'c1', name: 'AWS Solutions Architect', issuer: 'Amazon', date: '2022-06' }],
  languages: [{ language: 'English', level: 'native' }, { language: 'French', level: 'professional' }],
  projects: [{ id: 'pr1', name: 'OpenSpec', description: 'Open-source API specification toolkit.', highlights: ['1.2k GitHub stars.'], skills: ['TypeScript'], url: 'https://github.com/ada/openspec' }],
  awards: [{ id: 'a1', title: 'Engineering Excellence Award', issuer: 'Analytical Engines', date: '2023' }],
  eligibility: { workAuthorization: 'Authorised without restriction', requiresSponsorship: false, willingToRelocate: true, desiredSalary: '150000', desiredSalaryCurrency: 'GBP' },
  eeo: { enabled: false }
};

const ALL_FORMATS = ['pdf','docx','html','md','txt','json'];

const settings = {
  templateId: 'essential', pageSize: 'a4', hiddenSections: [], outputFormat: 'pdf', fileSource: 'generated', includePhoto: false,
  fileNamePattern: '{{name}}-{{kind}}'
};

const files = await renderFiles({
  kinds: ['resume', 'cover_letter', 'answers'],
  formats: ALL_FORMATS,
  profile,
  template: RESUME_TEMPLATES[0],
  settings,
  target: { title: 'Staff Platform Engineer', company: 'Northwind Systems', url: 'https://example.com/job/1', keywords: ['TypeScript', 'Kubernetes', 'platform'] },
  coverLetterText: 'Dear Hiring Manager,\\n\\nI am writing to apply for the Staff Platform Engineer role.\\n\\nSincerely,\\nAda Lovelace',
  answers: [{ id: 'q1', label: 'Why do you want to work here?', type: 'textarea', required: true, answer: 'Because the platform challenges are exactly the ones I have spent a decade solving.' }]
});

const seen = new Set();
const results = [];
let resumePdfBytes = null;
for (const file of files) {
  const bytes = new Uint8Array(await file.blob.arrayBuffer());
  const magic = new TextDecoder().decode(bytes.slice(0, 4));
  results.push({ name: file.filename, format: file.format, size: bytes.length, magic });
  if (bytes.length < 100) throw new Error('Suspiciously small file: ' + file.filename);
  if (file.format === 'pdf' && !magic.startsWith('%PDF')) throw new Error('Not a PDF: ' + file.filename);
  if (file.format === 'pdf' && file.kind === 'resume') resumePdfBytes = bytes;
  if (file.format === 'docx' && magic[0] !== 'P' && magic[0] !== '\\x50') {
    // DOCX is a ZIP container: PK\\x03\\x04
    const zipMagic = new TextDecoder('latin1').decode(bytes.slice(0, 2));
    if (zipMagic !== 'PK') throw new Error('Not a DOCX zip: ' + file.filename);
  }
  // Files must never reveal the employer or the role.
  if (/Northwind|Staff[-_ ]Platform|StaffPlatform/i.test(file.filename)) {
    throw new Error('File name leaks the job: ' + file.filename);
  }
  seen.add(file.format);
}

// Links must be real, clickable annotations - not plain text.
if (!resumePdfBytes) throw new Error('Missing resume PDF');
const loadedPdf = await PDFDocument.load(resumePdfBytes);
const linkUris = [];
for (const page of loadedPdf.getPages()) {
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) continue;
  for (let i = 0; i < annots.size(); i++) {
    const dict = loadedPdf.context.lookup(annots.get(i));
    const action = dict && dict.get ? loadedPdf.context.lookup(dict.get(PDFName.of('A'))) : null;
    const uri = action && action.get ? action.get(PDFName.of('URI')) : null;
    if (uri) linkUris.push(uri.decodeText ? uri.decodeText() : String(uri));
  }
}
if (linkUris.length === 0) throw new Error('Resume PDF has no link annotations');
if (!linkUris.some((uri) => uri.includes('github.com/ada'))) throw new Error('Resume PDF is missing the GitHub profile link');
if (!linkUris.some((uri) => uri.startsWith('mailto:ada@example.com'))) throw new Error('Resume PDF is missing the email mailto link');

const resumePdf = results.find((file) => file.format === 'pdf' && file.name.includes('resume'));
if (!resumePdf) throw new Error('Missing resume PDF');
if (resumePdf.name !== 'Ada-Lovelace-resume.pdf') throw new Error('Unexpected resume file name: ' + resumePdf.name);
const coverPdf = results.find((file) => file.format === 'pdf' && file.name.includes('cover-letter'));
if (!coverPdf) throw new Error('Missing cover letter PDF');
if (coverPdf.name !== 'Ada-Lovelace-cover-letter.pdf') throw new Error('Unexpected cover letter name: ' + coverPdf.name);

// The machine-readable resume must not mention the target job either.
const jsonFile = files.find((file) => file.format === 'json' && file.kind === 'json_resume');
if (jsonFile) {
  const text = await jsonFile.blob.text();
  if (/Northwind|Staff Platform Engineer/.test(text)) throw new Error('JSON Resume leaks the target job');
}

for (const format of ALL_FORMATS) {
  const expected = format === 'json' ? seen.has('json') : true;
  if (!expected) throw new Error('Missing output for format ' + format);
}

// Render every template as PDF to make sure no layout crashes.
for (const template of RESUME_TEMPLATES) {
  const [file] = await renderFiles({ kinds: ['resume'], formats: ['pdf'], profile, template, settings: { ...settings, fileNamePattern: '{{name}}_{{template}}' }, target: { title: 'Engineer', company: 'Test Co' } });
  if (!file) throw new Error('No PDF produced for template ' + template.id);
  const bytes = new Uint8Array(await file.blob.arrayBuffer());
  if (bytes.length < 800) throw new Error('Template ' + template.id + ' produced an empty PDF');
}

console.log(JSON.stringify({ files: results, templateCount: RESUME_TEMPLATES.length }, null, 2));
console.log('SMOKE TEST PASSED');
`;

mkdirSync(outDir, { recursive: true });
const entryPath = join(outDir, 'entry.mjs');
writeFileSync(entryPath, entry);

const bundlePath = join(outDir, 'bundle.mjs');

const result = await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: 'smoke.ts', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: bundlePath,
  alias: { '@': join(root, 'src') },
  logLevel: 'error',
  external: [],
  define: { __TARGET__: '"chrome"', __DEV__: 'false' },
});

if (result.errors.length > 0) {
  console.error(result.errors);
  process.exit(1);
}

try {
  await import(`file://${bundlePath.replace(/\\/g, '/')}`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
