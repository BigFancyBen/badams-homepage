import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Idiotest",
  robots: {
    index: false,
    follow: false,
  },
};

export default function IdioTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

