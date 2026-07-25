import {
  localizeCompiledProfileText,
  localizeCreateMeLabel,
  localizeMapLabel,
  localizeMarketName,
  localizeScenarioChoice,
  localizeScenarioTitle,
  localizeTraderRole,
  mapLabels,
} from './domain';
import { buildings } from '../../data/urban';

describe('localized product metadata', () => {
  test('uses stable financial identifiers for localized presentation', () => {
    expect(localizeMarketName('zh-CN', 'ACME', 'fallback')).toBe('ACME 工业');
    expect(localizeTraderRole('zh-CN', 'Mira Chen', 'fallback')).toBe('宏观策略师');
    expect(localizeMarketName('zh-CN', 'UNKNOWN', 'fallback')).toBe('fallback');
  });

  test('has non-empty English and Chinese text for every configured map label', () => {
    for (const building of Object.values(mapLabels)) {
      expect(building.en.trim()).not.toBe('');
      expect(building['zh-CN'].trim()).not.toBe('');
    }
    expect(localizeMapLabel('en', 'injective_exchange')).toBe('Injective Exchange');
    for (const building of buildings.filter((item) => item.mapLabel)) {
      expect(mapLabels[building.id]).toBeDefined();
      expect(localizeMapLabel('en', building.id).trim()).not.toBe('');
      expect(localizeMapLabel('zh-CN', building.id).trim()).not.toBe('');
    }
  });

  test('localizes Create ME choices without changing their stored IDs', () => {
    expect(localizeCreateMeLabel('en', 'hairStyle', 'bob', 'fallback')).toBe(
      'Short bob',
    );
    expect(localizeScenarioTitle('en', 'market_crash', 'fallback')).toContain('12%');
    expect(
      localizeScenarioChoice('zh-CN', 'market_crash', 'cautious', 'fallback'),
    ).toBe('先降低仓位');
    expect(localizeCompiledProfileText('en', '暂无突出行为偏差')).toBe(
      'No prominent behavioral bias detected',
    );
  });
});
