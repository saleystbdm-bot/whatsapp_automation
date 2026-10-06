import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { EodPage } from './pages/EodPage';
import { GroupsPage } from './pages/GroupsPage';
import { IssuesPage } from './pages/IssuesPage';
import { SlaPage } from './pages/SlaPage';

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/sla" element={<SlaPage />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/eod" element={<EodPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
