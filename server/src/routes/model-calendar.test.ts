import { SEED_MODEL_EVENTS } from './model-calendar';

describe('model calendar seed data', () => {
  it('contains curated model-release events with valid fields', () => {
    expect(SEED_MODEL_EVENTS.length).toBeGreaterThan(0);
    for (const e of SEED_MODEL_EVENTS) {
      expect(e.modelName).toBeTruthy();
      expect(e.vendor).toBeTruthy();
      expect(e.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['release', 'update', 'deprecation']).toContain(e.type);
      expect(e.source).toBe('seed');
    }
  });

  it('covers multiple vendors', () => {
    const vendors = new Set(SEED_MODEL_EVENTS.map((e) => e.vendor));
    expect(vendors.size).toBeGreaterThan(1);
  });
});
