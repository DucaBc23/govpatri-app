import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Hash } from "lucide-react";

const ENTIDADES = ["bens_moveis", "bens_imoveis", "unidades_gestoras", "orgaos", "almox_itens", "estoque", "eventos_patrimoniais", "workflow_instancias"];

const acaoColor: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  INCORPORACAO: "bg-violet-100 text-violet-700",
};

export default function AuditTrail() {
  const [entidade, setEntidade] = useState<string>("all");
  const { data: logs = [] } = trpc.dashboard.auditoria.list.useQuery({ entidade: entidade === "all" ? undefined : entidade, limit: 100 });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield size={24} className="text-primary" />Trilha de Auditoria</h1>
          <p className="text-muted-foreground text-sm mt-1">Registro imutável com hash SHA-256 de todas as operações patrimoniais</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
          <Hash size={14} />
          <span>SHA-256 ativo — trilha imutável</span>
        </div>
      </div>

      <div className="max-w-xs">
        <Select value={entidade} onValueChange={setEntidade}>
          <SelectTrigger><SelectValue placeholder="Filtrar por entidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as entidades</SelectItem>
            {ENTIDADES.map(e => <SelectItem key={e} value={e}>{e.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Hash SHA-256</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro na trilha de auditoria</TableCell></TableRow>}
            {logs.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-sm whitespace-nowrap">{new Date(l.createdAt).toLocaleString("pt-BR")}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acaoColor[l.acao.split("_")[0]!] ?? "bg-gray-100 text-gray-700"}`}>{l.acao}</span>
                </TableCell>
                <TableCell className="text-sm font-mono">{l.entidade}</TableCell>
                <TableCell className="text-sm">{l.entidadeId ?? "—"}</TableCell>
                <TableCell>
                  <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {l.hashSha256.substring(0, 16)}...
                  </code>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
