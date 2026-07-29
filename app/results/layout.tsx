import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lingala Review Results — Private dashboard",
  description:
    "Private native-speaker review results for the held-out Lingala TTS evaluation.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ResultsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
