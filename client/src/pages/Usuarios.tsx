import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, UserCog } from "lucide-react";
import { toast } from "sonner";

const PERFIS = ["admin", "gestor", "operador", "auditor"] as const;
type Perfil = typeof PERFIS[number];

const perfilColor: Record<Perfil, string> = {
  admin: "bg-red-100 text-red-700",
  gestor: "bg-blue-100 text-blue-700",
  operador: "bg-green-100 text-green-700",
  auditor: "bg-purple-100 text-purple-700",
};

export default function Usuarios() {
  const { data: usuarios = [], refetch } = trpc.usuarios.list.useQuery();
  const { data: ugs = [] } = trpc.transversal.ugs.list.useQuery();
  const updateMut = trpc.usuarios.updatePerfil.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Perfil atualizado"); } });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof usuarios)[0] | null>(null);
  const [form, setForm] = useState({ perfil: "operador" as Perfil, ugId: 0 });

  function openEdit(u: (typeof usuarios)[0]) {
    setEditing(u);
    setForm({ perfil: u.perfil as Perfil, ugId: u.ugId ?? 0 });
    setOpen(true);
  }

  function handleSubmit() {
    if (!editing) return;
    updateMut.mutate({ govpatriUserId: editing.id, perfil: form.perfil, ugId: form.ugId || undefined });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
        <p className="text-muted-foreground text-sm">Perfis de acesso RBAC: admin, gestor, operador e auditor</p>
      </div>
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead><TableHead>UG Principal</TableHead><TableHead>Status</TableHead><TableHead className="w-16"></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário cadastrado. Faça login para criar seu perfil.</TableCell></TableRow>}
            {usuarios.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${perfilColor[u.perfil as Perfil] ?? ""}`}>{u.perfil}</span>
                </TableCell>
                <TableCell>{ugs.find(ug => ug.id === u.ugId)?.nome ?? "—"}</TableCell>
                <TableCell><Badge variant={u.isActive ? "default" : "secondary"}>{u.isActive ? "Ativo" : "Inativo"}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil size={14} /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Perfil — {editing?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Perfil de Acesso</Label>
              <Select value={form.perfil} onValueChange={v => setForm(f => ({ ...f, perfil: v as Perfil }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERFIS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>UG Principal</Label>
              <Select value={String(form.ugId)} onValueChange={v => setForm(f => ({ ...f, ugId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a UG" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem UG específica</SelectItem>
                  {ugs.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={updateMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
