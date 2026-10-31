import { buildRagAccessFilter } from './rag-access';

describe('RAG knowledge access filter (fail-closed)', () => {
  const freeFullText = {
    requiredPlan: { $in: [null, 'free'] },
    $and: [
      { $or: [{ creditsCost: { $exists: false } }, { creditsCost: { $lte: 0 } }] },
      { $or: [{ price: { $exists: false } }, { price: { $lte: 0 } }] },
      { $or: [{ freePreviewPages: { $exists: false } }, { freePreviewPages: { $lte: 0 } }] },
    ],
  };

  it('only exposes free, full-text public knowledge to anonymous callers', () => {
    expect(buildRagAccessFilter()).toEqual({ $and: [{ isPublic: true }, freeFullText] });
  });

  it('adds owned documents but never an unrestricted team predicate', () => {
    expect(buildRagAccessFilter('user-a')).toEqual({
      $and: [{ $or: [{ isPublic: true }, { author: 'user-a' }] }, freeFullText],
    });
  });

  it('requires free full-text entitlement for every team or owned document', () => {
    expect(buildRagAccessFilter('user-a', ['team-a', 'team-b'])).toEqual({
      $and: [{
        $or: [
          { isPublic: true },
          { author: 'user-a' },
          { teamId: { $in: ['team-a', 'team-b'] } },
        ],
      }, freeFullText],
    });
  });
});
