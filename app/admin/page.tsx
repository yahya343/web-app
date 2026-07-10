'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import AdminAuthGate from '@/components/admin/AdminAuthGate';
import Sidebar from '@/components/admin/Sidebar';
import Header from '@/components/admin/Header';
import { useOmaghAdmin } from '@/contexts/OmaghAdminContext';
import DashboardView from '@/components/admin/DashboardView';
import ProductsView from '@/components/admin/ProductsView';
import BookingsView from '@/components/admin/BookingsView';
import ReviewsView from '@/components/admin/ReviewsView';
import EmployeesView from '@/components/admin/EmployeesView';
import LiveChatView from '@/components/admin/LiveChatView';
import SettingsView from '@/components/admin/SettingsView';
import { SessionProvider } from 'next-auth/react';

function AdminPageInner() {
  const { data: session, status } = useSession();
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState<{ name: string; role: string } | null>(null);
  const { products, employees, bookings, reviews, chatSessions, settings, loading, newSessionCount, ackNewSessions } = useOmaghAdmin();

  const unreadChatCount = chatSessions
    .filter((s) => s.status === 'active' && s.unreadAdmin > 0)
    .length;

  // Handle NextAuth session state
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated' && session?.user) {
      setAdminUser({
        name: session.user.name || 'Admin',
        role: (session.user as any).role || 'Admin',
      });
      setAuthenticated(true);
    } else {
      setAdminUser(null);
      setAuthenticated(false);
    }
    setAuthChecked(true);
  }, [status, session]);

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'products': return 'Products & Inventory';
      case 'bookings': return 'Bookings & Repairs';
      case 'reviews': return 'Customer Reviews';
      case 'employees': return 'Employees & Permissions';
      case 'chat': return 'Live Chat Support';
      case 'settings': return 'System Settings';
      default: return 'OMAGH ADMIN';
    }
  };

  // ── Update browser tab title with unread count ──
  useEffect(() => {
    const base = 'OMAGH ADMIN';
    const unreadLabel = getTabTitle();
    if (unreadChatCount > 0) {
      document.title = `(${unreadChatCount}) ${unreadLabel} — ${base}`;
    } else {
      document.title = `${unreadLabel} — ${base}`;
    }
  }, [unreadChatCount, currentTab]);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    setAuthenticated(false);
    setAdminUser(null);
  };

  // Show loading while checking auth state
  if (!authChecked || loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">
            {loading ? 'Loading Admin Panel...' : 'Verifying authentication...'}
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AdminAuthGate
        onAuthenticated={(user) => {
          setAdminUser(user);
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] text-gray-200 font-sans flex overflow-hidden">
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
        />
      )}

      <div className={`md:block ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => { setCurrentTab(tab); setMobileMenuOpen(false); }}
          adminName={adminUser?.name || settings?.profileName || 'Admin'}
          adminTitle={adminUser?.role || settings?.profileTitle || 'System Admin'}
          onLogout={handleLogout}
          chatUnread={unreadChatCount}
        />
      </div>

      <div className="flex-1 flex flex-col md:ml-64 relative w-full h-screen overflow-hidden">
        <Header
          title={getTabTitle()}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          onSearchChange={setGlobalSearch}
          searchValue={globalSearch}
          onTabChange={setCurrentTab}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto px-4 md:px-6 pt-20 pb-8 h-full">
          {currentTab === 'dashboard' && (
            <DashboardView
              products={products}
              employees={employees}
              bookings={bookings}
              reviews={reviews}
              settings={settings}
              onTabChange={setCurrentTab}
            />
          )}
          {currentTab === 'products' && <ProductsView products={products} />}
          {currentTab === 'bookings' && <BookingsView bookings={bookings} />}
          {currentTab === 'reviews' && <ReviewsView reviews={reviews} />}
          {currentTab === 'employees' && <EmployeesView employees={employees} />}
          {currentTab === 'chat' && (
            <LiveChatView
              chatSessions={chatSessions}
              onNewSessionAck={ackNewSessions}
            />
          )}
          {currentTab === 'settings' && <SettingsView settings={settings} />}
        </main>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <SessionProvider>
      <AdminPageInner />
    </SessionProvider>
  );
}
