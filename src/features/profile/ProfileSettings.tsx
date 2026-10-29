import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import "./profile.css";
import { useAction, useFeedback } from "../../components/Feedback";
import { useAuth } from "@clerk/react";

export default function ProfileSettings() {
  const avatarInput = useRef<HTMLInputElement>(null);
  const data = useQuery(api.profiles.me);
  const upsert = useMutation(api.profiles.upsert);
  const removeAvatar = useMutation(api.profiles.removeAvatar);
  const { getToken } = useAuth();
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [className, setClassName] = useState("");

  const { run, pending } = useAction();
  const { confirm } = useFeedback();

  useEffect(() => {
    setFullName(data?.profile?.fullName ?? data?.clerk.name ?? "");
    setBio(data?.profile?.bio ?? "");
    setPhone(data?.profile?.phone ?? "");
    setStudentId(data?.profile?.studentId ?? "");
    setDepartment(data?.profile?.department ?? "");
    setClassName(data?.profile?.className ?? "");
  }, [data?.profile?.fullName, data?.clerk.name, data?.profile?.bio,
    data?.profile?.phone, data?.profile?.studentId, data?.profile?.department, data?.profile?.className]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => upsert({
      fullName, bio: bio || undefined, phone: phone || undefined,
      studentId: studentId || undefined, department: department || undefined,
      className: className || undefined,
    }), "Cập nhật hồ sơ thành công.", "Không thể cập nhật hồ sơ.", "save");
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file || pending) return;
    await run(async () => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.");
      }
      if (file.size === 0 || file.size > 2 * 1024 * 1024) {
        throw new Error("Ảnh phải có dung lượng từ 1 byte đến 2 MB.");
      }
      const token = await getToken();
      if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();
      if (!convexUrl || !/^https:\/\/[^/]+\.convex\.cloud\/?$/.test(convexUrl)) {
        throw new Error("Không tìm thấy địa chỉ kết nối dữ liệu hợp lệ.");
      }
      const siteUrl = convexUrl.replace(/\/$/, "").replace(/\.convex\.cloud$/, ".convex.site");
      const response = await fetch(`${siteUrl}/upload-avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        throw new Error(await response.text() || `Tải ảnh thất bại: HTTP ${response.status}`);
      }
    }, "Cập nhật ảnh đại diện thành công.", "Không thể tải ảnh đại diện.", "upload");
    input.value = "";
  }

  async function handleRemoveAvatar() {
    if (pending || !await confirm({ title: "Xóa ảnh đại diện?", description: "Ảnh đại diện hiện tại sẽ bị xóa. Bạn có thể tải ảnh mới sau đó." })) return;
    await run(() => removeAvatar(), "Đã xóa ảnh đại diện.", "Không thể xóa ảnh đại diện.", "remove");
  }

  if (!data) {
    return <div className="profile-page"><div className="profile-card">Đang tải hồ sơ...</div></div>;
  }

  const avatarUrl = data.profile?.avatarUrl;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <p className="profile-overline">CÀI ĐẶT TÀI KHOẢN</p>
          <h1>Hồ sơ cá nhân</h1>
          <p className="profile-muted">
            Cập nhật ảnh đại diện và thông tin để các thành viên dễ nhận ra bạn.
          </p>
        </div>
      </div>

      <div className="profile-grid">
        <section className="profile-card profile-side">
          <div className="profile-avatar-wrap">
            {avatarUrl ? (
              <img className="profile-avatar" src={avatarUrl} alt="Ảnh đại diện" />
            ) : (
              <div className="profile-avatar profile-avatar-fallback">
                {fullName?.slice(0, 1).toUpperCase() || "U"}
              </div>
            )}
          </div>

          <h2>{fullName || "Người dùng"}</h2>
          <p className="profile-email">{data.clerk.email || "Chưa có địa chỉ thư điện tử"}</p>

          <div className="profile-actions">
            <button type="button" className="ui-button ui-primary" disabled={pending!==null} aria-busy={pending==="upload"} onClick={() => avatarInput.current?.click()}>
              {pending==="upload" ? "Đang tải ảnh..." : "Tải ảnh đại diện"}
            </button>
            <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={pending!==null} hidden onChange={handleAvatarChange} />
            <button type="button" className="ui-button ui-danger" disabled={pending!==null || !avatarUrl} aria-busy={pending==="remove"} onClick={() => void handleRemoveAvatar()}>
              {pending==="remove" ? "Đang xóa..." : "Xóa ảnh đại diện"}
            </button>
          </div>
        </section>

        <section className="profile-card">
          <form className="profile-form" onSubmit={(e) => void handleSubmit(e)}>
            <fieldset className="profile-fields" disabled={pending!==null}>
            <div className="profile-section-title">
              <h2>Thông tin cá nhân</h2>
              <p>Thông tin giúp các thành viên nhận diện và liên hệ với bạn.</p>
            </div>

            <div className="profile-form-grid">
              <label>
                Họ và tên
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
              </label>

              <label>
                Số điện thoại
                <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
              </label>

              <label>
                Mã sinh viên
                <input value={studentId} onChange={(e) => setStudentId(e.target.value)} maxLength={30} />
              </label>

              <label>
                Khoa / Bộ môn
                <input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100} />
              </label>

              <label>
                Lớp
                <input value={className} onChange={(e) => setClassName(e.target.value)} maxLength={50} />
              </label>
            </div>

            <label>
              Tiểu sử
              <textarea
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                placeholder="Ví dụ: Sinh viên công nghệ thông tin, quan tâm đến điện toán đám mây và phát triển ứng dụng..."
              />
            </label>


            <div className="profile-submit">
              <button className="ui-button ui-primary" aria-busy={pending==="save"} type="submit" disabled={pending!==null}>
                {pending==="save" ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  );
}