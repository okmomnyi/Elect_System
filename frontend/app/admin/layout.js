import AdminSidebar from '@/components/layout/AdminSidebar';

export const metadata = { title: 'Election Management — Academic Vote' };

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar />
      <div className="md:ml-64">
        {children}
      </div>
    </div>
  );
}
