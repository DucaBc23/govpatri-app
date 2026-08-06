import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const dominialColor: Record<string, string> = {
  regular: "bg-green-100 text-green-700",
  irregular: "bg-red-100 text-red-700",
  em_regularizacao: "bg-yellow-100 text-yellow-700",
  litigioso: "bg-orange-100 text-orange-700",
};

export default function BensImoveis() {
  const { data: imoveis = [], refetch } = trpc.bensImoveis.list.useQuery();
  const { data: ugs = [] } = trpc.transversal.ugs.list.useQuery();
  const createMut = trpc.bensImoveis.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Imóvel cadastrado"); } });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ugId: 0, rip: "", denominacao: "", tipo: "edificacao" as "terreno" | "edificacao" | "conjunto" | "outros", endereco: "", municipio: "", uf: "", areaTotal: "", valorAvaliacao: "", situacaoDominial: "regular" as "regular" | "irregular" | "em_regularizacao" | "litigioso" });

  function handleSubmit() {
    if (!form.ugId || !form.denominacao) return toast.error("UG e Denominação são obrigatórios");
    createMut.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bens Imóveis</h1>
          <p className="text-muted-foreground text-sm">Cadastro dominial, ocupações, cessões e pendências</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} className="mr-2" />Novo Imóvel</Button>
      </div>
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>RIP</TableHead><TableHead>Denominação</TableHead><TableHead>Tipo</TableHead><TableHead>Município/UF</TableHead><TableHead>Área Total (m²)</TableHead><TableHead>Situação Dominial</TableHead><TableHead>Ocupação</TableHead></TableRow></TableHeader>
          <TableBody>
            {imoveis.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum imóvel cadastrado</TableCell></TableRow>}
            {imoveis.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-sm">{i.rip ?? "—"}</TableCell>
                <TableCell className="font-medium">{i.denominacao}</TableCell>
                <TableCell className="capitalize">{i.tipo}</TableCell>
                <TableCell>{[i.municipio, i.uf].filter(Boolean).join(" / ") || "—"}</TableCell>
                <TableCell>{i.areaTotal ? parseFloat(String(i.areaTotal)).toLocaleString("pt-BR") : "—"}</TableCell>
                <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dominialColor[i.situacaoDominial] ?? ""}`}>{i.situacaoDominial.replace("_", " ")}</span></TableCell>
                <TableCell><Badge variant="outline">{i.situacaoOcupacao.replace("_", " ")}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Cadastrar Bem Imóvel</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1"><Label>UG *</Label>
              <Select value={String(form.ugId)} onValueChange={v => setForm(f => ({ ...f, ugId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a UG" /></SelectTrigger>
                <SelectContent>{ugs.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>RIP</Label><Input value={form.rip} onChange={e => setForm(f => ({ ...f, rip: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Denominação *</Label><Input value={form.denominacao} onChange={e => setForm(f => ({ ...f, denominacao: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as typeof form.tipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="terreno">Terreno</SelectItem>
                  <SelectItem value="edificacao">Edificação</SelectItem>
                  <SelectItem value="conjunto">Conjunto</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Situação Dominial</Label>
              <Select value={form.situacaoDominial} onValueChange={v => setForm(f => ({ ...f, situacaoDominial: v as typeof form.situacaoDominial }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="irregular">Irregular</SelectItem>
                  <SelectItem value="em_regularizacao">Em Regularização</SelectItem>
                  <SelectItem value="litigioso">Litigioso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1"><Label>Endereço</Label><Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Município</Label><Input value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} /></div>
            <div className="space-y-1"><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} /></div>
            <div className="space-y-1"><Label>Área Total (m²)</Label><Input type="number" value={form.areaTotal} onChange={e => setForm(f => ({ ...f, areaTotal: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Valor de Avaliação (R$)</Label><Input type="number" step="0.01" value={form.valorAvaliacao} onChange={e => setForm(f => ({ ...f, valorAvaliacao: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>Cadastrar Imóvel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
