import { Studio } from "sanity";
import sanityConfig from "../../sanity.config";

export default function SanityStudio() {
  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
      <Studio config={sanityConfig} basePath="/studio" />
    </div>
  );
}
