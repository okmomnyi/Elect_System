import StudentSidebar from '@/components/layout/StudentSidebar';

export const metadata = { title: 'Dashboard — Academic Vote' };

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface">
      <StudentSidebar />
      {/* offset main content by sidebar width */}
      <div className="md:ml-64">
        {children}
      </div>
    </div>
  );
}
