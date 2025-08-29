import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Magic Tutor Helper',
  description: 'Browse and filter Magic: The Gathering cards with advanced search capabilities.',
};

export default function TutorHelperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
