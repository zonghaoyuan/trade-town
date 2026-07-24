import {
  CREATE_ME_DEFAULT_DRAFT,
  CREATE_ME_DRAFT_KEY,
  CREATE_ME_OWNER_KEY,
  CreateMeDraft,
  sanitizeCreateMeDraft,
} from '../../../shared/createMe';

const CREATED_ME_KEY = 'trade-town:created-me:v1';

export type CreateMeLocalState = {
  step: number;
  draft: CreateMeDraft;
};

export type CreatedMeLocal = {
  draft: CreateMeDraft;
  textureUrl: string;
  version?: number;
};

export function loadCreateMeState(): CreateMeLocalState {
  if (typeof window === 'undefined') return { step: 0, draft: CREATE_ME_DEFAULT_DRAFT };
  try {
    const stored = window.localStorage.getItem(CREATE_ME_DRAFT_KEY);
    if (!stored) return { step: 0, draft: CREATE_ME_DEFAULT_DRAFT };
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && 'draft' in parsed) {
      return {
        step: Math.min(2, Math.max(0, Number(parsed.step) || 0)),
        draft: sanitizeCreateMeDraft(parsed.draft),
      };
    }
    return { step: 0, draft: sanitizeCreateMeDraft(parsed) };
  } catch {
    return { step: 0, draft: CREATE_ME_DEFAULT_DRAFT };
  }
}

export function saveCreateMeState(state: CreateMeLocalState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CREATE_ME_DRAFT_KEY, JSON.stringify(state));
}

export function clearCreateMeDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CREATE_ME_DRAFT_KEY);
}

export function loadCreatedMe(): CreatedMeLocal | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(CREATED_ME_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<CreatedMeLocal>;
    if (!parsed.textureUrl) return null;
    return {
      draft: sanitizeCreateMeDraft(parsed.draft),
      textureUrl: parsed.textureUrl,
      version: parsed.version,
    };
  } catch {
    return null;
  }
}

export function saveCreatedMe(me: CreatedMeLocal) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CREATED_ME_KEY, JSON.stringify(me));
}

export function getAnonymousOwnerId() {
  if (typeof window === 'undefined') return 'server-preview';
  const stored = window.localStorage.getItem(CREATE_ME_OWNER_KEY);
  if (stored) return stored;
  const ownerId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(CREATE_ME_OWNER_KEY, ownerId);
  return ownerId;
}
