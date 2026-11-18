import desk from "../assets/photography/sunlit-desk.webp";
import studio from "../assets/photography/studio-window.webp";

/** Decorative photography only. Content and controls remain independent of the image. */
export default function PagePhoto({ scene = "studio" }: { scene?: "desk" | "studio" }) {
  return <div className="scene-photo" aria-hidden="true" data-ui-photo={scene}>
    <img src={scene === "desk" ? desk : studio} width={scene === "desk" ? 1600 : 1400}
      height={scene === "desk" ? 640 : 700} alt="" decoding="async" />
  </div>;
}
