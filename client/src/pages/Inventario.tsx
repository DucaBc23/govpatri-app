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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, QrCode, CheckCircle, AlertTriangle, ClipboardList, Play, Flag } from "lucide-react";
import { toast } from "sonner";

const situacaoColor: Record<string, string> = {
  encontrado: "bg-green-100 text-green-700",
  nao_encontrado: "bg-red-100 text-red-700",
  divergencia_localizacao: "bg-yellow-100 text-yellow-700",
  divergencia_estado: "bg-orange-100 text-orange-700",
};

const invSituacaoColor: Record<string, string> = {
  aberto: "bg-blue-100 text-blue-700",
  em_coleta: "bg-yellow-100 text-yellow-700",
  concluido: "bg-green-100 text-green-700",
  cancelado: "bg-gray-100 text-gray-600",
};

export default function Inventario() {
  const { data: ugs = [] } = trpc.transversal.ugs.list.useQuery();
  const [selectedUg, setSelectedUg] = useState<number>(0);
  const { data: inventarios = [], refetch } = trpc.inventario.list.useQuery({ ugId: selectedUg || undefined });
  const [selectedInv, setSelectedInv] = useState<number | null>(null);
  const { data: coletas = [], refetch: refetchColetas } = trpc.inventario.coletas.useQuery(
    { inventarioId: selectedInv! }, { enabled: !!selectedInv }
  );
  const { data: bensPendentes = [] } = trpc.inventario.bensPendentes.useQuery(
    { inventarioId: selectedInv! }, { enabled: !!selectedInv }
  );

  const criarMut = trpc.inventario.criar.useMutation({ onSuccess: () => { refetch(); setOpenCriar(false); toast.success("Inventário criado"); } });
  const iniciarMut = trpc.inventario.iniciarColeta.useMutation({ onSuccess: () => { refetch(); toast.success("Coleta iniciada"); } });
  const concluirMut = trpc.inventario.concluir.useMutation({ onSuccess: (d) => { refetch(); toast.success(`Inventário concluído — ${d.divergencias} divergência(s)`); } });
  const coletarMut = trpc.inventario.registrarColeta.useMutation({ onSuccess: () => { refetchColetas(); setOpenColetar(false); toast.success("Coleta registrada"); } });

  const [openCriar, setOpenCriar] = useState(false);
  const [openColetar, setOpenColetar] = useState(false);
  const [openQr, setOpenQr] = useState(false);
  const [selectedBemId, setSelectedBemId] = useState<number | null>(null);
  const { data: qrData } = trpc.inventario.gerarQrCode.useQuery(
    { bemId: selectedBemId! }, { enabled: !!selectedBemId && openQr }
  );

  const [criarForm, setCriarForm] = useState({ ugId: 0, nome: "", dataInicio: new Date().toISOString().split("T")[0] });
  const [coletarForm, setColetarForm] = useState({
    bemId: 0,
    situacaoEncontrada: "encontrado" as "encontrado" | "nao_encontrado" | "divergencia_localizacao" | "divergencia_estado",
    localizacaoEncontrada: "",
    observacao: "",
    metodoColeta: "manual" as "manual" | "qrcode",
  });

  const invAtual = inventarios.find(i => i.id === selectedInv);
  const progresso = invAtual ? Math.round((invAtual.totalColetados / Math.max(invAtual.totalBens, 1)) * 100) : 0;

  function downloadQr() {
    if (!qrData) return;
    const a = document.createElement("a");
    a.href = qrData.qrDataUrl;
    a.download = `QR_${qrData.bem.tombamento}.png`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventário Cíclico</h1>
          <p className="text-muted-foreground text-sm">Coleta por QR Code ou manual, com controle de divergências</p>
        </div>
        <Button onClick={() => setOpenCriar(true)}><Plus size={16} className="mr-2" />Novo Inventário</Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="w-72">
          <Select value={String(selectedUg)} onValueChange={v => setSelectedUg(parseInt(v))}>
            <SelectTrigger><SelectValue placeholder="Filtrar por UG" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todas as UGs</SelectItem>
              {ugs.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de inventários */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Inventários</h2>
          {inventarios.length === 0 && (
            <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm">
              Nenhum inventário criado
            </div>
          )}
          {inventarios.map(inv => (
            <div key={inv.id}
              onClick={() => setSelectedInv(inv.id)}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedInv === inv.id ? "ring-2 ring-primary border-primary" : "hover:shadow-sm"}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium text-sm">{inv.nome}</div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${invSituacaoColor[inv.situacao]}`}>{inv.situacao.replace("_", " ")}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-2">{inv.totalColetados}/{inv.totalBens} bens coletados</div>
              <Progress value={Math.round((inv.totalColetados / Math.max(inv.totalBens, 1)) * 100)} className="h-1.5" />
              {inv.totalDivergencias > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                  <AlertTriangle size={12} />{inv.totalDivergencias} divergência(s)
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Painel do inventário selecionado */}
        <div className="lg:col-span-2">
          {!selectedInv ? (
            <div className="border rounded-lg p-12 text-center text-muted-foreground">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
              <p>Selecione um inventário para ver os detalhes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Ações do inventário */}
              <div className="flex items-center gap-2">
                {invAtual?.situacao === "aberto" && (
                  <Button size="sm" onClick={() => iniciarMut.mutate({ id: selectedInv })}>
                    <Play size={14} className="mr-1" />Iniciar Coleta
                  </Button>
                )}
                {invAtual?.situacao === "em_coleta" && (
                  <>
                    <Button size="sm" onClick={() => { setColetarForm(f => ({ ...f, bemId: 0 })); setOpenColetar(true); }}>
                      <CheckCircle size={14} className="mr-1" />Registrar Coleta
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => concluirMut.mutate({ id: selectedInv })}>
                      <Flag size={14} className="mr-1" />Concluir Inventário
                    </Button>
                  </>
                )}
              </div>

              {/* Progresso */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progresso da Coleta</span>
                    <span className="text-sm font-bold text-primary">{progresso}%</span>
                  </div>
                  <Progress value={progresso} className="h-3" />
                  <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                    <div className="bg-muted rounded-lg p-2">
                      <div className="text-lg font-bold">{invAtual?.totalBens ?? 0}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-green-700">{invAtual?.totalColetados ?? 0}</div>
                      <div className="text-xs text-green-600">Coletados</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-amber-700">{invAtual?.totalDivergencias ?? 0}</div>
                      <div className="text-xs text-amber-600">Divergências</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="coletas">
                <TabsList>
                  <TabsTrigger value="coletas">Coletas Realizadas</TabsTrigger>
                  <TabsTrigger value="pendentes">Bens Pendentes ({bensPendentes.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="coletas" className="mt-3">
                  <div className="border rounded-lg overflow-hidden bg-card">
                    <Table>
                      <TableHeader><TableRow><TableHead>Tombamento</TableHead><TableHead>Descrição</TableHead><TableHead>Situação</TableHead><TableHead>Método</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {coletas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhuma coleta registrada</TableCell></TableRow>}
                        {coletas.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-sm">{c.tombamento}</TableCell>
                            <TableCell className="max-w-xs truncate text-sm">{c.descricao}</TableCell>
                            <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${situacaoColor[c.situacaoEncontrada]}`}>{c.situacaoEncontrada.replace(/_/g, " ")}</span></TableCell>
                            <TableCell><Badge variant="outline">{c.metodoColeta}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="pendentes" className="mt-3">
                  <div className="border rounded-lg overflow-hidden bg-card">
                    <Table>
                      <TableHeader><TableRow><TableHead>Tombamento</TableHead><TableHead>Descrição</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {bensPendentes.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Todos os bens foram coletados!</TableCell></TableRow>}
                        {bensPendentes.map(b => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-sm">{b.tombamento}</TableCell>
                            <TableCell className="max-w-xs truncate text-sm">{b.descricao}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedBemId(b.id); setOpenQr(true); }}>
                                <QrCode size={14} className="mr-1" />QR Code
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar Inventário */}
      <Dialog open={openCriar} onOpenChange={setOpenCriar}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Inventário Cíclico</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Unidade Gestora *</Label>
              <Select value={String(criarForm.ugId)} onValueChange={v => setCriarForm(f => ({ ...f, ugId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a UG" /></SelectTrigger>
                <SelectContent>{ugs.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Nome do Inventário *</Label>
              <Input value={criarForm.nome} onChange={e => setCriarForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Inventário 2026 — 1º Semestre" />
            </div>
            <div className="space-y-1"><Label>Data de Início</Label>
              <Input type="date" value={criarForm.dataInicio} onChange={e => setCriarForm(f => ({ ...f, dataInicio: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCriar(false)}>Cancelar</Button>
            <Button onClick={() => { if (!criarForm.ugId || !criarForm.nome) return toast.error("Preencha UG e Nome"); criarMut.mutate(criarForm); }} disabled={criarMut.isPending}>Criar Inventário</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Registrar Coleta */}
      <Dialog open={openColetar} onOpenChange={setOpenColetar}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Coleta</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Bem *</Label>
              <Select value={String(coletarForm.bemId)} onValueChange={v => setColetarForm(f => ({ ...f, bemId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o bem" /></SelectTrigger>
                <SelectContent>{bensPendentes.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.tombamento} — {b.descricao}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Situação Encontrada *</Label>
              <Select value={coletarForm.situacaoEncontrada} onValueChange={v => setColetarForm(f => ({ ...f, situacaoEncontrada: v as typeof coletarForm.situacaoEncontrada }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="encontrado">Encontrado</SelectItem>
                  <SelectItem value="nao_encontrado">Não Encontrado</SelectItem>
                  <SelectItem value="divergencia_localizacao">Divergência de Localização</SelectItem>
                  <SelectItem value="divergencia_estado">Divergência de Estado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Localização Encontrada</Label>
              <Input value={coletarForm.localizacaoEncontrada} onChange={e => setColetarForm(f => ({ ...f, localizacaoEncontrada: e.target.value }))} placeholder="Sala, andar, setor..." />
            </div>
            <div className="space-y-1"><Label>Observação</Label>
              <Input value={coletarForm.observacao} onChange={e => setColetarForm(f => ({ ...f, observacao: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenColetar(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!coletarForm.bemId || !selectedInv) return toast.error("Selecione o bem");
              coletarMut.mutate({ inventarioId: selectedInv, ...coletarForm });
            }} disabled={coletarMut.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal QR Code */}
      <Dialog open={openQr} onOpenChange={setOpenQr}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><QrCode size={18} />QR Code do Bem</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrData ? (
              <>
                <img src={qrData.qrDataUrl} alt="QR Code" className="w-48 h-48 border rounded-lg" />
                <div className="text-center">
                  <div className="font-mono font-bold text-lg">{qrData.bem.tombamento}</div>
                  <div className="text-sm text-muted-foreground">{qrData.bem.descricao}</div>
                </div>
                <Button onClick={downloadQr} className="w-full">Baixar QR Code (PNG)</Button>
              </>
            ) : (
              <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

