import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  CREATE_ME_PRESETS,
  CREATE_ME_SCENARIOS,
  LPC_BOTTOM_STYLES,
  LPC_CLOTHING_COLORS,
  LPC_HAIR_COLORS,
  LPC_HAIR_STYLES,
  LPC_SHOES_STYLES,
  LPC_SKIN_TONES,
  LPC_TOP_STYLES,
  CreateMeDraft,
  compileMeProfile,
  getCreateMePreset,
} from '../../../shared/createMe';
import { composeLpcWalkSheet } from '../../features/create-me/lpcComposer';
import {
  clearCreateMeDraft,
  getAnonymousOwnerId,
  loadCreateMeState,
  saveCreateMeState,
  saveCreatedMe,
} from '../../features/create-me/storage';
import { useI18n } from '../../i18n';
import {
  localizeCompiledProfileText,
  localizeCreateMeLabel,
  localizeScenarioChoice,
  localizeScenarioTitle,
} from '../../i18n/domain';

export type CreateMePayload = CreateMeDraft & {
  ownerId: string;
  requestId: string;
  composedWalkSheet?: Blob;
};

export type CreatedMeView = {
  draft: CreateMeDraft;
  textureUrl: string;
  version?: number;
};

type CreateMeModalProps = {
  initialMe?: CreatedMeView | null;
  onClose: () => void;
  onSubmit?: (payload: CreateMePayload) => Promise<unknown>;
  onCreated?: (me: CreatedMeView) => void;
};

const goalOptions = [
  {
    value: 'growth',
    labelKey: 'create.goalGrowth',
    noteKey: 'create.goalGrowthNote',
  },
  {
    value: 'income',
    labelKey: 'create.goalIncome',
    noteKey: 'create.goalIncomeNote',
  },
  {
    value: 'preservation',
    labelKey: 'create.goalPreservation',
    noteKey: 'create.goalPreservationNote',
  },
  {
    value: 'learning',
    labelKey: 'create.goalLearning',
    noteKey: 'create.goalLearningNote',
  },
] as const;

const horizonOptions = [
  {
    value: 'short',
    labelKey: 'create.horizonShort',
    noteKey: 'create.horizonShortNote',
  },
  {
    value: 'medium',
    labelKey: 'create.horizonMedium',
    noteKey: 'create.horizonMediumNote',
  },
  {
    value: 'long',
    labelKey: 'create.horizonLong',
    noteKey: 'create.horizonLongNote',
  },
] as const;

