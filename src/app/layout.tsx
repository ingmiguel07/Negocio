import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control Negocio Migue | Administración financiera",
  description: "Administra tu capital, inventario, ventas y préstamos en un solo lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
