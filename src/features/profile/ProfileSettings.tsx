import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import "./profile.css";
import { useAction, useFeedback } from "../../components/Feedback";
import { useDraftGuard } from "../../components/NavigationExperience";
import { useAuth } from "@clerk/react";
import { ContactRound, GraduationCap, Save, Text, Upload, UserRound } from "lucide-react";
import PagePhoto from "../../components/PagePhoto";

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
  const [baseline, setBaseline] = useState<string | null>(null);
  const snapshot = JSON.stringify({ fullName, bio, phone, studentId, department, className });
  const dirty = baseline !== null && snapshot !== baseline;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  useDraftGuard(dirty, pending !== null);

  useEffect(() => {
    if (!data || dirtyRef.current) return;
    setBaseline(JSON.stringify({ fullName: data.profile?.fullName ?? data.clerk.name ?? "", bio: data.profile?.bio ?? "", phone: data.profile?.phone ?? "", studentId: data.profile?.studentId ?? "", department: data.profile?.department ?? "", className: data.profile?.className ?? "" }));
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
    const submitted = snapshot;
    if (await run(() => upsert({
      fullName, bio: bio || undefined, phone: phone || undefined,
      studentId: studentId || undefined, department: department || undefined,
      className: className || undefined,
    }), "Profile updated.", "Could not update your profile.", "save")) setBaseline(submitted);
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file || pending) return;
    await run(async () => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Choose a JPG, PNG, or WebP image.");
      }
      if (file.size === 0 || file.size > 2 * 1024 * 1024) {
        throw new Error("The image must be between 1 byte and 2 MB.");
      }
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();
      if (!convexUrl || !/^https:\/\/[^/]+\.convex\.cloud\/?$/.test(convexUrl)) {
        throw new Error("A valid data connection could not be found.");
      }
      const siteUrl = convexUrl.replace(/\/$/, "").replace(/\.convex\.cloud$/, ".convex.site");
      const response = await fetch(`${siteUrl}/upload-avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        throw new Error(await response.text() || `Photo upload failed: HTTP ${response.status}`);
      }
    }, "Profile photo updated.", "Could not upload your profile photo.", "upload");
    input.value = "";
  }

  async function handleRemoveAvatar() {
    if (pending || !await confirm({ title: "Remove profile photo?", description: "Your current photo will be removed. You can upload another one later." })) return;
    await run(() => removeAvatar(), "Profile photo removed.", "Could not remove your profile photo.", "remove");
  }

  if (!data) {
    return <div className="profile-page"><div className="profile-card" role="status">Loading your profile...</div></div>;
  }

  const avatarUrl = data.profile?.avatarUrl;

  return (
    <div className="profile-page">
      <div className="profile-header photo-heading"><PagePhoto scene="desk"/>
        <div>
          <p className="profile-overline">ACCOUNT SETTINGS</p>
          <h1>Profile</h1>
        </div>
      </div>

      <div className="profile-grid">
        <section className="profile-card profile-side">
          <div className="profile-avatar-wrap">
            {avatarUrl ? (
              <img className="profile-avatar" src={avatarUrl} alt="Profile photo" />
            ) : (
              <div className="profile-avatar profile-avatar-fallback">
                {fullName?.slice(0, 1).toUpperCase() || "U"}
              </div>
            )}
          </div>

          <h2>{fullName || "User"}</h2>
          <p className="profile-email">{data.clerk.email || "No email address"}</p>

          <div className="profile-actions">
            <button type="button" className="ui-button ui-primary" disabled={pending!==null} aria-busy={pending==="upload"} onClick={() => avatarInput.current?.click()}>
              <Upload size={16}/>
              {pending==="upload" ? "Uploading..." : "Upload photo"}
            </button>
            <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={pending!==null} hidden onChange={handleAvatarChange} />
            <button type="button" className="ui-button ui-danger" disabled={pending!==null || !avatarUrl} aria-busy={pending==="remove"} onClick={() => void handleRemoveAvatar()}>
              {pending==="remove" ? "Deleting..." : "Remove photo"}
            </button>
          </div>
        </section>

        <section className="profile-card">
          <form className="profile-form ui-form" onSubmit={(e) => void handleSubmit(e)}>
            <fieldset className="profile-fields" disabled={pending!==null}>
            <div className="profile-section-title">
              <h2><UserRound size={20}/>Personal details</h2>
              <p>Help your teammates put a face to the name.</p>
            </div>

            <div className="profile-field-group"><h3><ContactRound size={17}/>Identity & contact</h3>
            <div className="profile-form-grid">
              <label>
                Full name
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
              </label>

              <label>
                Phone number
                <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
              </label>

            </div></div>
            <div className="profile-field-group"><h3><GraduationCap size={17}/>Academic details</h3>
            <div className="profile-form-grid">
              <label>
                Student ID
                <input value={studentId} onChange={(e) => setStudentId(e.target.value)} maxLength={30} />
              </label>

              <label>
                Department
                <input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100} />
              </label>

              <label>
                Class
                <input value={className} onChange={(e) => setClassName(e.target.value)} maxLength={50} />
              </label>
            </div></div>

            <div className="profile-field-group"><h3><Text size={17}/>A little about you</h3><label>
              About you
              <textarea
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                placeholder="Tell your teammates a little about yourself, your interests, or what you are working on..."
              />
            </label></div>


            <div className="profile-submit">
              <button className="ui-button ui-primary" aria-busy={pending==="save"} type="submit" disabled={pending!==null}>
                <Save size={16}/>
                {pending==="save" ? "Saving..." : "Save changes"}
              </button>
            </div>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  );
}
