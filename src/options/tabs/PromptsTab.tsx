import { useMemo, useState } from 'react';
import type { AppSettings, TaskId } from '@/types';
import { DEFAULT_TASK_TEMPLATES, TASK_LABELS, TASK_PLACEHOLDERS } from '@/lib/ai/prompts';
import { Badge, Button, Field, SectionCard, Select, Show, Textarea, Input } from '@/ui/components';
import { IconCheck, IconRefresh, IconX } from '@/ui/components/Icons';
import { useToast } from '@/ui/components/Toast';

export { PromptsIcon } from './prompts/components/PromptsIcon';

export function PromptsTab({ settings, patchSettings }: { settings: AppSettings; patchSettings: (patch: Record<string, unknown>) => Promise<AppSettings> }) {
  const toast = useToast();
  const [task, setTask] = useState<TaskId>('tailorResume');
  const [avoidInput, setAvoidInput] = useState('');
  const [emphasizeInput, setEmphasizeInput] = useState('');
  const prompts = settings.prompts;

  const template = useMemo(() => prompts.templates[task] ?? DEFAULT_TASK_TEMPLATES[task], [prompts.templates, task]);

  const patchPrompts = (patch: Partial<AppSettings['prompts']>) => patchSettings({ prompts: { ...prompts, ...patch } });

  const isCustomised = Boolean(prompts.templates[task] && prompts.templates[task] !== DEFAULT_TASK_TEMPLATES[task]);

  const taskIds = Object.keys(TASK_LABELS) as TaskId[];

  const renderTaskTab = (id: TaskId) => (
    <button key={id} className={`tabs__tab ${id === task ? 'active' : ''}`} onClick={() => setTask(id)}>
      {TASK_LABELS[id].label}
    </button>
  );

  const renderAvoidWord = (word: string) => (
    <span className="chip" key={word}>
      {word}
      <button onClick={() => void patchPrompts({ avoidWords: prompts.avoidWords.filter((entry) => entry !== word) })}>
        <IconX size={11} />
      </button>
    </span>
  );

  const renderEmphasize = (theme: string) => (
    <span className="chip" key={theme}>
      {theme}
      <button onClick={() => void patchPrompts({ emphasize: prompts.emphasize.filter((entry) => entry !== theme) })}>
        <IconX size={11} />
      </button>
    </span>
  );

  const renderPlaceholder = (placeholder: string) => (
    <span className="chip mono" key={placeholder}>
      {`{{${placeholder}}}`}
    </span>
  );

  const renderTruthfulnessRule = (rule: string) => (
    <div className="list-item" key={rule}>
      <IconCheck size={15} />
      <div className="list-item__main">
        <div className="list-item__title">{rule}</div>
      </div>
    </div>
  );

  return (
    <>
      <header className="main__header">
        <div>
          <h1 className="main__title">Prompts & style</h1>
          <p className="main__subtitle">
            JobPal handles the prompting for you, but you are in charge of the voice. Global instructions apply to every AI call; task templates control how each
            step is asked.
          </p>
        </div>
        <Button
          variant="outline"
          icon={<IconRefresh size={15} />}
          onClick={() =>
            void patchSettings({
              prompts: {
                ...prompts,
                globalInstructions: '',
                avoidWords: [],
                emphasize: [],
                tone: 'professional',
                templates: {},
              },
            }).then(() => toast.push('Prompts reset to defaults.'))
          }
        >
          Reset all prompts
        </Button>
      </header>

      <div className="grid grid--2">
        <SectionCard title="Global instructions" hint="Highest priority after JobPal's truthfulness rules. Applied to every call.">
          <Textarea
            rows={9}
            value={prompts.globalInstructions}
            placeholder={'Examples:\n- Never invent metrics or employers.\n- Keep the tone confident but humble.\n- Prefer British English.'}
            onChange={(event) => void patchPrompts({ globalInstructions: event.target.value })}
          />
          <div className="row row--between mt-2">
            <span className="tiny muted">{prompts.globalInstructions.length} characters</span>
            <Badge tone="info">Applies everywhere</Badge>
          </div>
        </SectionCard>

        <SectionCard title="Voice & style">
          <Field label="Tone">
            <Select value={prompts.tone} onChange={(event) => void patchPrompts({ tone: event.target.value as AppSettings['prompts']['tone'] })}>
              <option value="professional">Professional</option>
              <option value="confident">Confident</option>
              <option value="enthusiastic">Enthusiastic</option>
              <option value="concise">Concise</option>
              <option value="warm">Warm</option>
            </Select>
          </Field>
          <Field label="Writing style">
            <Textarea rows={3} value={prompts.writingStyle} onChange={(event) => void patchPrompts({ writingStyle: event.target.value })} />
          </Field>
          <Field label="Words to avoid" hint="The AI is instructed never to use these.">
            <div className="row mb-1">
              <Input
                value={avoidInput}
                placeholder="Add a word or phrase…"
                onChange={(event) => setAvoidInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && avoidInput.trim()) {
                    void patchPrompts({ avoidWords: [...prompts.avoidWords, avoidInput.trim()] });
                    setAvoidInput('');
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!avoidInput.trim()) return;
                  void patchPrompts({ avoidWords: [...prompts.avoidWords, avoidInput.trim()] });
                  setAvoidInput('');
                }}
              >
                Add
              </Button>
            </div>
            <div className="chips">{prompts.avoidWords.map(renderAvoidWord)}</div>
          </Field>
          <Field label="Themes to emphasise" hint="JobPal will surface these wherever they are truthful.">
            <div className="row mb-1">
              <Input
                value={emphasizeInput}
                placeholder="e.g. leadership, accessibility, cost reduction"
                onChange={(event) => setEmphasizeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && emphasizeInput.trim()) {
                    void patchPrompts({ emphasize: [...prompts.emphasize, emphasizeInput.trim()] });
                    setEmphasizeInput('');
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!emphasizeInput.trim()) return;
                  void patchPrompts({ emphasize: [...prompts.emphasize, emphasizeInput.trim()] });
                  setEmphasizeInput('');
                }}
              >
                Add
              </Button>
            </div>
            <div className="chips">{prompts.emphasize.map(renderEmphasize)}</div>
          </Field>
        </SectionCard>
      </div>

      <SectionCard title="Task templates" hint="Fine-tune the instructions for each step. Use the placeholders to inject live data.">
        <div className="tabs mb-2">{taskIds.map(renderTaskTab)}</div>
        <div className="row row--between mb-2">
          <div>
            <div className="strong">{TASK_LABELS[task].label}</div>
            <div className="tiny muted">{TASK_LABELS[task].description}</div>
          </div>
          <div className="row">
            <Show if={isCustomised}>
              <Badge tone="warning">Customised</Badge>
            </Show>
            <Button
              size="sm"
              variant="outline"
              icon={<IconRefresh size={13} />}
              disabled={!isCustomised}
              onClick={() => {
                const templates = { ...prompts.templates };
                delete templates[task];
                void patchPrompts({ templates });
                toast.push('Template reset to default.');
              }}
            >
              Reset task
            </Button>
          </div>
        </div>
        <Textarea
          rows={14}
          className="textarea--code"
          value={template}
          onChange={(event) => void patchPrompts({ templates: { ...prompts.templates, [task]: event.target.value } })}
        />
        <div className="mt-2">
          <div className="tiny muted mb-1">Available placeholders for this task:</div>
          <div className="chips">{TASK_PLACEHOLDERS[task].map(renderPlaceholder)}</div>
        </div>
      </SectionCard>
    </>
  );
}
