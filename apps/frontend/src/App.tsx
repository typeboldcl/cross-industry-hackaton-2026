import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  createHashRouter,
  Navigate,
  NavLink,
  Outlet,
  RouterProvider,
  useLocation,
  useParams,
} from "react-router";
import { queryClient, useAudit, useObligations } from "./api";
import { Icon } from "./components/Icon";
import { ConfirmDialog, Toaster } from "./components/Overlays";
import { TopBar } from "./components/TopBar";
import { QueryState } from "./components/ui";
import { AUDIT_STATUS } from "./domain/labels";
import { type AuditCtx, useAuditCtx } from "./hooks/useAuditCtx";
import { Centro } from "./views/Centro";
import { Inicio } from "./views/Inicio";
import { Nueva } from "./views/Nueva";
import { Panel } from "./views/Panel";
import { Preparar } from "./views/Preparar";
import { RequisitoView } from "./views/Requisito";
import { Terreno } from "./views/Terreno";

function RootLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <div className="app">
        <TopBar />
        <main className="main">
          <Outlet />
        </main>
      </div>
      <Toaster />
      <ConfirmDialog />
    </>
  );
}

const navCls = ({ isActive }: { isActive: boolean }) => (isActive ? "on" : "");

/** Dentro de una auditoría: barra de navegación y datos compartidos. */
function AuditLayout() {
  const { auditId } = useParams();
  const audit = useAudit(auditId);
  const obligations = useObligations(audit.data?.facilityId);

  // La barra solo aparece dentro de una auditoría: antes no se sabe a cuál se entra.
  useEffect(() => {
    document.body.classList.add("has-nav");
    return () => document.body.classList.remove("has-nav");
  }, []);

  if (audit.isLoading || audit.error || !audit.data) {
    return (
      <QueryState
        isLoading={audit.isLoading}
        error={
          audit.error ??
          (audit.data ? null : new Error("Auditoría no encontrada."))
        }
        retry={audit.refetch}
      />
    );
  }
  const a = audit.data;

  return (
    <>
      <nav className="nav">
        <NavLink to={`/centros/${a.facilityId}`} className={navCls} end>
          <Icon name="home" />
          <span>Auditorías</span>
        </NavLink>
        <NavLink to="terreno" className={navCls}>
          <Icon name="field" />
          <span>Terreno</span>
        </NavLink>
        <NavLink to="panel" className={navCls}>
          <Icon name="panel" />
          <span>Panel</span>
        </NavLink>
      </nav>
      <Outlet
        context={
          { audit: a, obligations: obligations.data ?? [] } satisfies AuditCtx
        }
      />
    </>
  );
}

/** /auditorias/:id abre la pantalla que corresponde al estado de la auditoría. */
function AuditIndex() {
  const { audit } = useAuditCtx();
  return <Navigate to={AUDIT_STATUS[audit.status].route} replace />;
}

const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <Inicio /> },
      { path: "centros/:centroId", element: <Centro /> },
      { path: "centros/:centroId/nueva", element: <Nueva /> },
      {
        path: "auditorias/:auditId",
        element: <AuditLayout />,
        children: [
          { index: true, element: <AuditIndex /> },
          { path: "preparar", element: <Preparar /> },
          { path: "terreno", element: <Terreno /> },
          { path: "terreno/:itemId", element: <RequisitoView /> },
          { path: "panel", element: <Panel /> },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