function createRequestId() {
  return typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `create-me-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CreateMeModal({
  initialMe,
  onClose,
  onSubmit,
  onCreated,
}: CreateMeModalProps) {
  const { t } = useI18n();
  const localState = useMemo(() => loadCreateMeState(), []);
  const [step, setStep] = useState(initialMe ? 0 : localState.step);
  const [draft, setDraft] = useState<CreateMeDraft>(initialMe?.draft ?? localState.draft);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [completedTextureUrl, setCompletedTextureUrl] = useState('');
  const [error, setError] = useState('');
  const [customPreview, setCustomPreview] = useState({
    dataUrl: '',
    loading: false,
    error: '',
  });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const requestIdRef = useRef(createRequestId());
  const compiled = useMemo(() => compileMeProfile(draft), [draft]);
  const preset = getCreateMePreset(draft.presetId);
  const previewTextureUrl =
    draft.appearanceMode === 'custom' ? customPreview.dataUrl : preset.textureUrl;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    saveCreateMeState({ step, draft });
  }, [draft, step]);

  useEffect(() => {
    if (draft.appearanceMode !== 'custom') return;
    let cancelled = false;
    setCustomPreview((current) => ({ ...current, loading: true, error: '' }));
    const timer = window.setTimeout(() => {
      void composeLpcWalkSheet(draft)
        .then((sheet) => {
          if (!cancelled) {
            setCustomPreview({ dataUrl: sheet.dataUrl, loading: false, error: '' });
          }
        })
        .catch((caught) => {
          if (!cancelled) {
            setCustomPreview({
              dataUrl: '',
              loading: false,
              error: caught instanceof Error ? caught.message : t('create.loadFailed'),
            });
          }
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    draft.appearanceMode,
    draft.bottomColor,
    draft.bottomStyle,
    draft.hairColor,
    draft.hairStyle,
    draft.shoesStyle,
    draft.skinTone,
    draft.topColor,
    draft.topStyle,
    t,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!submitting) onClose();
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, submitting]);

  const updateDraft = <Key extends keyof CreateMeDraft>(
    key: Key,
    value: CreateMeDraft[Key],
  ) => {
    setError('');
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const randomizeAppearance = () => {
    if (draft.appearanceMode === 'preset') {
      const currentIndex = CREATE_ME_PRESETS.findIndex((item) => item.id === draft.presetId);
      const offset = 1 + Math.floor(Math.random() * (CREATE_ME_PRESETS.length - 1));
      updateDraft(
        'presetId',
        CREATE_ME_PRESETS[(currentIndex + offset) % CREATE_ME_PRESETS.length].id,
      );
      return;
    }
    const pick = <Item,>(items: readonly Item[]) =>
      items[Math.floor(Math.random() * items.length)];
    setDraft((current) => ({
      ...current,
      skinTone: pick(LPC_SKIN_TONES).id,
      hairStyle: pick(LPC_HAIR_STYLES).id,
      hairColor: pick(LPC_HAIR_COLORS).id,
      topStyle: pick(LPC_TOP_STYLES).id,
      topColor: pick(LPC_CLOTHING_COLORS).id,
      bottomStyle: pick(LPC_BOTTOM_STYLES).id,
      bottomColor: pick(LPC_CLOTHING_COLORS).id,
      shoesStyle: pick(LPC_SHOES_STYLES).id,
    }));
  };

  const answerScenario = (
    scenarioId: CreateMeDraft['scenarios'][number],
    choice: NonNullable<CreateMeDraft['scenarioAnswers'][typeof scenarioId]>,
  ) => {
    setError('');
    setDraft((current) => ({
      ...current,
      scenarios: current.scenarios.includes(scenarioId)
        ? current.scenarios
        : [...current.scenarios, scenarioId],
      scenarioAnswers: { ...current.scenarioAnswers, [scenarioId]: choice },
    }));
  };

  const next = () => {
    if (step === 0 && !draft.displayName.trim()) {
      setError(t('create.nameRequired'));
      return;
    }
    if (step === 0 && draft.appearanceMode === 'custom' && customPreview.error) {
      setError(customPreview.error);
      return;
    }
    if (step === 1 && Object.keys(draft.scenarioAnswers).length < CREATE_ME_SCENARIOS.length) {
      setError(t('create.scenariosRequired'));
      return;
    }
    setError('');
    setStep((current) => Math.min(2, current + 1));
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const normalizedDraft = { ...draft, displayName: draft.displayName.trim() };
      const composed =
        draft.appearanceMode === 'custom'
          ? await composeLpcWalkSheet(normalizedDraft)
          : null;
      const payload: CreateMePayload = {
        ...normalizedDraft,
        ownerId: getAnonymousOwnerId(),
        requestId: requestIdRef.current,
        composedWalkSheet: composed?.blob,
      };
      const result = onSubmit ? await onSubmit(payload) : null;
      const serverResult =
        result && typeof result === 'object'
          ? (result as { version?: number; textureUrl?: string })
          : null;
      const createdMe: CreatedMeView = {
        draft: normalizedDraft,
        textureUrl: serverResult?.textureUrl ?? composed?.dataUrl ?? preset.textureUrl,
        version: serverResult?.version,
      };
      clearCreateMeDraft();
      saveCreatedMe(createdMe);
      onCreated?.(createdMe);
      setCompletedTextureUrl(createdMe.textureUrl);
      setComplete(true);
    } catch (caught) {
      const backendMessage =
        caught && typeof caught === 'object' && 'data' in caught
          ? String((caught as { data: unknown }).data)
          : null;
      setError(
        backendMessage ??
          (caught instanceof Error ? caught.message : t('create.failed')),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-me-backdrop" role="presentation">
      <section
        ref={modalRef}
        className="create-me-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-me-title"
      >
        <button
          type="button"
          className="create-me-close"
          aria-label={t('create.close')}
          disabled={submitting}
          onClick={onClose}
        >
          ×
        </button>

        {complete ? (
          <CreateComplete
            name={draft.displayName}
            textureUrl={completedTextureUrl || previewTextureUrl || preset.textureUrl}
            onClose={onClose}
          />
        ) : (
          <>
            <header className="create-me-heading">
              <h2 id="create-me-title" ref={titleRef} tabIndex={-1}>
                {t('create.title')}
              </h2>
            </header>

            <ol className="create-me-steps" aria-label={t('create.stepsAria')}>
              {[
                t('create.stepAppearance'),
                t('create.stepProfile'),
                t('create.stepConfirm'),
              ].map((label, index) => (
                <li
                  key={label}
                  className={index === step ? 'is-active' : index < step ? 'is-done' : ''}
                >
                  <i>{index < step ? '✓' : index + 1}</i>
                  <span>{label}</span>
                </li>
              ))}
            </ol>

            <div className="create-me-content">
              {step === 0 && (
                <AppearanceStep
                  draft={draft}
                  previewTextureUrl={previewTextureUrl}
                  previewLoading={customPreview.loading}
                  previewError={customPreview.error}
                  onChange={updateDraft}
                  onRandomize={randomizeAppearance}
                />
              )}
              {step === 1 && (
                <ProfileStep
                  draft={draft}
                  onChange={updateDraft}
                  onAnswerScenario={answerScenario}
                />
              )}
              {step === 2 && (
                <ConfirmStep
                  draft={draft}
                  compiled={compiled}
                  textureUrl={previewTextureUrl || preset.textureUrl}
                />
              )}
            </div>

            {error && (
              <p className="create-me-error" role="alert" aria-live="assertive">
                ! {error}
              </p>
            )}

            <footer className="create-me-footer">
              <button
                type="button"
                className="create-me-later"
                disabled={submitting}
                onClick={onClose}
              >
                {t('create.later')}
              </button>
              <div>
                {step > 0 && (
                  <button
                    type="button"
                    className="pixel-button pixel-button-small create-me-back"
                    disabled={submitting}
                    onClick={() => setStep((current) => current - 1)}
                  >
                    {t('create.back')}
                  </button>
                )}
                {step < 2 ? (
                  <button
                    type="button"
                    className="pixel-button create-me-primary"
                    disabled={
                      step === 0 &&
                      draft.appearanceMode === 'custom' &&
                      customPreview.loading
                    }
                    onClick={next}
                  >
                    {customPreview.loading && step === 0
                      ? t('create.composing')
                      : t('create.next')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pixel-button create-me-primary"
                    disabled={submitting}
                    onClick={() => void submit()}
                  >
                    {submitting
                      ? t('create.creating')
                      : initialMe
                        ? t('create.saveVersion')
                        : t('create.enterTown')}
                  </button>
                )}
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

function CharacterPreview({
  textureUrl,
  label,
  size = 'large',
}: {
  textureUrl: string;
  label: string;
  size?: 'small' | 'large';
}) {
  const { t } = useI18n();
  return (
    <span
      className={`create-me-sprite is-${size} ${textureUrl ? '' : 'is-empty'}`}
      role="img"
      aria-label={t('create.previewAria', { name: label })}
    >
      {textureUrl ? <i style={{ backgroundImage: `url("${textureUrl}")` }} /> : <b>…</b>}
    </span>
  );
}

function AppearanceStep({
  draft,
  previewTextureUrl,
  previewLoading,
  previewError,
  onChange,
  onRandomize,
}: {
  draft: CreateMeDraft;
  previewTextureUrl: string;
  previewLoading: boolean;
  previewError: string;
  onChange: <Key extends keyof CreateMeDraft>(
    key: Key,
    value: CreateMeDraft[Key],
  ) => void;
  onRandomize: () => void;
}) {
  const { t } = useI18n();
  const preset = getCreateMePreset(draft.presetId);
  return (
    <div className="create-me-appearance">
      <aside className="create-me-preview-panel">
        <CharacterPreview
          textureUrl={previewTextureUrl}
          label={
            draft.appearanceMode === 'custom' ? t('create.customCharacter') : preset.label
          }
        />
        <strong>{draft.displayName || 'ME'}</strong>
        {(previewError || previewLoading) && (
          <small>{previewError || t('create.previewLoading')}</small>
        )}
        <button type="button" className="create-me-random" onClick={onRandomize}>
          {t('create.randomAppearance')}
        </button>
      </aside>

      <div className="create-me-form-panel">
        <label className="create-me-name-field">
          <span>{t('create.characterName')}</span>
          <input
            value={draft.displayName}
            maxLength={20}
            placeholder="ME"
            onChange={(event) => onChange('displayName', event.target.value)}
          />
          <small>{draft.displayName.length}/20</small>
        </label>

        <div className="create-me-mode-toggle" aria-label={t('create.appearanceMode')}>
          <button
            type="button"
            className={draft.appearanceMode === 'preset' ? 'is-selected' : ''}
            onClick={() => onChange('appearanceMode', 'preset')}
          >
            {t('create.presets')}
          </button>
          <button
            type="button"
            className={draft.appearanceMode === 'custom' ? 'is-selected' : ''}
            onClick={() => onChange('appearanceMode', 'custom')}
          >
            {t('create.customize')}
          </button>
        </div>

        {draft.appearanceMode === 'preset' ? (
          <>
            <div className="create-me-section-title">
              <div>
                <h3>{t('create.choosePreset')}</h3>
              </div>
            </div>
            <div className="create-me-preset-grid">
              {CREATE_ME_PRESETS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === draft.presetId ? 'is-selected' : ''}
                  aria-pressed={item.id === draft.presetId}
                  onClick={() => onChange('presetId', item.id)}
                >
                  <CharacterPreview
                    textureUrl={item.textureUrl}
                    label={item.label}
                    size="small"
                  />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="create-me-customizer">
            <VariantRow
              label={t('create.body')}
              category="skinTone"
              items={LPC_SKIN_TONES}
              selected={draft.skinTone}
              onSelect={(value) => onChange('skinTone', value)}
            />
            <VariantRow
              label={t('create.hairStyle')}
              category="hairStyle"
              items={LPC_HAIR_STYLES}
              selected={draft.hairStyle}
              onSelect={(value) => onChange('hairStyle', value)}
            />
            <ColorRow
              label={t('create.hairColor')}
              category="hairColor"
              items={LPC_HAIR_COLORS}
              selected={draft.hairColor}
              onSelect={(value) => onChange('hairColor', value)}
            />
            <VariantRow
              label={t('create.top')}
              category="topStyle"
              items={LPC_TOP_STYLES}
              selected={draft.topStyle}
              onSelect={(value) => onChange('topStyle', value)}
            />
            <ColorRow
              label={t('create.topColor')}
              category="clothingColor"
              items={LPC_CLOTHING_COLORS}
              selected={draft.topColor}
              onSelect={(value) => onChange('topColor', value)}
            />
            <VariantRow
              label={t('create.bottom')}
              category="bottomStyle"
              items={LPC_BOTTOM_STYLES}
              selected={draft.bottomStyle}
              onSelect={(value) => onChange('bottomStyle', value)}
            />
            <ColorRow
              label={t('create.bottomColor')}
              category="clothingColor"
              items={LPC_CLOTHING_COLORS}
              selected={draft.bottomColor}
              onSelect={(value) => onChange('bottomColor', value)}
            />
            <VariantRow
              label={t('create.shoes')}
              category="shoesStyle"
              items={LPC_SHOES_STYLES}
              selected={draft.shoesStyle}
              onSelect={(value) => onChange('shoesStyle', value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function VariantRow<Id extends string>({
  label,
  category,
  items,
  selected,
  onSelect,
}: {
  label: string;
  category: string;
  items: readonly { id: Id; label: string }[];
  selected: Id;
  onSelect: (id: Id) => void;
}) {
  const { locale } = useI18n();
  return (
    <div className="create-me-variant-row">
      <strong>{label}</strong>
      <div>
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={selected === item.id ? 'is-selected' : ''}
            aria-pressed={selected === item.id}
            onClick={() => onSelect(item.id)}
          >
            {localizeCreateMeLabel(locale, category, item.id, item.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorRow<Id extends string>({
  label,
  category,
  items,
  selected,
  onSelect,
}: {
  label: string;
  category: string;
  items: readonly { id: Id; label: string; tint: string }[];
  selected: Id;
  onSelect: (id: Id) => void;
}) {
  const { locale, t } = useI18n();
  return (
    <div className="create-me-variant-row create-me-color-row">
      <strong>{label}</strong>
      <div>
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={selected === item.id ? 'is-selected' : ''}
            aria-label={t('create.colorAria', {
              label,
              item: localizeCreateMeLabel(locale, category, item.id, item.label),
            })}
            aria-pressed={selected === item.id}
            title={localizeCreateMeLabel(locale, category, item.id, item.label)}
            onClick={() => onSelect(item.id)}
          >
            <i style={{ background: item.tint }} />
            <span>{localizeCreateMeLabel(locale, category, item.id, item.label)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileStep({
  draft,
  onChange,
  onAnswerScenario,
}: {
  draft: CreateMeDraft;
  onChange: <Key extends keyof CreateMeDraft>(
    key: Key,
    value: CreateMeDraft[Key],
  ) => void;
  onAnswerScenario: (
    scenario: CreateMeDraft['scenarios'][number],
    choice: NonNullable<
      CreateMeDraft['scenarioAnswers'][CreateMeDraft['scenarios'][number]]
    >,
  ) => void;
}) {
  const { locale, t } = useI18n();
  return (
    <div className="create-me-profile">
      <section className="create-me-profile-block">
        <div className="create-me-section-title">
          <div>
            <h3>{t('create.goalTitle')}</h3>
          </div>
        </div>
        <div className="create-me-option-grid goal-grid">
          {goalOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={draft.investmentGoal === option.value ? 'is-selected' : ''}
              aria-pressed={draft.investmentGoal === option.value}
              onClick={() => onChange('investmentGoal', option.value)}
            >
              <strong>{t(option.labelKey)}</strong>
              <small>{t(option.noteKey)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="create-me-profile-block create-me-traits">
        <div className="create-me-section-title">
          <div>
            <h3>{t('create.riskTitle')}</h3>
          </div>
        </div>
        <div className="create-me-horizon">
          {horizonOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={draft.horizon === option.value ? 'is-selected' : ''}
              aria-pressed={draft.horizon === option.value}
              onClick={() => onChange('horizon', option.value)}
            >
              <strong>{t(option.labelKey)}</strong>
              <small>{t(option.noteKey)}</small>
            </button>
          ))}
        </div>
        <RangeField
          label={t('create.maxDrawdown')}
          value={draft.maxDrawdownPct}
          min={5}
          max={40}
          suffix="%"
          onChange={(value) => onChange('maxDrawdownPct', value)}
        />
        <RangeField
          label={t('create.conviction')}
          value={draft.conviction}
          onChange={(value) => onChange('conviction', value)}
        />
        <RangeField
          label={t('create.socialInfluence')}
          value={draft.socialInfluence}
          onChange={(value) => onChange('socialInfluence', value)}
        />
        <RangeField
          label={t('create.lossAversion')}
          value={draft.lossAversion}
          onChange={(value) => onChange('lossAversion', value)}
        />
      </section>

      <section className="create-me-profile-block create-me-scenarios">
        <div className="create-me-section-title">
          <div>
            <h3>{t('create.scenariosTitle')}</h3>
          </div>
          <small>{Object.keys(draft.scenarioAnswers).length}/5</small>
        </div>
        <div className="create-me-scenario-grid">
          {CREATE_ME_SCENARIOS.map((scenario) => (
            <div key={scenario.id}>
              <strong>{localizeScenarioTitle(locale, scenario.id, scenario.title)}</strong>
              <span>
                {scenario.choices.map((choice) => (
                  <button
                    type="button"
                    key={choice.value}
                    className={
                      draft.scenarioAnswers[scenario.id] === choice.value
                        ? 'is-selected'
                        : ''
                    }
                    aria-pressed={draft.scenarioAnswers[scenario.id] === choice.value}
                    onClick={() => onAnswerScenario(scenario.id, choice.value)}
                  >
                    {localizeScenarioChoice(
                      locale,
                      scenario.id,
                      choice.value,
                      choice.label,
                    )}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RangeField({
  label,
  value,
  min = 0,
  max = 100,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="create-me-range">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        style={
          { '--range-value': `${((value - min) / (max - min)) * 100}%` } as CSSProperties
        }
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong>
        {value}
        {suffix}
      </strong>
    </label>
  );
}

function ConfirmStep({
  draft,
  compiled,
  textureUrl,
}: {
  draft: CreateMeDraft;
  compiled: ReturnType<typeof compileMeProfile>;
  textureUrl: string;
}) {
  const { locale, t } = useI18n();
  const goal = goalOptions.find((option) => option.value === draft.investmentGoal);
  const horizon = horizonOptions.find((option) => option.value === draft.horizon);
  return (
    <div className="create-me-confirm">
      <section className="create-me-passport">
        <CharacterPreview textureUrl={textureUrl} label={draft.displayName} />
        <h3>{draft.displayName}</h3>
        <p>{localizeCompiledProfileText(locale, compiled.decisionStyle)}</p>
        <div>
          <span>{goal ? t(goal.labelKey) : ''}</span>
          <span>{horizon ? t(horizon.labelKey) : ''}</span>
          <span>
            {compiled.tradeFrequency === 'high'
              ? t('create.frequencyHigh')
              : compiled.tradeFrequency === 'low'
                ? t('create.frequencyLow')
                : t('create.frequencyMedium')}
          </span>
        </div>
      </section>

      <section className="create-me-compiled">
        <div className="create-me-section-title">
          <div>
            <h3>{t('create.behaviorPreview')}</h3>
          </div>
        </div>
        <dl>
          <div>
            <dt>{t('create.riskCapacity')}</dt>
            <dd>{compiled.riskTolerance}/100</dd>
          </div>
          <div>
            <dt>{t('create.cashBuffer')}</dt>
            <dd>{compiled.cashBufferPct}%</dd>
          </div>
          <div>
            <dt>{t('create.positionLimit')}</dt>
            <dd>{compiled.maxPositionPct}%</dd>
          </div>
          <div>
            <dt>{t('create.holdingPeriod')}</dt>
            <dd>{t('create.daysUnit', { count: compiled.holdingPeriodDays })}</dd>
          </div>
          <div>
            <dt>{t('create.socialWeight')}</dt>
            <dd>{compiled.socialSignalWeight}/100</dd>
          </div>
          <div>
            <dt>{t('create.stopLoss')}</dt>
            <dd>{compiled.stopLossDiscipline}/100</dd>
          </div>
        </dl>
        <div className="create-me-risk-note">
          <strong>{t('create.behaviorReminder')}</strong>
          {compiled.riskFlags.map((flag) => (
            <span key={flag}>! {localizeCompiledProfileText(locale, flag)}</span>
          ))}
        </div>
        <p>{t('create.disclaimer')}</p>
      </section>
    </div>
  );
}

function CreateComplete({
  name,
  textureUrl,
  onClose,
}: {
  name: string;
  textureUrl: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="create-me-complete">
      <CharacterPreview textureUrl={textureUrl} label={name} />
      <h2>{t('create.ready', { name })}</h2>
      <button type="button" className="pixel-button create-me-primary" onClick={onClose}>
        {t('create.returnTown')}
      </button>
    </div>
  );
}
