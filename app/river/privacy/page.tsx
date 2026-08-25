import { LegalPage, legalMetadata } from "../legal/LegalPage";

/** The URL for the application's Privacy Policy field. Unlinked, noindexed. */
export const metadata = legalMetadata("Privacy policy");

export default function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}
