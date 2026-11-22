// src/lib/duplicate-scope.js  (server only)
// Resolves what the caller may see on the duplicate-clients pages: { level, branchIds }.
//   branchIds === null  -> every branch (admin)
//   branchIds === [...] -> only these branches (may be empty = sees nothing)
import { duplicateAccess } from '@/lib/duplicate-access';
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';

export async function resolveDuplicateScope(user) {
    const level = duplicateAccess(user);
    if (!level) return { level: null, branchIds: [] };
    if (level === 'full') return { level, branchIds: null };
    const { branchIds } = await resolveLoanBranchScope(user);
    return { level, branchIds: branchIds ?? [] };
}
