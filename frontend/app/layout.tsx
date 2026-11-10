import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UIProvider, ProjectsListProvider } from "./context/ProjectContext";
import Sidebar from "./components/shell/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MoniSekha — Educational Video Studio",
  description: "Local AI educational video studio for Khmer e-learning, pharmacy education, and teacher training.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-theme="dark"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <UIProvider>
          <ProjectsListProvider>
            <div className="flex h-screen w-full bg-background text-foreground overflow-hidden select-none">
              <Sidebar />
              {children}
            </div>
          </ProjectsListProvider>
        </UIProvider>
      </body>
    </html>
  );
}
