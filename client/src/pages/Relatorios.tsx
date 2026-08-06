import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileBarChart, Download, FileText } from "lucide-react";
import { toast } from "sonner";

const RELATORIOS = [
  { id: "movimentacao", nome: "Movimentação Patrimonial", desc: "Histórico de todas as movimentações de bens móveis" },
  { id: "inventario", nome: "Inventário Físico-Financeiro", desc: "Posição atual do inventário com valores contábeis" },
  { id: "depreciacao", nome: "Depreciação", desc: "Lançamentos de depreciação mensal por período" },
  { id: "conciliacao", nome: "Conciliação", desc: "Conciliação entre eventos patrimoniais e contabilidade" },
  { id: "cessoes", nome: "Cessões", desc: "Relatório de cessões de imóveis vigentes e encerradas" },
];

export default function Relatorios() {
  const { data: ugs = [] } = trpc.transversal.ugs.list.useQuery();
  const [selectedUg, setSelectedUg] = useState<number>(0);
  const [activeRel, setActiveRel] = useState<string | null>(null);

  const { data: movimentacao = [] } = trpc.relatorios.movimentacaoPatrimonial.useQuery({ ugId: selectedUg || undefined }, { enabled: activeRel === "movimentacao" });
  const { data: inventario = [] } = trpc.relatorios.inventarioFisicoFinanceiro.useQuery({ ugId: selectedUg || undefined }, { enabled: activeRel === "inventario" });
  const { data: cessoes = [] } = trpc.relatorios.cessoes.useQuery({ ugId: selectedUg || undefined }, { enabled: activeRel === "cessoes" });

  function handleGerar(id: string) {
    if (!selectedUg && id !== "cessoes") return toast.error("Selecione uma UG para gerar o relatório");
    setActiveRel(id);
    toast.success("Relatório gerado");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios Obrigatórios SEPAT</h1>
        <p className="text-muted-foreground text-sm">Relatórios exigidos pelo Sistema Estadual de Patrimônio</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-72">
          <Select value={String(selectedUg)} onValueChange={v => setSelectedUg(parseInt(v))}>
            <SelectTrigger><SelectValue placeholder="Filtrar por UG (opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Todas as UGs</SelectItem>
              {ugs.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {RELATORIOS.map(r => (
          <Card key={r.id} className={`cursor-pointer transition-all ${activeRel === r.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <FileBarChart size={20} className="text-primary mt-0.5" />
                <Button size="sm" variant="outline" onClick={() => handleGerar(r.id)}>
                  <Download size={14} className="mr-1" />Gerar
                </Button>
              </div>
              <CardTitle className="text-base mt-2">{r.nome}</CardTitle>
              <CardDescription className="text-xs">{r.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Resultado do relatório ativo */}
      {activeRel === "inventario" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Inventário Físico-Financeiro</h2>
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Tombamento</TableHead><TableHead>Descrição</TableHead><TableHead>Classe</TableHead><TableHead>Valor Aquisição</TableHead><TableHead>Valor Atual</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
              <TableBody>
                {inventario.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sem dados</TableCell></TableRow>}
                {inventario.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-sm">{i.numeroTombamento}</TableCell>
                    <TableCell className="max-w-xs truncate">{i.descricao}</TableCell>
                    <TableCell>{i.classeNome ?? "—"}</TableCell>
                    <TableCell>R$ {parseFloat(String(i.valorAquisicao)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>R$ {parseFloat(String(i.valorAtual ?? i.valorAquisicao)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="capitalize">{i.situacao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeRel === "cessoes" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Relatório de Cessões</h2>
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Cessionário</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
              <TableBody>
                {cessoes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem dados</TableCell></TableRow>}
                {cessoes.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.cessionario}</TableCell>
                    <TableCell className="text-sm">{new Date(c.dataInicio).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{c.dataFim ? new Date(c.dataFim).toLocaleDateString("pt-BR") : "Indeterminado"}</TableCell>
                    <TableCell className="capitalize">{c.situacao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
