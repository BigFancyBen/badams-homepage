import type { Metadata } from "next";
import { JsonLd } from "../components/JsonLd";
import { articleJsonLd, pageMetadata } from "../site";
import { ScrandlePlan } from "./components/ScrandlePlan";

export const metadata: Metadata = pageMetadata("/scrandle", { type: "article" });

export default function ScrandlePage() {
  return (
    <>
      <JsonLd data={articleJsonLd("/scrandle")} />
      <ScrandlePlan />
    </>
  );
}
