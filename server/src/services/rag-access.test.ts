import { buildRagAccessFilter } from './rag-access';

describe('RAG knowledge access filter (fail-closed)', () => {
  const publicClause = {
    isPublic: true,
    requiredPlan: { $in: [null, 'free'] },
    $and: [
      { $or: [{ creditsCost: { $exists: false } }, { creditsCost: { $lte: 0 } }] },
      { $or: [{ price: { $exists: false } }, { price: { $lte: 0 } }] },
      { $or: [{ freePreviewPages: { $exists: false } }, { freePreviewPages: { $lte: 0 } }] },
    ],
  };

  it('only exposes free, full-text public knowledge to anonymous callers', () => {
    expect(buildRagAccessFilter()).toEqual(publicClause);
  });

  it('adds owned documents but never an unrestricted team predicate', () => {
    expect(buildRagAccessFilter('user-a')).toEqual({
      $or: [publicClause, { author: 'user-a' }],
    });
  });

  it('limits team documents to explicitly resolved memberships', () => {
    expect(buildRagAccessFilter('user-a', ['team-a', 'team-b'])).toEqual({
      $or: [
        publicClause,
        { author: 'user-a' },
        { teamId: { $in: ['team-a', 'team-b'] } },
      ],
    });
  });
});
