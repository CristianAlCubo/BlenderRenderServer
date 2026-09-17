import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { Sidebar } from "@/components/layout/sidebar";
import { ConnectionStatus } from "@/components/layout/connection-status";
import { useRealtime } from "@/hooks/use-realtime";
import { DashboardPage } from "@/pages/dashboard";
import { QueuePage } from "@/pages/queue";
import { CompletedPage } from "@/pages/completed";
import { WorkersPage } from "@/pages/workers";
import { SystemPage } from "@/pages/system";
import { UploadPage } from "@/pages/upload";
import { JobDetailPage } from "@/pages/job-detail";

function Layout() {
  useRealtime();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-surface-sunken px-6">
          <div className="text-sm font-medium">Blender Render Server</div>
          <div className="flex items-center gap-3">
            <ConnectionStatus />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/completed" element={<CompletedPage />} />
        <Route path="/workers" element={<WorkersPage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
