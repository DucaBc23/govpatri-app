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
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";

function downloadPdf(base64: string, filename: string) {
  const link = document.createElement("a");
  link.href = `data:application/pdf;base64,${base64}`;
  link.download = filename;
  link.click();
}

const situacaoColor: Record<string, string> = {
  ativo: "bg-green-100 text-green-700",
  em_manutencao: "bg-yellow-100 text-yellow-700",
  inservivel: "bg-red-100 text-red-700",
  baixado: "bg-gray-100 text-gray-600",
  cedido: "bg-blue-100 text-blue-700",
};

export default function BensMoveis() {
  const { data: bens = [], refetch } = trpc.bensMoveis.list.useQuery();
  const { data: classes = [] } = trpc.bensMoveis.classes.list.useQuery();
  const { data: ugs = [] } = trpc.transversal.ugs.list.useQuery();
  const createMut = trpc.bensMoveis.create.useMutation({ onSuccess: (d) => { refetch(); setOpen(false); toast.success(`Bem incorporado — Tombamento: ${d.numeroTombamento}`); } });
  const termoMut = trpc.termosPdf.emitir.useMutation({
    onSuccess: (d) => { downloadPdf(d.pdfBase64, d.filename); toast.success(`Termo ${d.numero} gerado`); },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ classeId: 0, ugId: 0, descricao: "", marca: "", modelo: "", numeroSerie: "", valorAquisicao: "", dataAquisicao: "" });

  function handleSubmit() {
    if (!form.classeId || !form.ugId || !form.descricao || !form.valorAquisicao) return toast.error("Preencha os campos obrigatórios");
    createMut.mutate({ ...form, classeId: form.classeId, ugId: form.ugId });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bens Móveis</h1>
          <p className="text-muted-foreground text-sm">Tombamento automático, custódia e movimentações</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} className="mr-2" />Incorporar Bem</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-primary">{bens.filter(b => b.situacao === "ativo").length}</div>
          <div className="text-sm text-muted-foreground">Ativos</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{bens.filter(b => b.situacao === "em_manutencao").length}</div>
          <div className="text-sm text-muted-foreground">Em Manutenção</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-500">{bens.filter(b => b.situacao === "baixado").length}</div>
          <div className="text-sm text-muted-foreground">Baixados</div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Tombamento</TableHead><TableHead>Descrição</TableHead><TableHead>Marca/Modelo</TableHead><TableHead>Valor Atual</TableHead><TableHead>Situação</TableHead><TableHead className="w-24"></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {bens.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum bem cadastrado</TableCell></TableRow>}
            {bens.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-sm font-medium">{b.numeroTombamento}</TableCell>
                <TableCell className="max-w-xs truncate">{b.descricao}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{[b.marca, b.modelo].filter(Boolean).join(" / ") || "—"}</TableCell>
                <TableCell className="font-medium">R$ {parseFloat(String(b.valorAtual ?? b.valorAquisicao)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${situacaoColor[b.situacao] ?? ""}`}>{b.situacao.replace("_", " ")}</span></TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => termoMut.mutate({ bemId: b.id })} disabled={termoMut.isPending}>
                    <FileText size={14} className="mr-1" />Termo
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Incorporar Novo Bem Móvel</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição completa do bem" /></div>
            <div className="space-y-1"><Label>Classe *</Label>
              <Select value={String(form.classeId)} onValueChange={v => setForm(f => ({ ...f, classeId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a classe" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Unidade Gestora *</Label>
              <Select value={String(form.ugId)} onValueChange={v => setForm(f => ({ ...f, ugId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a UG" /></SelectTrigger>
                <SelectContent>{ugs.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Marca</Label><Input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Modelo</Label><Input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Número de Série</Label><Input value={form.numeroSerie} onChange={e => setForm(f => ({ ...f, numeroSerie: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Data de Aquisição</Label><Input type="date" value={form.dataAquisicao} onChange={e => setForm(f => ({ ...f, dataAquisicao: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Valor de Aquisição (R$) *</Label><Input type="number" step="0.01" value={form.valorAquisicao} onChange={e => setForm(f => ({ ...f, valorAquisicao: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>Incorporar Bem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
