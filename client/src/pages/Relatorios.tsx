import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, FileBarChart, Package, TrendingDown, Scale, Building2 } from "lucide-react";
import { toast } from "sonner";

function downloadPdf(base64: string, filename: string) {
  const a = document.createElement("a");
  a.href = `data:application/pdf;base64,${base64}`;
  a.download = filename;
  a.click();
}

export default function Relatorios() {
  const { data: ugs = [] } = trpc.transversal.ugs.list.useQuery();
  const { data: periodos = [] } = trpc.contabil.periodos.list.useQuery({ ugId: 0 });

  const [ugId, setUgId] = useState<number>(0);
  const [periodoId, setPeriodoId] = useState<number>(0);

  const movMut = trpc.relatorios.pdfMovimentacao.useMutation({
    onSuccess: d => { downloadPdf(d.pdfBase64, d.filename); toast.success("PDF gerado com sucesso"); },
    onError: e => toast.error(e.message),
  });
  const invMut = trpc.relatorios.pdfInventario.useMutation({
    onSuccess: d => { downloadPdf(d.pdfBase64, d.filename); toast.success("PDF gerado com sucesso"); },
    onError: e => toast.error(e.message),
  });
  const depMut = trpc.relatorios.pdfDepreciacao.useMutation({
    onSuccess: d => { downloadPdf(d.pdfBase64, d.filename); toast.success("PDF gerado com sucesso"); },
    onError: e => toast.error(e.message),
  });
  const concMut = trpc.relatorios.pdfConciliacao.useMutation({
    onSuccess: d => { downloadPdf(d.pdfBase64, d.filename); toast.success("PDF gerado com sucesso"); },
    onError: e => toast.error(e.message),
  });
  const cessMut = trpc.relatorios.pdfCessoes.useMutation({
    onSuccess: d => { downloadPdf(d.pdfBase64, d.filename); toast.success("PDF gerado com sucesso"); },
    onError: e => toast.error(e.message),
  });

  const relatorios = [
    {
      id: "movimentacao",
      titulo: "Movimentação Patrimonial",
      descricao: "Histórico de todas as movimentações de bens móveis (incorporações, transferências, baixas, cessões)",
      icon: <FileBarChart size={24} className="text-primary" />,
      requiresPeriodo: false,
      requiresUg: false,
      onGerar: () => movMut.mutate({ ugId: ugId || undefined }),
      loading: movMut.isPending,
    },
    {
      id: "inventario",
      titulo: "Inventário Físico-Financeiro",
      descricao: "Posição atual do inventário com valores contábeis, classes PCASP e situação de cada bem",
      icon: <Package size={24} className="text-primary" />,
      requiresPeriodo: false,
      requiresUg: false,
      onGerar: () => invMut.mutate({ ugId: ugId || undefined }),
      loading: invMut.isPending,
    },
    {
      id: "depreciacao",
      titulo: "Depreciação",
      descricao: "Lançamentos de depreciação mensal por período, com valores depreciados, acumulados e residuais",
      icon: <TrendingDown size={24} className="text-primary" />,
      requiresPeriodo: false,
      requiresUg: true,
      onGerar: () => {
        if (!ugId) return toast.error("Selecione uma UG para gerar o relatório de depreciação");
        depMut.mutate({ ugId });
      },
      loading: depMut.isPending,
    },
    {
      id: "conciliacao",
      titulo: "Conciliação",
      descricao: "Conciliação entre eventos patrimoniais e contabilidade, por período contábil",
      icon: <Scale size={24} className="text-primary" />,
      requiresPeriodo: true,
      requiresUg: true,
      onGerar: () => {
        if (!ugId) return toast.error("Selecione uma UG");
        if (!periodoId) return toast.error("Selecione um período contábil");
        concMut.mutate({ ugId, periodoId });
      },
      loading: concMut.isPending,
    },
    {
      id: "cessoes",
      titulo: "Cessões de Imóveis",
      descricao: "Relatório de cessões de imóveis vigentes e encerradas, com cessionários e prazos",
      icon: <Building2 size={24} className="text-primary" />,
      requiresPeriodo: false,
      requiresUg: false,
      onGerar: () => cessMut.mutate({ ugId: ugId || undefined }),
      loading: cessMut.isPending,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios Obrigatórios SEPAT</h1>
        <p className="text-muted-foreground text-sm mt-1">Relatórios exigidos pelo Sistema Estadual de Patrimônio — geração em PDF</p>
      </div>

      {/* Filtros globais */}
      <div className="bg-muted/40 rounded-lg p-4 border">
        <div className="text-sm font-medium mb-3 text-muted-foreground">Filtros (opcionais para a maioria dos relatórios)</div>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1 min-w-64">
            <Label className="text-xs">Unidade Gestora</Label>
            <Select value={String(ugId)} onValueChange={v => setUgId(parseInt(v))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todas as UGs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Todas as UGs</SelectItem>
                {ugs.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-48">
            <Label className="text-xs">Período Contábil <span className="text-red-500">(obrigatório para Conciliação)</span></Label>
            <Select value={String(periodoId)} onValueChange={v => setPeriodoId(parseInt(v))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione o período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Nenhum</SelectItem>
                {periodos.map((p: { id: number; ano: number; mes: number; situacao: string }) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.ano}/{String(p.mes).padStart(2, "0")} — {p.situacao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Cards dos relatórios */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {relatorios.map(rel => (
          <Card key={rel.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">{rel.icon}</div>
                <div>
                  <CardTitle className="text-base">{rel.titulo}</CardTitle>
                  {(rel.requiresUg || rel.requiresPeriodo) && (
                    <div className="flex gap-1 mt-1">
                      {rel.requiresUg && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Requer UG</span>}
                      {rel.requiresPeriodo && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Requer Período</span>}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between gap-4">
              <CardDescription className="text-sm leading-relaxed">{rel.descricao}</CardDescription>
              <Button
                className="w-full"
                onClick={rel.onGerar}
                disabled={rel.loading}
              >
                {rel.loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Gerando PDF...</>
                ) : (
                  <><Download size={15} className="mr-2" />Gerar PDF</>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
