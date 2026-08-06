import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, QrCode, Package, TrendingDown, History, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const situacaoColor: Record<string, string> = {
  ativo: "bg-green-100 text-green-700",
  em_manutencao: "bg-yellow-100 text-yellow-700",
  inservivel: "bg-red-100 text-red-700",
  baixado: "bg-gray-100 text-gray-600",
  cedido: "bg-blue-100 text-blue-700",
};

const tipoMovLabel: Record<string, string> = {
  incorporacao: "Incorporação",
  transferencia: "Transferência",
  cessao: "Cessão",
  baixa: "Baixa",
  reavaliacao: "Reavaliação",
  manutencao: "Manutenção",
};

function downloadPdf(base64: string, filename: string) {
  const a = document.createElement("a");
  a.href = `data:application/pdf;base64,${base64}`;
  a.download = filename;
  a.click();
}

export default function DetalhesBem() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const bemId = parseInt(params.id ?? "0");

  const { data: bem, isLoading } = trpc.bensMoveis.getById.useQuery({ id: bemId }, { enabled: !!bemId });
  const termoMut = trpc.termosPdf.emitir.useMutation({
    onSuccess: (d) => { downloadPdf(d.pdfBase64, d.filename); toast.success(`Termo ${d.numero} gerado`); },
    onError: (e) => toast.error(e.message),
  });

  const [openQr, setOpenQr] = useState(false);
  const { data: qrData } = trpc.inventario.gerarQrCode.useQuery(
    { bemId }, { enabled: openQr && !!bemId }
  );

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!bem) return (
    <div className="text-center py-20 text-muted-foreground">Bem não encontrado.</div>
  );

  const valorAquisicao = parseFloat(String(bem.valorAquisicao));
  const valorAtual = parseFloat(String(bem.valorAtual ?? bem.valorAquisicao));
  const totalDepreciado = parseFloat(bem.totalDepreciado ?? "0");
  const percDepreciado = valorAquisicao > 0 ? Math.round((totalDepreciado / valorAquisicao) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/bens-moveis")}>
          <ArrowLeft size={16} className="mr-1" />Voltar
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{bem.descricao}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${situacaoColor[bem.situacao] ?? ""}`}>
              {bem.situacao.replace("_", " ")}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{bem.numeroTombamento}</span>
            {bem.classeNome && <Badge variant="outline">{bem.classeNome}</Badge>}
            {bem.marca && <span>{bem.marca} {bem.modelo}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpenQr(true)}>
            <QrCode size={14} className="mr-1" />QR Code
          </Button>
          <Button size="sm" onClick={() => termoMut.mutate({ bemId })} disabled={termoMut.isPending}>
            <FileText size={14} className="mr-1" />Emitir Termo
          </Button>
        </div>
      </div>

      {/* Cards de resumo financeiro */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Valor de Aquisição</div>
            <div className="text-lg font-bold">R$ {valorAquisicao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Valor Atual</div>
            <div className="text-lg font-bold text-primary">R$ {valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Depreciação Acumulada</div>
            <div className="text-lg font-bold text-amber-600">R$ {totalDepreciado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-muted-foreground">{percDepreciado}% do valor original</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Taxa de Depreciação</div>
            <div className="text-lg font-bold">{bem.taxaDepreciacaoAnual ? `${(parseFloat(String(bem.taxaDepreciacaoAnual)) * 100).toFixed(0)}% a.a.` : "—"}</div>
            <div className="text-xs text-muted-foreground">Vida útil: {bem.vidaUtilAnos ?? "—"} anos</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados"><Package size={14} className="mr-1" />Dados Cadastrais</TabsTrigger>
          <TabsTrigger value="movimentacoes"><History size={14} className="mr-1" />Movimentações ({bem.movimentacoes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="depreciacao"><TrendingDown size={14} className="mr-1" />Depreciação ({bem.depreciacoes?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {[
                  ["Número de Tombamento", bem.numeroTombamento],
                  ["Descrição", bem.descricao],
                  ["Marca", bem.marca ?? "—"],
                  ["Modelo", bem.modelo ?? "—"],
                  ["Número de Série", bem.numeroSerie ?? "—"],
                  ["Ano de Fabricação", bem.anoFabricacao ?? "—"],
                  ["Data de Aquisição", bem.dataAquisicao ? new Date(bem.dataAquisicao).toLocaleDateString("pt-BR") : "—"],
                  ["Classe PCASP", bem.classeNome ?? "—"],
                  ["Situação", bem.situacao.replace("_", " ")],
                  ["Observações", bem.observacoes ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="border-b pb-3">
                    <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                    <div className="text-sm font-medium">{String(value)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Justificativa</TableHead>
                    <TableHead>Documento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bem.movimentacoes?.length ?? 0) === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma movimentação registrada</TableCell></TableRow>
                  )}
                  {bem.movimentacoes?.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{m.dataMovimentacao ? new Date(m.dataMovimentacao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{tipoMovLabel[m.tipo] ?? m.tipo}</Badge></TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{m.justificativa ?? "—"}</TableCell>
                      <TableCell className="text-sm font-mono">{m.documentoRef ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depreciacao" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Valor Depreciado</TableHead>
                    <TableHead className="text-right">Acumulado</TableHead>
                    <TableHead className="text-right">Valor Residual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bem.depreciacoes?.length ?? 0) === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma depreciação registrada</TableCell></TableRow>
                  )}
                  {bem.depreciacoes?.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm font-mono">Período #{d.periodoId}</TableCell>
                      <TableCell className="text-right text-sm text-amber-600">R$ {parseFloat(String(d.valorDepreciado)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-sm text-red-600">R$ {parseFloat(String(d.valorAcumulado)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-sm font-medium">R$ {parseFloat(String(d.valorResidual)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal QR Code */}
      <Dialog open={openQr} onOpenChange={setOpenQr}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><QrCode size={18} />QR Code — {bem.numeroTombamento}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrData ? (
              <>
                <img src={qrData.qrDataUrl} alt="QR Code" className="w-48 h-48 border rounded-lg" />
                <div className="text-center text-sm text-muted-foreground">{bem.descricao}</div>
                <Button className="w-full" onClick={() => {
                  const a = document.createElement("a");
                  a.href = qrData.qrDataUrl;
                  a.download = `QR_${bem.numeroTombamento}.png`;
                  a.click();
                }}>Baixar PNG</Button>
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
