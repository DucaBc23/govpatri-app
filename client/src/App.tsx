import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orgaos from "./pages/Orgaos";
import UnidadesGestoras from "./pages/UnidadesGestoras";
import UnidadesAdministrativas from "./pages/UnidadesAdministrativas";
import Usuarios from "./pages/Usuarios";
import BensMoveis from "./pages/BensMoveis";
import DetalhesBem from "./pages/DetalhesBem";
import Almoxarifado from "./pages/Almoxarifado";
import BensImoveis from "./pages/BensImoveis";
import Contabil from "./pages/Contabil";
import Workflow from "./pages/Workflow";
import Relatorios from "./pages/Relatorios";
import AuditTrail from "./pages/AuditTrail";
import Inventario from "./pages/Inventario";
import GovLayout from "./components/GovLayout";
import NotFound from "./pages/NotFound";

function ProtectedRoutes() {
  const { isAuthenticated, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated && location !== "/login") {
      navigate("/login");
    }
  }, [loading, isAuthenticated, location, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d2137]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-white/60 text-sm">Carregando GOVPatri...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <GovLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/orgaos" component={Orgaos} />
        <Route path="/unidades-gestoras" component={UnidadesGestoras} />
        <Route path="/unidades-administrativas" component={UnidadesAdministrativas} />
        <Route path="/usuarios" component={Usuarios} />
        <Route path="/bens-moveis" component={BensMoveis} />
        <Route path="/bens-moveis/:id" component={DetalhesBem} />
        <Route path="/almoxarifado" component={Almoxarifado} />
        <Route path="/bens-imoveis" component={BensImoveis} />
        <Route path="/contabil" component={Contabil} />
        <Route path="/workflow" component={Workflow} />
        <Route path="/relatorios" component={Relatorios} />
        <Route path="/auditoria" component={AuditTrail} />
        <Route path="/inventario" component={Inventario} />
        <Route component={NotFound} />
      </Switch>
    </GovLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
