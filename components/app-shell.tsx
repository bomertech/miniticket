import type { ReactNode } from "react";

import { LogoutForm } from "@/components/logout-form";
import type { SessionUser } from "@/lib/types";

interface AppShellProps {
  user: SessionUser;
  title: string;
  subtitle: string;
  toolbarCenter?: ReactNode;
  children: ReactNode;
}

export function AppShell({ user, title, subtitle, toolbarCenter, children }: AppShellProps) {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <div className="app-header__mark">B</div>
            <span>BomerTech</span>
          </div>
          <div className="app-header__center">{toolbarCenter}</div>
          <div className="app-header__right">
            <div className="app-header__user">
              <span className="app-header__user-name">{user.name}</span>
              <span className="app-header__user-meta">
                {user.role === "ADMIN" ? "Admin" : user.companyName || user.email}
              </span>
            </div>
            <LogoutForm />
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="app-main__inner">
          <div className="page-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
