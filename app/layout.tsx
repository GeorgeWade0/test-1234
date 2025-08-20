import "./globals.css";

export const metadata = {
  title: "Zevero Footprint Calculator",
  description: "Quick estimation across Scope 1, 2, and selected Scope 3 categories.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">{children}</body>
    </html>
  );
}
