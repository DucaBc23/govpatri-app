import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckCircle, Wrench } from "lucide-react";
import { toast } from "sonner";

const situacaoColor: Record<string, string> = {
  aberta: "bg-yellow-100 text-yellow-700",
  em_andamento: "bg-blue-100 text-blue-700",
  concluida: "bg-green-100 text-green-700",
};

export default function Manutencoes() {
  const { data: manutencoes = [], refetch } = trpc.manutencoes.list.useQuery({});
  const { data: bens = [] } = trpc.bensMoveis.list.useQuery({});

  const createMut = trpc.manutencoes.create.useMutation({
    onSuccess: () => { refetch(); setOpenCreate(false); toast.success("Manutenção registrada"); },
    onError: (e) => toast.error(e.message),
  });
  const concluirMut = trpc.manutencoes.concluir.useMutation({
    onSuccess: () => { refetch(); setOpenConcluir(false); toast.success("Manutenção concluída — bem reativado"); },
    onError: (e) => toast.error(e.message),
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [openConcluir, setOpenConcluir] = useState(false);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [form, setForm] = useState({ bemId: 0, tipo: "corretiva" as "preventiva" | "corretiva", descricao: "", dataInicio: new Date().toISOString().split("T")[0]!, fornecedor: "", custo: "" });
  const [concluirForm, setConcluirForm] = useState({ dataConclusao: new Date().toISOString().split("T")[0]!, custo: "" });

  function handleCreate() {
    if (!form.bemId || !form.descricao) return toast.error("Bem e descrição são obrigatórios");
    createMut.mutate(form);
  }

  function handleConcluir() {
    concluirMut.mutate({ id: selectedId, ...concluirForm });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manutenções</h1>
          <p className="text-muted-foreground text-sm mt-1">Registro de manutenções preventivas e corretivas de bens móveis</p>
        </div>
        <Button onClick={() => setOpenCreate(true)}><Plus size={16} className="mr-2" />Registrar Manutenção</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(["aberta", "em_andamento", "concluida"] as const).map(s => (
          <div key={s} className="bg-muted/40 rounded-lg p-4 border text-center">
            <div className="text-2xl font-bold">{manutencoes.filter(m => m.situacao === s).length}</div>
            <div className="text-sm text-muted-foreground capitalize">{s.replace("_", " ")}</div>
          </div>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bem</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {manutencoes.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma manutenção registrada</TableCell></TableRow>
            )}
            {manutencoes.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.bemTombamento ?? `#${m.bemId}`}<div className="text-muted-foreground">{m.bemDescricao}</div></TableCell>
                <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                <TableCell className="max-w-48 truncate">{m.descricao}</TableCell>
                <TableCell className="text-sm">{m.dataInicio ? new Date(m.dataInicio).toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell>{m.fornecedor ?? "—"}</TableCell>
                <TableCell>{m.custo ? `R$ ${parseFloat(String(m.custo)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                <TableCell><Badge className={situacaoColor[m.situacao ?? "aberta"]}>{m.situacao}</Badge></TableCell>
                <TableCell>
                  {m.situacao !== "concluida" && (
                    <Button size="sm" variant="outline" onClick={() => { setSelectedId(m.id); setOpenConcluir(true); }}>
                      <CheckCircle size={14} className="mr-1" />Concluir
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog: Registrar Manutenção */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle><Wrench size={18} className="inline mr-2" />Registrar Manutenção</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Bem</Label>
              <Select value={String(form.bemId)} onValueChange={v => setForm(f => ({ ...f, bemId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o bem" /></SelectTrigger>
                <SelectContent>{bens.map((b: { id: number; numeroTombamento: string; descricao: string }) => <SelectItem key={b.id} value={String(b.id)}>{b.numeroTombamento} — {b.descricao}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as "preventiva" | "corretiva" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="corretiva">Corretiva</SelectItem><SelectItem value="preventiva">Preventiva</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Data de Início</Label><Input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o problema ou serviço..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome da empresa" /></div>
              <div className="space-y-1"><Label>Custo (R$)</Label><Input type="number" value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} placeholder="0,00" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Concluir Manutenção */}
      <Dialog open={openConcluir} onOpenChange={setOpenConcluir}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Concluir Manutenção</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Data de Conclusão</Label><Input type="date" value={concluirForm.dataConclusao} onChange={e => setConcluirForm(f => ({ ...f, dataConclusao: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Custo Final (R$)</Label><Input type="number" value={concluirForm.custo} onChange={e => setConcluirForm(f => ({ ...f, custo: e.target.value }))} placeholder="0,00" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenConcluir(false)}>Cancelar</Button>
            <Button onClick={handleConcluir} disabled={concluirMut.isPending}>Confirmar Conclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
