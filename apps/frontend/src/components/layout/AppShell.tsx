import type { PropsWithChildren } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-main">
        <TopHeader />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
