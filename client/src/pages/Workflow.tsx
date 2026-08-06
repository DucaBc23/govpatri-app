import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, GitBranch } from "lucide-react";
import { toast } from "sonner";

const situacaoColor: Record<string, string> = {
  em_andamento: "bg-blue-100 text-blue-700",
  aprovado: "bg-green-100 text-green-700",
  rejeitado: "bg-red-100 text-red-700",
  cancelado: "bg-gray-100 text-gray-600",
};

export default function Workflow() {
  const { data: instancias = [], refetch } = trpc.workflow.instancias.list.useQuery();
  const decidirMut = trpc.workflow.instancias.decidir.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Decisão registrada"); } });

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<(typeof instancias)[0] | null>(null);
  const [form, setForm] = useState({ decisao: "aprovado" as "aprovado" | "rejeitado", justificativa: "" });

  function openDecisao(inst: (typeof instancias)[0]) { setSelected(inst); setForm({ decisao: "aprovado", justificativa: "" }); setOpen(true); }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Workflow de Aprovação</h1>
        <p className="text-muted-foreground text-sm">Incorporações, baixas, cessões e desfazimentos pendentes de aprovação</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(["em_andamento", "aprovado", "rejeitado"] as const).map(s => (
          <div key={s} className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{instancias.filter(i => i.situacao === s).length}</div>
            <div className="text-sm text-muted-foreground capitalize">{s.replace("_", " ")}</div>
          </div>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Entidade</TableHead><TableHead>Etapa Atual</TableHead><TableHead>Situação</TableHead><TableHead>Data</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
          <TableBody>
            {instancias.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma instância de workflow</TableCell></TableRow>}
            {instancias.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-medium capitalize">{i.entidade.replace("_", " ")} #{i.entidadeId}</TableCell>
                <TableCell>Etapa {i.etapaAtual + 1}</TableCell>
                <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${situacaoColor[i.situacao] ?? ""}`}>{i.situacao.replace("_", " ")}</span></TableCell>
                <TableCell className="text-sm">{new Date(i.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  {i.situacao === "em_andamento" && (
                    <Button size="sm" variant="outline" onClick={() => openDecisao(i)}>Decidir</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Decisão</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Decisão</Label>
              <Select value={form.decisao} onValueChange={v => setForm(f => ({ ...f, decisao: v as "aprovado" | "rejeitado" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprovado">Aprovar</SelectItem>
                  <SelectItem value="rejeitado">Rejeitar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Justificativa</Label><Textarea value={form.justificativa} onChange={e => setForm(f => ({ ...f, justificativa: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!selected) return; decidirMut.mutate({ instanciaId: selected.id, ...form }); }} disabled={decidirMut.isPending}
              className={form.decisao === "aprovado" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}>
              {form.decisao === "aprovado" ? <><CheckCircle size={14} className="mr-1" />Aprovar</> : <><XCircle size={14} className="mr-1" />Rejeitar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
