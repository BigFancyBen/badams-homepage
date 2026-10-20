import type { Metadata } from "next";
import { ResumeView } from "../components/homepage/ResumeView";
import { pageMetadata } from "../site";

export const metadata: Metadata = pageMetadata("/resume");

export default function ResumePage() {
  return <ResumeView />;
}
