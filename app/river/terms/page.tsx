import { LegalPage, legalMetadata } from "../legal/LegalPage";

/** The URL for the application's Terms of Service field. Unlinked, noindexed. */
export const metadata = legalMetadata("Terms of use");

export default function TermsPage() {
  return <LegalPage doc="terms" />;
}
