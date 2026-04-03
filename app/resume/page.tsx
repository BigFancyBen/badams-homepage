import type { Metadata } from "next";
import { ResumeView } from "../components/homepage/ResumeView";

export const metadata: Metadata = {
  title: "Technologies | benadams.dev",
  description: "Tools and frameworks I work with",
  openGraph: {
    title: "Technologies | benadams.dev",
    description: "Tools and frameworks I work with",
    type: "website",
    siteName: "benadams.dev",
  },
};

export default function ResumePage() {
  return <ResumeView />;
}
