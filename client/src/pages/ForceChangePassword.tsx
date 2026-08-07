/**
 * Página de troca obrigatória de senha.
 * Exibida quando o usuário tem mustChangePassword=true no login.
 * Não permite navegar para outra rota até concluir a troca.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";

export default function ForceChangePassword() {
  const [, navigate] = useLocation();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

  const redefinir = trpc.auth.redefinirSenhaObrigatoria.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso. Faça login novamente.");
      // Limpar cookie e redirecionar para login
      navigate("/login");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      toast.error("As senhas não coincidem.");
      return;
    }
    redefinir.mutate({ novaSenha });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d2b4e]">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="h-12 w-12 text-amber-500" />
          </div>
          <CardTitle className="text-xl">Troca de Senha Obrigatória</CardTitle>
          <CardDescription>
            Por motivo de segurança, você deve definir uma nova senha antes de continuar.
            A nova senha deve ter no mínimo 8 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="novaSenha">Nova Senha</Label>
              <Input
                id="novaSenha"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar">Confirmar Nova Senha</Label>
              <Input
                id="confirmar"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={redefinir.isPending}
            >
              {redefinir.isPending ? "Redefinindo..." : "Redefinir Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
