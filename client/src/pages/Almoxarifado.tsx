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
import { Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Almoxarifado() {
  const { data: itens = [], refetch: refetchItens } = trpc.almoxarifado.itens.list.useQuery();
  const { data: depositos = [] } = trpc.almoxarifado.depositos.list.useQuery();
  const [selectedDeposito, setSelectedDeposito] = useState<number>(0);
  const { data: estoque = [] } = trpc.almoxarifado.estoque.getByDeposito.useQuery({ depositoId: selectedDeposito }, { enabled: selectedDeposito > 0 });

  const createItemMut = trpc.almoxarifado.itens.create.useMutation({ onSuccess: () => { refetchItens(); setOpenItem(false); toast.success("Item criado"); } });
  const movMut = trpc.almoxarifado.movimentacoes.registrar.useMutation({ onSuccess: () => { toast.success("Movimentação registrada"); setOpenMov(false); } });

  const [openItem, setOpenItem] = useState(false);
  const [openMov, setOpenMov] = useState(false);
  const [itemForm, setItemForm] = useState({ codigo: "", nome: "", unidadeMedida: "UN", categoria: "", estoqueMinimo: "" });
  const [movForm, setMovForm] = useState({ depositoId: 0, itemId: 0, tipo: "entrada" as "entrada" | "saida" | "ajuste", quantidade: "", valorUnitario: "" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Almoxarifado</h1>
          <p className="text-muted-foreground text-sm">Catálogo, estoque por depósito e requisições de material</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenMov(true)}>Registrar Movimentação</Button>
          <Button onClick={() => setOpenItem(true)}><Plus size={16} className="mr-2" />Novo Item</Button>
        </div>
      </div>

      <Tabs defaultValue="catalogo">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo de Itens</TabsTrigger>
          <TabsTrigger value="estoque">Estoque por Depósito</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogo" className="mt-4">
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Unidade</TableHead><TableHead>Categoria</TableHead><TableHead>Estoque Mínimo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {itens.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum item no catálogo</TableCell></TableRow>}
                {itens.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-sm">{i.codigo}</TableCell>
                    <TableCell className="font-medium">{i.nome}</TableCell>
                    <TableCell>{i.unidadeMedida}</TableCell>
                    <TableCell>{i.categoria ?? "—"}</TableCell>
                    <TableCell>{i.estoqueMinimo ?? "0"}</TableCell>
                    <TableCell><Badge variant={i.isActive ? "default" : "secondary"}>{i.isActive ? "Ativo" : "Inativo"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="estoque" className="mt-4 space-y-4">
          <div className="max-w-xs">
            <Select value={String(selectedDeposito)} onValueChange={v => setSelectedDeposito(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="Selecione o depósito" /></SelectTrigger>
              <SelectContent>{depositos.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Item</TableHead><TableHead>Quantidade</TableHead><TableHead>Valor Unitário Médio</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
              <TableBody>
                {!selectedDeposito && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Selecione um depósito</TableCell></TableRow>}
                {selectedDeposito && estoque.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem estoque neste depósito</TableCell></TableRow>}
                {estoque.map(e => {
                  const abaixoMinimo = e.estoqueMinimo && parseFloat(String(e.quantidade)) < parseFloat(String(e.estoqueMinimo));
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-sm">{e.itemCodigo}</TableCell>
                      <TableCell className="font-medium">{e.itemNome}</TableCell>
                      <TableCell className={abaixoMinimo ? "text-red-600 font-medium" : ""}>{e.quantidade} {e.itemUnidade}{abaixoMinimo && <AlertTriangle size={14} className="inline ml-1" />}</TableCell>
                      <TableCell>{e.valorUnitarioMedio ? `R$ ${parseFloat(String(e.valorUnitarioMedio)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                      <TableCell>{abaixoMinimo ? <Badge variant="destructive">Abaixo do mínimo</Badge> : <Badge variant="default">Normal</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Novo Item */}
      <Dialog open={openItem} onOpenChange={setOpenItem}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Item no Catálogo</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1"><Label>Código *</Label><Input value={itemForm.codigo} onChange={e => setItemForm(f => ({ ...f, codigo: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Unidade *</Label><Input value={itemForm.unidadeMedida} onChange={e => setItemForm(f => ({ ...f, unidadeMedida: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Nome *</Label><Input value={itemForm.nome} onChange={e => setItemForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Categoria</Label><Input value={itemForm.categoria} onChange={e => setItemForm(f => ({ ...f, categoria: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Estoque Mínimo</Label><Input type="number" value={itemForm.estoqueMinimo} onChange={e => setItemForm(f => ({ ...f, estoqueMinimo: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenItem(false)}>Cancelar</Button>
            <Button onClick={() => { if (!itemForm.codigo || !itemForm.nome) return toast.error("Código e Nome obrigatórios"); createItemMut.mutate(itemForm); }} disabled={createItemMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Movimentação */}
      <Dialog open={openMov} onOpenChange={setOpenMov}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Movimentação de Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Depósito *</Label>
              <Select value={String(movForm.depositoId)} onValueChange={v => setMovForm(f => ({ ...f, depositoId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{depositos.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Item *</Label>
              <Select value={String(movForm.itemId)} onValueChange={v => setMovForm(f => ({ ...f, itemId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{itens.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={movForm.tipo} onValueChange={v => setMovForm(f => ({ ...f, tipo: v as typeof movForm.tipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Quantidade *</Label><Input type="number" step="0.001" value={movForm.quantidade} onChange={e => setMovForm(f => ({ ...f, quantidade: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Valor Unitário</Label><Input type="number" step="0.01" value={movForm.valorUnitario} onChange={e => setMovForm(f => ({ ...f, valorUnitario: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMov(false)}>Cancelar</Button>
            <Button onClick={() => { if (!movForm.depositoId || !movForm.itemId || !movForm.quantidade) return toast.error("Preencha os campos obrigatórios"); movMut.mutate({ depositoId: movForm.depositoId, itemId: movForm.itemId, tipo: movForm.tipo, quantidade: movForm.quantidade, valorUnitario: movForm.valorUnitario || undefined }); }} disabled={movMut.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
