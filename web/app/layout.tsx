import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hexagon QR Generator | Free Online QR Code Maker",
  description:
    "Generate high-definition QR codes with a unique hexagon design. Free online tool to create scannable QR codes for URLs, websites, and links. No signup required.",
  keywords: [
    "QR code generator",
    "hexagon QR code",
    "free QR code maker",
    "online QR generator",
    "custom QR code",
    "high resolution QR code",
    "QR code creator",
  ],
  authors: [{ name: "Damian Barabonkov", url: "https://damianb.com" }],
  creator: "Damian Barabonkov",
  openGraph: {
    title: "Hexagon QR Generator | Free Online QR Code Maker",
    description:
      "Generate high-definition QR codes with a unique hexagon design. Free, fast, and no signup required.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hexagon QR Generator",
    description:
      "Generate high-definition QR codes with a unique hexagon design. Free online tool.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
