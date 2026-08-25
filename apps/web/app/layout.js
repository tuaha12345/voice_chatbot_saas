import "./globals.css";

export const metadata = {
  title: "Voice Chatbot SaaS",
  description: "Embeddable voice Q&A agents",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
