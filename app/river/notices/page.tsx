import { LegalPage, legalMetadata } from "../legal/LegalPage";

/**
 * The attribution the licences require. The terms link to it, so it needs a URL
 * of its own even though nothing else points here.
 */
export const metadata = legalMetadata("Third-party notices");

export default function NoticesPage() {
  return <LegalPage doc="notices" />;
}
