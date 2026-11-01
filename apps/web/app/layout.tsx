import React from 'react';

export const metadata = {
  title: 'AgentFlow OS — Enterprise Agentic AI Platform',
  description: 'Control plane, runtime, and forward deployed engineering operations for AI agents'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
