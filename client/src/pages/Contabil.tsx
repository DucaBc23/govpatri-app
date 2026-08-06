import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Lock, Unlock, Calculator } from "lucide-react";
import { toast } from "sonner";

export default function Contabil() {
  const { data: contas = [], refetch: refetchContas } = trpc.contabil.planoContas.list.useQuery();
  const { data: ugs = [] } = trpc.transversal.ugs.list.useQuery();
  const [selectedUg, setSelectedUg] = useState<number>(0);
  const { data: periodos = [], refetch: refetchPeriodos } = trpc.contabil.periodos.list.useQuery({ ugId: selectedUg }, { enabled: selectedUg > 0 });
  const { data: eventos = [] } = trpc.contabil.eventos.list.useQuery({ ugId: selectedUg }, { enabled: selectedUg > 0 });

  const abrirMut = trpc.contabil.periodos.abrir.useMutation({ onSuccess: () => { refetchPeriodos(); toast.success("Período aberto"); } });
  const fecharMut = trpc.contabil.periodos.fechar.useMutation({ onSuccess: () => { refetchPeriodos(); toast.success("Período fechado"); } });
  const deprecMut = trpc.contabil.depreciacao.calcular.useMutation({ onSuccess: (d) => { toast.success(`Depreciação calculada para ${d.processados} bens`); } });

  const [openConta, setOpenConta] = useState(false);
  const [contaForm, setContaForm] = useState({ codigo: "", nome: "", tipo: "ativo" as "ativo" | "passivo" | "patrimonio" | "receita" | "despesa" | "variacao", natureza: "devedora" as "devedora" | "credora", nivel: 1, aceitaLancamento: false });
  const createContaMut = trpc.contabil.planoContas.create.useMutation({ onSuccess: () => { refetchContas(); setOpenConta(false); toast.success("Conta criada"); } });

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Camada Contábil</h1>
          <p className="text-muted-foreground text-sm">PCASP, eventos patrimoniais e depreciação mensal</p>
        </div>
        <Button onClick={() => setOpenConta(true)}><Plus size={16} className="mr-2" />Nova Conta PCASP</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-64">
          <Select value={String(selectedUg)} onValueChange={v => setSelectedUg(parseInt(v))}>
            <SelectTrigger><SelectValue placeholder="Selecione a UG" /></SelectTrigger>
            <SelectContent>{ugs.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {selectedUg > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={() => abrirMut.mutate({ ugId: selectedUg, ano: now.getFullYear(), mes: now.getMonth() + 1 })}>
              <Unlock size={14} className="mr-1" />Abrir Período Atual
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const p = periodos.find(p => p.situacao === "aberto"); if (p) fecharMut.mutate({ id: p.id }); else toast.error("Nenhum período aberto"); }}>
              <Lock size={14} className="mr-1" />Fechar Período
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const p = periodos.find(p => p.situacao === "aberto"); if (p) deprecMut.mutate({ ugId: selectedUg, periodoId: p.id }); else toast.error("Abra um período primeiro"); }}>
              <Calculator size={14} className="mr-1" />Calcular Depreciação
            </Button>
          </>
        )}
      </div>

      <Tabs defaultValue="plano">
        <TabsList>
          <TabsTrigger value="plano">Plano de Contas</TabsTrigger>
          <TabsTrigger value="periodos">Períodos Contábeis</TabsTrigger>
          <TabsTrigger value="eventos">Eventos Patrimoniais</TabsTrigger>
        </TabsList>
        <TabsContent value="plano" className="mt-4">
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Natureza</TableHead><TableHead>Nível</TableHead><TableHead>Lançamento</TableHead></TableRow></TableHeader>
              <TableBody>
                {contas.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma conta cadastrada</TableCell></TableRow>}
                {contas.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.codigo}</TableCell>
                    <TableCell style={{ paddingLeft: `${(c.nivel - 1) * 16 + 12}px` }}>{c.nome}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.tipo}</Badge></TableCell>
                    <TableCell className="capitalize">{c.natureza}</TableCell>
                    <TableCell>{c.nivel}</TableCell>
                    <TableCell>{c.aceitaLancamento ? <Badge variant="default">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="periodos" className="mt-4">
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Período</TableHead><TableHead>Situação</TableHead><TableHead>Abertura</TableHead><TableHead>Fechamento</TableHead></TableRow></TableHeader>
              <TableBody>
                {!selectedUg && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Selecione uma UG</TableCell></TableRow>}
                {selectedUg && periodos.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum período cadastrado</TableCell></TableRow>}
                {periodos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{String(p.mes).padStart(2, "0")}/{p.ano}</TableCell>
                    <TableCell><Badge variant={p.situacao === "aberto" ? "default" : "secondary"} className="capitalize">{p.situacao}</Badge></TableCell>
                    <TableCell className="text-sm">{new Date(p.dataAbertura).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{p.dataFechamento ? new Date(p.dataFechamento).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="eventos" className="mt-4">
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Histórico</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
              <TableBody>
                {!selectedUg && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Selecione uma UG</TableCell></TableRow>}
                {selectedUg && eventos.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum evento registrado</TableCell></TableRow>}
                {eventos.map(e => (
                  <TableRow key={e.id}>
                    <TableCell><Badge variant="outline" className="capitalize">{e.tipo}</Badge></TableCell>
                    <TableCell className="font-medium">R$ {parseFloat(String(e.valor)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{e.historico}</TableCell>
                    <TableCell className="text-sm">{new Date(e.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={openConta} onOpenChange={setOpenConta}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Conta PCASP</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1"><Label>Código *</Label><Input value={contaForm.codigo} onChange={e => setContaForm(f => ({ ...f, codigo: e.target.value }))} placeholder="1.1.1.1.1.00" /></div>
            <div className="space-y-1"><Label>Nível</Label><Input type="number" min={1} max={6} value={contaForm.nivel} onChange={e => setContaForm(f => ({ ...f, nivel: parseInt(e.target.value) }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Nome *</Label><Input value={contaForm.nome} onChange={e => setContaForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={contaForm.tipo} onValueChange={v => setContaForm(f => ({ ...f, tipo: v as typeof contaForm.tipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem><SelectItem value="passivo">Passivo</SelectItem>
                  <SelectItem value="patrimonio">Patrimônio</SelectItem><SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem><SelectItem value="variacao">Variação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Natureza</Label>
              <Select value={contaForm.natureza} onValueChange={v => setContaForm(f => ({ ...f, natureza: v as "devedora" | "credora" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="devedora">Devedora</SelectItem><SelectItem value="credora">Credora</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenConta(false)}>Cancelar</Button>
            <Button onClick={() => { if (!contaForm.codigo || !contaForm.nome) return toast.error("Código e Nome obrigatórios"); createContaMut.mutate(contaForm); }} disabled={createContaMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
