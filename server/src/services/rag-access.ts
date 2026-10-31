import type { FilterQuery } from 'mongoose';
import { Team } from '../models/Team';
import type { IKnowledgeDocument } from '../models/KnowledgeDocument';

/**
 * RAG only receives fully readable documents. Public documents that require
 * payment, subscription, or preview truncation are excluded until a separate
 * entitlement-aware retrieval contract is implemented.
 */
const freePublicKnowledge: FilterQuery<IKnowledgeDocument> = {
  isPublic: true,
  requiredPlan: { $in: [null, 'free'] },
  $and: [
    { $or: [{ creditsCost: { $exists: false } }, { creditsCost: { $lte: 0 } }] },
    { $or: [{ price: { $exists: false } }, { price: { $lte: 0 } }] },
    { $or: [{ freePreviewPages: { $exists: false } }, { freePreviewPages: { $lte: 0 } }] },
  ],
};

export function buildRagAccessFilter(
  userId?: string,
  teamIds: string[] = []
): FilterQuery<IKnowledgeDocument> {
  if (!userId) return freePublicKnowledge;
  return {
    $or: [
      freePublicKnowledge,
      { author: userId },
      ...(teamIds.length ? [{ teamId: { $in: teamIds } }] : []),
    ],
  };
}

/** Resolve team membership on the server. Never trust team IDs from the request body. */
export async function resolveRagAccessFilter(userId?: string): Promise<FilterQuery<IKnowledgeDocument>> {
  if (!userId) return buildRagAccessFilter();
  const teams = await Team.find({
    $or: [{ ownerId: userId }, { 'members.userId': userId }],
  }).select('_id').lean();
  return buildRagAccessFilter(userId, teams.map((team) => String(team._id)));
}
