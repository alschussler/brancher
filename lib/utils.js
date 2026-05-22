"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeVersion = sanitizeVersion;
exports.buildNewBranchName = buildNewBranchName;
/**
 * Strips all non-digit characters from a branch name to produce a compact
 * numeric suffix. e.g. "5.04.194.42" → "50419442", "release/5.04" → "504"
 */
function sanitizeVersion(branch) {
    const digits = branch.replace(/\D/g, '');
    if (!digits) {
        throw new Error(`Branch "${branch}" contains no digits and cannot be used as a version suffix. ` +
            `Branches should contain version numbers (e.g. "5.04.194.42", "release/5.04").`);
    }
    return digits;
}
/**
 * Builds the new branch name: <headBranch>-<sanitizedVersion>
 * e.g. "fix-issue-123" + "5.04.194.42" → "fix-issue-123-50419442"
 */
function buildNewBranchName(headBranch, targetBranch) {
    return `${headBranch}-${sanitizeVersion(targetBranch)}`;
}
//# sourceMappingURL=utils.js.map