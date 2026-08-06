import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Building2, Users, Package, Warehouse,
  MapPin, BookOpen, GitBranch, FileBarChart, Shield,
  ChevronDown, ChevronRight, Menu, X, LogOut, LogIn,
  Building, Layers, ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  badge?: string;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={18} /> },
  {
    label: "Módulo Transversal", icon: <Layers size={18} />,
    children: [
      { label: "Órgãos", href: "/orgaos" },
      { label: "Unidades Gestoras", href: "/unidades-gestoras" },
      { label: "Unidades Administrativas", href: "/unidades-administrativas" },
    ],
  },
  { label: "Usuários", href: "/usuarios", icon: <Users size={18} /> },
  { label: "Bens Móveis", href: "/bens-moveis", icon: <Package size={18} /> },
  { label: "Almoxarifado", href: "/almoxarifado", icon: <Warehouse size={18} /> },
  { label: "Bens Imóveis", href: "/bens-imoveis", icon: <MapPin size={18} /> },
  { label: "Camada Contábil", href: "/contabil", icon: <BookOpen size={18} /> },
  { label: "Workflow", href: "/workflow", icon: <GitBranch size={18} /> },
  { label: "Relatórios SEPAT", href: "/relatorios", icon: <FileBarChart size={18} /> },
  { label: "Trilha de Auditoria", href: "/auditoria", icon: <Shield size={18} /> },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const isActive = item.href ? location === item.href || location.startsWith(item.href + "/") : false;
  const hasChildren = !!item.children?.length;

  if (hasChildren) {
    const anyChildActive = item.children?.some(c => location === c.href);
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
            anyChildActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          <span className="shrink-0">{item.icon}</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </>
          )}
        </button>
        {!collapsed && open && (
          <div className="ml-9 mt-1 space-y-0.5">
            {item.children?.map(child => (
              <Link key={child.href} href={child.href}>
                <span className={cn(
                  "block px-3 py-2 rounded-md text-xs transition-colors cursor-pointer",
                  location === child.href ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}>
                  {child.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={item.href!}>
      <span className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer",
        isActive ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}>
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <span className="flex-1">{item.label}</span>}
        {!collapsed && item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
      </span>
    </Link>
  );
}

export default function GovLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Carregando GOVPatri...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-sm w-full px-6">
          <div className="space-y-2">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto">
              <Building2 size={32} className="text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">GOVPatri</h1>
            <p className="text-muted-foreground text-sm">Plataforma Inteligente de Gestão Patrimonial Pública</p>
          </div>
          <Button className="w-full" size="lg" onClick={() => startLogin()}>
            <LogIn size={18} className="mr-2" />
            Entrar no Sistema
          </Button>
          <p className="text-xs text-muted-foreground">Acesso restrito a servidores autorizados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar Desktop */}
      <aside className={cn(
        "hidden md:flex flex-col bg-sidebar transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-sidebar-border", collapsed && "justify-center px-2")}>
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sidebar-foreground font-bold text-base leading-tight">GOVPatri</div>
              <div className="text-sidebar-foreground/50 text-xs">Gestão Patrimonial</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
          {navItems.map((item, i) => (
            <NavLink key={i} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sidebar-foreground text-xs font-medium truncate">{user?.name ?? "Usuário"}</div>
                <div className="text-sidebar-foreground/50 text-xs truncate">{user?.email ?? ""}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={logout}>
                <LogOut size={14} />
              </Button>
            </div>
          )}
          <Button
            variant="ghost" size="sm"
            className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setCollapsed(v => !v)}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span className="ml-2 text-xs">Recolher</span></>}
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar flex flex-col z-50">
            <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
                  <Building2 size={18} className="text-sidebar-primary-foreground" />
                </div>
                <div className="text-sidebar-foreground font-bold">GOVPatri</div>
              </div>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground" onClick={() => setMobileOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
              {navItems.map((item, i) => (
                <NavLink key={i} item={item} collapsed={false} />
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
              {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <span className="text-sm text-foreground hidden sm:block">{user?.name}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

