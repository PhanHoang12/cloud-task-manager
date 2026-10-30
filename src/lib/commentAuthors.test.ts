import { describe, expect, it } from "vitest";
import { buildCommentAuthorNames, getCommentAuthorName } from "./commentAuthors";
const author = "user_PRIVATE_Masn";
const other = "user_other_PRIVATE";
const profile = { fullName: "Nguyễn Hoàng", accountName: "Tên tài khoản cũ" };
const members = [{ userId: author, fullName: profile.fullName }, { userId: other, fullName: "Trần An" }];
const forAuthor = (value: typeof profile | null = profile) => buildCommentAuthorNames(members, { id: author, profile: value });
const forOther = () => buildCommentAuthorNames(members, { id: other, profile: { fullName: "Trần An" } });

describe("Comment author names", () => {
  it("uses the same stored profile display name for the author and another viewer", () => {
    expect(getCommentAuthorName(author, forAuthor())).toBe("Nguyễn Hoàng");
    expect(getCommentAuthorName(author, forOther())).toBe("Nguyễn Hoàng");
  });
  it("prefers the current custom name to the stored account name for self", () => {
    expect(forAuthor()?.get(author)).toBe(profile.fullName);
  });
  it("uses a stored account name when the custom name is a default placeholder", () => {
    const roster = [{ userId: author, fullName: "Hoàng tài khoản" }];
    const self = buildCommentAuthorNames(roster, { id: author, profile: { fullName: "Người dùng", accountName: "Hoàng tài khoản" } });
    const another = buildCommentAuthorNames(roster, { id: other, profile: null });
    expect(getCommentAuthorName(author, self)).toBe("Hoàng tài khoản");
    expect(getCommentAuthorName(author, another)).toBe("Hoàng tài khoản");
  });
  it("does not accept the member query's caller-only JWT fallback for a missing profile", () => {
    const selfRoster = [{ userId: author, fullName: "Hoàng từ JWT" }];
    const otherRoster = [{ userId: author, fullName: null }];
    const self = buildCommentAuthorNames(selfRoster, { id: author, profile: null });
    const another = buildCommentAuthorNames(otherRoster, { id: other, profile: null });
    expect(getCommentAuthorName(author, self)).toBe("Thành viên");
    expect(getCommentAuthorName(author, another)).toBe("Thành viên");
  });
  it("keeps unnamed profiles neutral even if Clerk has a caller-only name", () => {
    const self = buildCommentAuthorNames([{ userId: author, fullName: "Hoàng từ JWT" }], { id: author, profile: { fullName: "Người dùng" } });
    expect(getCommentAuthorName(author, self)).toBe("Thành viên");
  });
  it("waits for both permitted roster and viewer profile provenance before displaying names", () => {
    expect(getCommentAuthorName(author, buildCommentAuthorNames(undefined, { id: author, profile }))).toBe("Đang tải tên thành viên…");
    expect(getCommentAuthorName(author, buildCommentAuthorNames(members, undefined))).toBe("Đang tải tên thành viên…");
  });
  it("handles blank names without returning identifiers or email", () => {
    const names = buildCommentAuthorNames([{ userId: author, fullName: "  " }], { id: other, profile: null });
    expect(getCommentAuthorName(author, names)).toBe("Thành viên");
    expect(getCommentAuthorName(null, names)).toBe("Thành viên");
    expect(getCommentAuthorName(undefined, names)).toBe("Thành viên");
  });
  it("does not resurrect a removed member from the viewer's own profile", () => {
    const names = buildCommentAuthorNames([], { id: author, profile });
    expect(getCommentAuthorName(author, names)).toBe("Thành viên");
  });
  it("keeps members outside the capped roster and unknown IDs neutral", () => {
    expect(getCommentAuthorName("unknown_PRIVATE", forOther())).toBe("Thành viên");
    expect(getCommentAuthorName(author, new Map())).not.toContain("Masn");
  });
  it("reflects name changes without changing IDs or mutating its inputs", () => {
    const before = Object.freeze([{ userId: author, fullName: "Tên cũ" }]);
    const after = [{ userId: author, fullName: "Tên mới" }];
    const oldNames = buildCommentAuthorNames(before, { id: other, profile: null });
    const newNames = buildCommentAuthorNames(after, { id: other, profile: null });
    expect(getCommentAuthorName(author, oldNames)).toBe("Tên cũ");
    expect(getCommentAuthorName(author, newNames)).toBe("Tên mới");
    expect([...newNames!.keys()]).toEqual([author]);
    expect(before[0].fullName).toBe("Tên cũ");
  });
  it("reuses Vietnamese whitespace and Unicode normalization from M1", () => {
    const value = "  Nguyễn   Hoàng  ".normalize("NFD");
    const self = buildCommentAuthorNames([{ userId: author, fullName: value }], { id: author, profile: { fullName: value } });
    expect(getCommentAuthorName(author, self)).toBe("Nguyễn Hoàng");
  });
  it("selects stored names in the same order as the permitted member projection before normalization", () => {
    const custom = "Người  dùng";
    const roster = [{ userId: author, fullName: custom }];
    const self = buildCommentAuthorNames(roster, { id: author, profile: { fullName: custom, accountName: "Tên tài khoản" } });
    const another = buildCommentAuthorNames(roster, { id: other, profile: null });
    expect(getCommentAuthorName(author, self)).toBe(getCommentAuthorName(author, another));
  });
  it("does not add viewer labels, roster positions or emails to matching names", () => {
    const roster = [{ userId: author, fullName: "Hoàng", email: "private@example.invalid" }, { userId: other, fullName: "Hoàng" }];
    const names = buildCommentAuthorNames(roster, { id: other, profile: { fullName: "Hoàng" } });
    expect(getCommentAuthorName(author, names)).toBe("Hoàng");
    expect(getCommentAuthorName(other, names)).toBe("Hoàng");
  });
});
