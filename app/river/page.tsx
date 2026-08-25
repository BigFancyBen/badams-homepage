import { PutIn } from "./components/PutIn";

/**
 * `/river` on its own: the same page without a trip code. It is also the value
 * of the Deep Link URL field on the Discord application, since Discord builds
 * `/river/_discord/join?secret=...` off it.
 */
export default function RiverPage() {
  return <PutIn />;
}
