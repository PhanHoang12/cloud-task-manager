import desk from "../assets/photography/sunlit-desk.webp";
import studio from "../assets/photography/studio-window.webp";

/** Decorative photography only. Content and controls remain independent of the image. */
export default function PagePhoto({ scene = "studio", src }: { scene?: "desk" | "studio"; src?: string }) {
  const fallback = scene === "desk" ? desk : studio;
  return <div className="scene-photo" aria-hidden="true" data-ui-photo={scene}>
    <img src={src || fallback} width={scene === "desk" ? 1600 : 1400}
      height={scene === "desk" ? 640 : 700} alt="" decoding="async" onError={event => {
        if (event.currentTarget.getAttribute("src") !== fallback) event.currentTarget.src = fallback;
      }} />
  </div>;
}
