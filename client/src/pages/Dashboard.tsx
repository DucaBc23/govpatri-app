import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, DollarSign, AlertTriangle, TrendingUp, CheckCircle, XCircle, Clock } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

function KpiCard({ title, value, sub, icon, color }: { title: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function IspGauge({ isp }: { isp: number }) {
  const color = isp >= 80 ? "#22c55e" : isp >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="oklch(0.88 0.02 240)" strokeWidth="12" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${(isp / 100) * 251.2} 251.2`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{isp}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-medium mt-2">
        {isp >= 80 ? "Excelente" : isp >= 60 ? "Regular" : "Crítico"}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { data: kpis } = trpc.dashboard.kpis.useQuery();
  const { data: isp } = trpc.dashboard.isp.useQuery({ ugId: 1 });
  const { data: alertas } = trpc.dashboard.alertas.useQuery();

  const valorFormatado = kpis?.valorPatrimonial
    ? `R$ ${parseFloat(kpis.valorPatrimonial).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "R$ 0,00";

  const situacaoData = [
    { name: "Ativos", value: kpis?.bensAtivos ?? 0, color: "#22c55e" },
    { name: "Baixados", value: kpis?.bensBaixados ?? 0, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Patrimonial</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão consolidada do patrimônio público</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Bens Móveis Ativos" value={kpis?.totalBensMoveis ?? 0} icon={<Package size={20} className="text-white" />} color="bg-primary" />
        <KpiCard title="Bens Imóveis" value={kpis?.totalBensImoveis ?? 0} icon={<MapPin size={20} className="text-white" />} color="bg-emerald-600" />
        <KpiCard title="Valor Patrimonial" value={valorFormatado} sub="bens móveis ativos" icon={<DollarSign size={20} className="text-white" />} color="bg-violet-600" />
        <KpiCard title="Cessões Vigentes" value={kpis?.cessoesPendentes ?? 0} icon={<TrendingUp size={20} className="text-white" />} color="bg-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ISP */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ISP — Índice de Saúde Patrimonial</CardTitle>
          </CardHeader>
          <CardContent>
            <IspGauge isp={isp?.isp ?? 0} />
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-lg font-bold">{isp?.detalhes?.completude ?? 0}%</div>
                <div className="text-xs text-muted-foreground">Completude</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-lg font-bold">{isp?.detalhes?.regularidade ?? 0}%</div>
                <div className="text-xs text-muted-foreground">Regularidade</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Composição */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Composição dos Bens Móveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={situacaoData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {situacaoData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Alertas de Auditoria Preventiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!alertas?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle size={32} className="text-emerald-500 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum alerta ativo</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alertas.map((a, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${a.severidade === "alta" ? "bg-red-50 text-red-800" : a.severidade === "media" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{a.mensagem}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
