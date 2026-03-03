import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MTG Token Helper',
  description: 'Import a deck, discover tokens it produces, and track them on the battlefield.',
};

export default function TokenHelperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
