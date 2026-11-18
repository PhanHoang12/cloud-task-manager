import { useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "@clerk/react";
import { useMutation } from "convex/react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { ImageTarget } from "../../convex/illustrations";
import { useFeedback } from "./Feedback";
import { useDraftGuard } from "./NavigationExperience";
import studio from "../assets/photography/studio-window.webp";
import desk from "../assets/photography/sunlit-desk.webp";
import "./card-illustration.css";

export default function CardIllustration({ target, title, src, editable, disabled = false, projectCover = false }: {
  target: ImageTarget; title: string; src?: string; editable: boolean; disabled?: boolean; projectCover?: boolean;
}) {
  const { getToken } = useAuth();
  const remove = useMutation(api.illustrations.remove);
  const { notify, confirm } = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string>();
  useDraftGuard(false, busy);
  const fallback = projectCover ? (target.id.charCodeAt(target.id.length - 1) % 2 ? studio : desk) : undefined;
  const image = src && src !== failed ? src : fallback;
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || lock.current || disabled || !editable) return;
    lock.current = true; setBusy(true);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP image.");
      if (!file.size || file.size > 2 * 1024 * 1024) throw new Error("Choose an image under 2 MB.");
      const bitmap = await createImageBitmap(file);
      const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width * bitmap.height <= 40000000;
      bitmap.close();
      if (!valid) throw new Error("Choose an image smaller than 40 megapixels.");
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const cloud = import.meta.env.VITE_CONVEX_URL?.trim();
      if (!cloud || !/^https:\/\/[^/]+\.convex\.cloud\/?$/.test(cloud)) throw new Error("The data connection is unavailable.");
      const site = cloud.replace(/\/$/, "").replace(/\.cloud$/, ".site");
      const query = new URLSearchParams({ kind: target.kind, id: target.id });
      const response = await fetch(`${site}/upload-illustration?${query}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type }, body: file,
      });
      if (!response.ok) throw new Error(await response.text() || "Could not upload this image.");
      setFailed(undefined); notify("Illustration updated.");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not upload this image.", "error"); }
    finally { lock.current = false; setBusy(false); }
  }
  async function removeImage() {
    if (lock.current || disabled || !editable || !src) return;
    if (!await confirm({ title: "Remove illustration?", description: "Your work and its details will be kept. You can upload another image later.", confirmLabel: "Remove image" })) return;
    lock.current = true; setBusy(true);
    try { await remove({ target }); notify("Illustration removed."); }
    catch { notify("Could not remove this image. Check your access and try again.", "error"); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!image && !editable) return null;
  return <div className={`card-illustration${image ? " has-image" : " is-empty"}${projectCover ? " is-project" : ""}`} aria-busy={busy}>
    {image && <img src={image} alt={src && src !== failed ? `${title} illustration` : ""} loading="lazy" decoding="async" draggable={false}
      onError={() => { if (src) setFailed(src); }} />}
    {editable && <div className="illustration-controls" onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}>
      <button type="button" className="illustration-upload" disabled={busy || disabled}
        aria-label={`${src ? "Change" : "Add"} illustration for ${title}`} title="JPG, PNG or WebP · Up to 2 MB"
        onClick={() => input.current?.click()}>
        {busy ? <LoaderCircle size={15} aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
        <span>{busy ? "Saving…" : src ? "Change image" : "Add image"}</span>
      </button>
      {src && <button type="button" className="illustration-remove" disabled={busy || disabled}
        aria-label={`Remove illustration for ${title}`} title="Remove illustration" onClick={() => void removeImage()}><Trash2 size={15} aria-hidden="true" /></button>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Upload illustration for ${title}`} hidden disabled={busy || disabled} onChange={event => void upload(event)} />
    </div>}
    {src && failed === src && <span className="illustration-unavailable">Image unavailable</span>}
  </div>;
}
