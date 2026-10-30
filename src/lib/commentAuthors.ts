import { normalizeMemberName, type AssigneeMember } from "./assignees";

type CommentMember = Pick<AssigneeMember, "userId" | "fullName">;
type StoredName = { fullName?: string | null; accountName?: string | null };
export type CommentViewer = { id: string; profile: StoredName | null };

function storedName(profile: StoredName | null) {
  // Select the source exactly as members.list does, then apply M1 normalization.
  const custom = profile?.fullName?.trim();
  return normalizeMemberName((custom && custom !== "Người dùng" ? custom : "") || profile?.accountName);
}

/**
 * Only names from the permitted current roster enter the directory.
 * members.list may use JWT names for the caller when their stored profile is absent.
 * For that member, use profiles.me's stored names (not its clerk.name) so both
 * the author and another viewer receive the same missing-profile fallback.
 */
export function buildCommentAuthorNames(
  members: readonly CommentMember[] | undefined,
  viewer: CommentViewer | undefined,
): ReadonlyMap<string, string> | undefined {
  if (members === undefined || viewer === undefined) return undefined;
  const names = new Map<string, string>();
  for (const member of members) {
    const name = member.userId === viewer.id ? storedName(viewer.profile) : normalizeMemberName(member.fullName);
    if (name) names.set(member.userId, name);
  }
  return names;
}

/** IDs are lookup keys only. Unknown names never use ID fragments, email or roster positions. */
export function getCommentAuthorName(authorId: string | null | undefined, names: ReadonlyMap<string, string> | undefined): string {
  if (!authorId) return "Thành viên";
  if (names === undefined) return "Đang tải tên thành viên…";
  return names.get(authorId) || "Thành viên";
}
