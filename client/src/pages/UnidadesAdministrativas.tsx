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

export default function UnidadesAdministrativas() {
  const { data: ugs = [] } = trpc.transversal.ugs.list.useQuery();
  const [selectedUg, setSelectedUg] = useState<number>(0);
  const { data: uas = [], refetch } = trpc.transversal.uas.list.useQuery({ ugId: selectedUg }, { enabled: selectedUg > 0 });
  const createMut = trpc.transversal.uas.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("UA criada com sucesso"); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ugId: 0, codigo: "", nome: "", sigla: "" });

  function openCreate() { setForm({ ugId: selectedUg, codigo: "", nome: "", sigla: "" }); setOpen(true); }
  function handleSubmit() {
    if (!form.codigo || !form.nome || !form.ugId) return toast.error("UG, Código e Nome são obrigatórios");
    createMut.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unidades Administrativas</h1>
          <p className="text-muted-foreground text-sm">Setores e departamentos vinculados às UGs</p>
        </div>
        <Button onClick={openCreate} disabled={!selectedUg}><Plus size={16} className="mr-2" />Nova UA</Button>
      </div>
      <div className="max-w-xs">
        <Label className="mb-1 block">Filtrar por UG</Label>
        <Select value={String(selectedUg)} onValueChange={v => setSelectedUg(parseInt(v))}>
          <SelectTrigger><SelectValue placeholder="Selecione a UG" /></SelectTrigger>
          <SelectContent>{ugs.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Sigla</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {!selectedUg && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Selecione uma UG para ver as UAs</TableCell></TableRow>}
            {selectedUg && uas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma UA cadastrada para esta UG</TableCell></TableRow>}
            {uas.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-sm">{u.codigo}</TableCell>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell>{u.sigla}</TableCell>
                <TableCell><Badge variant={u.isActive ? "default" : "secondary"}>{u.isActive ? "Ativa" : "Inativa"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Unidade Administrativa</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1"><Label>Código *</Label><Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Sigla</Label><Input value={form.sigla} onChange={e => setForm(f => ({ ...f, sigla: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
