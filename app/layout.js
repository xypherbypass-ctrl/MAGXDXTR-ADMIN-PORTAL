import "./globals.css";
import { Chakra_Petch, Inter, JetBrains_Mono } from "next/font/google";

const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "MAGXDXTR ADMIN PORTAL",
  description:
    "Cursed-energy DLL deployment terminal. Upload, hash and push Client.dll updates straight to GitHub for the auto-update loader.",
  icons: { icon: "./icon.ico" },
};

export const viewport = {
  themeColor: "#06060a",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}