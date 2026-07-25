import {
  CREATE_ME_DEFAULT_DRAFT,
  buildMeAgentNarrative,
  compileMeProfile,
  sanitizeCreateMeDraft,
} from './createMe';

describe('Create ME profile compiler', () => {
  test('compiles the same inputs deterministically', () => {
    expect(compileMeProfile(CREATE_ME_DEFAULT_DRAFT)).toEqual(
      compileMeProfile({ ...CREATE_ME_DEFAULT_DRAFT }),
    );
  });

  test('a defensive profile keeps more cash than an aggressive profile', () => {
    const defensive = compileMeProfile({
      ...CREATE_ME_DEFAULT_DRAFT,
      investmentGoal: 'preservation',
      maxDrawdownPct: 5,
      lossAversion: 85,
      scenarios: ['market_crash'],
    });
    const aggressive = compileMeProfile({
      ...CREATE_ME_DEFAULT_DRAFT,
      investmentGoal: 'growth',
      horizon: 'long',
      maxDrawdownPct: 35,
      lossAversion: 20,
    });

    expect(defensive.cashBufferPct).toBeGreaterThan(aggressive.cashBufferPct);
    expect(defensive.riskTolerance).toBeLessThan(aggressive.riskTolerance);
  });

  test('scenario choices affect risk and social-signal weight', () => {
    const cautious = compileMeProfile({
      ...CREATE_ME_DEFAULT_DRAFT,
      scenarios: ['market_crash', 'crowd_fomo'],
      scenarioAnswers: {
        market_crash: 'cautious',
        crowd_fomo: 'cautious',
      },
    });
    const aggressive = compileMeProfile({
      ...CREATE_ME_DEFAULT_DRAFT,
      scenarios: ['market_crash', 'crowd_fomo'],
      scenarioAnswers: {
        market_crash: 'aggressive',
        crowd_fomo: 'aggressive',
      },
    });

    expect(cautious.riskTolerance).toBeLessThan(aggressive.riskTolerance);
    expect(cautious.socialSignalWeight).toBeLessThan(aggressive.socialSignalWeight);
  });

  test('sanitizes stale or malformed local drafts', () => {
    expect(
      sanitizeCreateMeDraft({
        displayName: '  A very long name for a town citizen  ',
        presetId: 'unknown',
        maxDrawdownPct: 500,
        conviction: -10,
        scenarios: ['market_crash', 'not-real'],
        scenarioAnswers: {
          market_crash: 'measured',
          crowd_fomo: 'not-real',
        },
      }),
    ).toMatchObject({
      displayName: 'A very long name for',
      presetId: 'mira',
      maxDrawdownPct: 40,
      conviction: 0,
      scenarios: ['market_crash'],
      scenarioAnswers: {
        market_crash: 'measured',
      },
    });
  });

  test('turns the compiled profile into an autonomous agent identity and plan', () => {
    const compiled = compileMeProfile(CREATE_ME_DEFAULT_DRAFT);
    const narrative = buildMeAgentNarrative(' Veylor ', compiled);

    expect(narrative.description).toContain('autonomous financial digital twin');
    expect(narrative.identity).toContain('Veylor');
    expect(narrative.plan).toContain(`${compiled.cashBufferPct}% cash`);
    expect(narrative.plan).toContain(`${compiled.maxPositionPct}%`);
  });
});
