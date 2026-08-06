import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import GovLayout from "./components/GovLayout";
import Dashboard from "./pages/Dashboard";
import Orgaos from "./pages/Orgaos";
import UnidadesGestoras from "./pages/UnidadesGestoras";
import UnidadesAdministrativas from "./pages/UnidadesAdministrativas";
import Usuarios from "./pages/Usuarios";
import BensMoveis from "./pages/BensMoveis";
import Almoxarifado from "./pages/Almoxarifado";
import BensImoveis from "./pages/BensImoveis";
import Contabil from "./pages/Contabil";
import Workflow from "./pages/Workflow";
import Relatorios from "./pages/Relatorios";
import AuditTrail from "./pages/AuditTrail";
import Inventario from "./pages/Inventario";
import DetalhesBem from "./pages/DetalhesBem";

function AppRoutes() {
  return (
    <GovLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/orgaos" component={Orgaos} />
        <Route path="/unidades-gestoras" component={UnidadesGestoras} />
        <Route path="/unidades-administrativas" component={UnidadesAdministrativas} />
        <Route path="/usuarios" component={Usuarios} />
        <Route path="/bens-moveis" component={BensMoveis} />
        <Route path="/almoxarifado" component={Almoxarifado} />
        <Route path="/bens-imoveis" component={BensImoveis} />
        <Route path="/contabil" component={Contabil} />
        <Route path="/workflow" component={Workflow} />
        <Route path="/relatorios" component={Relatorios} />
        <Route path="/auditoria" component={AuditTrail} />
        <Route path="/inventario" component={Inventario} />
        <Route path="/bens-moveis/:id" component={DetalhesBem} />
        <Route component={NotFound} />
      </Switch>
    </GovLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
