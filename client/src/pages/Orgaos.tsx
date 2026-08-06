import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Building2 } from "lucide-react";
import { toast } from "sonner";

type Esfera = "federal" | "estadual" | "municipal" | "distrital";

export default function Orgaos() {
  const { data: orgaos = [], refetch } = trpc.transversal.orgaos.list.useQuery();
  const createMut = trpc.transversal.orgaos.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Órgão criado com sucesso"); } });
  const updateMut = trpc.transversal.orgaos.update.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Órgão atualizado"); } });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof orgaos)[0] | null>(null);
  const [form, setForm] = useState({ codigo: "", nome: "", sigla: "", cnpj: "", esfera: "estadual" as Esfera, uf: "", municipio: "" });

  function openCreate() { setEditing(null); setForm({ codigo: "", nome: "", sigla: "", cnpj: "", esfera: "estadual", uf: "", municipio: "" }); setOpen(true); }
  function openEdit(o: (typeof orgaos)[0]) { setEditing(o); setForm({ codigo: o.codigo, nome: o.nome, sigla: o.sigla ?? "", cnpj: o.cnpj ?? "", esfera: o.esfera, uf: o.uf ?? "", municipio: o.municipio ?? "" }); setOpen(true); }

  function handleSubmit() {
    if (!form.codigo || !form.nome) return toast.error("Código e Nome são obrigatórios");
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Órgãos</h1>
          <p className="text-muted-foreground text-sm">Cadastro de órgãos da administração pública</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-2" />Novo Órgão</Button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Sigla</TableHead>
              <TableHead>Esfera</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgaos.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum órgão cadastrado</TableCell></TableRow>}
            {orgaos.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-sm">{o.codigo}</TableCell>
                <TableCell className="font-medium">{o.nome}</TableCell>
                <TableCell>{o.sigla}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{o.esfera}</Badge></TableCell>
                <TableCell>{o.uf}</TableCell>
                <TableCell><Badge variant={o.isActive ? "default" : "secondary"}>{o.isActive ? "Ativo" : "Inativo"}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil size={14} /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Órgão" : "Novo Órgão"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1"><Label>Código *</Label><Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Sigla</Label><Input value={form.sigla} onChange={e => setForm(f => ({ ...f, sigla: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="space-y-1"><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Esfera</Label>
              <Select value={form.esfera} onValueChange={v => setForm(f => ({ ...f, esfera: v as Esfera }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="federal">Federal</SelectItem>
                  <SelectItem value="estadual">Estadual</SelectItem>
                  <SelectItem value="municipal">Municipal</SelectItem>
                  <SelectItem value="distrital">Distrital</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} /></div>
            <div className="space-y-1"><Label>Município</Label><Input value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} /></div>
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
