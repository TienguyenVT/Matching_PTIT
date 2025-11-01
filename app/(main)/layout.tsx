'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true); // Mặc định mở trên desktop

  return (
    <div className="flex h-screen bg-gray-50 relative overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
      />
      <div 
        className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-0'
        }`}
      >
        <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

