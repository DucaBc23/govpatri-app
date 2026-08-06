import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function UnidadesGestoras() {
  const { data: orgaos = [] } = trpc.transversal.orgaos.list.useQuery();
  const { data: ugs = [], refetch } = trpc.transversal.ugs.list.useQuery();
  const createMut = trpc.transversal.ugs.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("UG criada com sucesso"); } });
  const updateMut = trpc.transversal.ugs.update.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("UG atualizada"); } });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof ugs)[0] | null>(null);
  const [form, setForm] = useState({ orgaoId: 0, codigo: "", nome: "", sigla: "", cnpj: "", tipo: "ug_executora" as "ug_executora" | "ug_gestora" | "ug_setorial" });

  function openCreate() { setEditing(null); setForm({ orgaoId: orgaos[0]?.id ?? 0, codigo: "", nome: "", sigla: "", cnpj: "", tipo: "ug_executora" }); setOpen(true); }
  function openEdit(u: (typeof ugs)[0]) { setEditing(u); setForm({ orgaoId: u.orgaoId, codigo: u.codigo, nome: u.nome, sigla: u.sigla ?? "", cnpj: u.cnpj ?? "", tipo: u.tipo }); setOpen(true); }

  function handleSubmit() {
    if (!form.codigo || !form.nome || !form.orgaoId) return toast.error("Órgão, Código e Nome são obrigatórios");
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  }

  const orgaoNome = (id: number) => orgaos.find(o => o.id === id)?.sigla ?? orgaos.find(o => o.id === id)?.nome ?? "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unidades Gestoras</h1>
          <p className="text-muted-foreground text-sm">Gestão das UGs vinculadas aos órgãos</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-2" />Nova UG</Button>
      </div>
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Órgão</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead className="w-16"></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {ugs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma UG cadastrada</TableCell></TableRow>}
            {ugs.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-sm">{u.codigo}</TableCell>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell>{orgaoNome(u.orgaoId)}</TableCell>
                <TableCell><Badge variant="outline">{u.tipo.replace("_", " ")}</Badge></TableCell>
                <TableCell><Badge variant={u.isActive ? "default" : "secondary"}>{u.isActive ? "Ativa" : "Inativa"}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil size={14} /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar UG" : "Nova Unidade Gestora"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1"><Label>Órgão *</Label>
              <Select value={String(form.orgaoId)} onValueChange={v => setForm(f => ({ ...f, orgaoId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o órgão" /></SelectTrigger>
                <SelectContent>{orgaos.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Código *</Label><Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Sigla</Label><Input value={form.sigla} onChange={e => setForm(f => ({ ...f, sigla: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="space-y-1"><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as typeof form.tipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ug_executora">UG Executora</SelectItem>
                  <SelectItem value="ug_gestora">UG Gestora</SelectItem>
                  <SelectItem value="ug_setorial">UG Setorial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
