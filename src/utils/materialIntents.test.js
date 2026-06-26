import { describe, expect, it } from 'vitest';
import {
  findMaterialIntent,
  formatMaterialLabel,
  materialPayloadFromGeminiAction,
  toMaterialPayload,
} from './materialIntents';

describe('materialIntents', () => {
  it('finds a material intent from free-form text', () => {
    const match = findMaterialIntent('make this walnut');
    expect(match).toBeTruthy();
    expect(match.type).toBe('wood');
    expect(match.label).toContain('walnut');
  });

  it('converts matched intents into workspace material payloads', () => {
    expect(toMaterialPayload({ type: 'wood', id: 'oak', label: 'oak' })).toEqual({
      type: 'wood',
      id: 'oak',
    });
    expect(
      toMaterialPayload({ type: 'color', hex: '#ffffff', label: 'white' }),
    ).toEqual({ type: 'color', hex: '#ffffff' });
  });

  it('formats display labels in title case', () => {
    expect(formatMaterialLabel('bright white')).toBe('Bright White');
  });

  it('builds material payloads from Gemini action shapes', () => {
    expect(materialPayloadFromGeminiAction({ materialType: 'color', value: '#123456' })).toEqual({
      type: 'color',
      hex: '#123456',
    });
    expect(materialPayloadFromGeminiAction({ materialType: 'wood', value: 'maple' })).toEqual({
      type: 'wood',
      id: 'maple',
    });
  });
});
