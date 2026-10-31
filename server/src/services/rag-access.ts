import type { FilterQuery } from 'mongoose';
import { Team } from '../models/Team';
import type { IKnowledgeDocument } from '../models/KnowledgeDocument';

/**
 * RAG does not deduct credits or verify purchase entitlements. Never expose
 * documents requiring payment, a higher plan, or preview truncation here,
 * even when the caller can see the document in an owner's/team's list.
 */
const freeFullText: FilterQuery<IKnowledgeDocument> = {
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
  const scope: FilterQuery<IKnowledgeDocument> = userId
    ? {
        $or: [
          { isPublic: true },
          { author: userId },
          ...(teamIds.length ? [{ teamId: { $in: teamIds } }] : []),
        ],
      }
    : { isPublic: true };
  return { $and: [scope, freeFullText] };
}

/** Resolve team membership on the server. Never trust team IDs from the request body. */
export async function resolveRagAccessFilter(userId?: string): Promise<FilterQuery<IKnowledgeDocument>> {
  if (!userId) return buildRagAccessFilter();
  const teams = await Team.find({
    $or: [{ ownerId: userId }, { 'members.userId': userId }],
  }).select('_id').lean();
  return buildRagAccessFilter(userId, teams.map((team) => String(team._id)));
}
