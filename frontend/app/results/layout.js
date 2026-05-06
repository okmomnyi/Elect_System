import StudentSidebar from '@/components/layout/StudentSidebar';

export const metadata = { title: 'Results — Academic Vote' };

export default function ResultsLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface">
      <StudentSidebar />
      <div className="md:ml-64">{children}</div>
    </div>
  );
}
