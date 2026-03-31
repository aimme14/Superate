import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { useThemeContext } from "@/context/ThemeContext";
import { useNotification } from "@/hooks/ui/useNotification";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GlobalPhaseAuthorization } from "@/interfaces/phase.interface";
import { globalPhaseAuthorizationService } from "@/services/phase/globalPhaseAuthorization.service";
import type { ThemeContextProps } from "@/interfaces/context.interface";
import { cn } from "@/lib/utils";

interface AdminGlobalPhaseSettingsProps extends ThemeContextProps {}

export default function AdminGlobalPhaseSettings({ theme }: AdminGlobalPhaseSettingsProps) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();

  const { theme: contextTheme } = useThemeContext();
  const effectiveTheme = useMemo(() => theme ?? contextTheme ?? "light", [theme, contextTheme]);

  const { data, isLoading } = useQuery({
    queryKey: ["globalPhaseAuthorization"],
    queryFn: () => globalPhaseAuthorizationService.getFlags(),
    staleTime: Infinity,
    gcTime: 30 * 24 * 60 * 60 * 1000,
  });

  const [flags, setFlags] = useState<GlobalPhaseAuthorization>({
    faseI: data?.faseI ?? true,
    faseII: data?.faseII ?? false,
    faseIII: data?.faseIII ?? false,
  });

  useEffect(() => {
    if (!data) return;
    setFlags({
      faseI: data.faseI,
      faseII: data.faseII,
      faseIII: data.faseIII,
    });
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (next: GlobalPhaseAuthorization) => {
      if (!user?.uid) throw new Error("Usuario no autenticado");
      await globalPhaseAuthorizationService.setFlags(next, user.uid);
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["globalPhaseAuthorization"] });
      notifySuccess({
        title: "Fases actualizadas",
        message: "La autorización global de fases se guardó correctamente.",
      });
    },
    onError: (err) => {
      notifyError({
        title: "Error al actualizar",
        message: err instanceof Error ? err.message : "No se pudo guardar la configuración.",
      });
    },
  });

  const onToggle = async (key: keyof GlobalPhaseAuthorization, value: boolean) => {
    const next = { ...flags, [key]: value };
    const prev = flags;
    setFlags(next);
    try {
      await updateMutation.mutateAsync(next);
    } catch {
      // Revertir UI si falla el guardado
      setFlags(prev);
    }
  };

  return (
    <Card className={cn(effectiveTheme === "dark" ? "bg-zinc-900 border-zinc-700" : "bg-white border-gray-200")}>
      <CardHeader>
        <CardTitle className={cn(effectiveTheme === "dark" ? "text-white" : "text-gray-900")}>
          Autorización global de fases
        </CardTitle>
        <CardDescription className={cn(effectiveTheme === "dark" ? "text-gray-400" : "text-gray-600")}>
          Habilita o bloquea Fase I, Fase II y Fase III para todos los estudiantes.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className={cn("flex items-center justify-between rounded-lg border p-4", effectiveTheme === "dark" ? "border-zinc-700 bg-zinc-800/50" : "border-gray-200 bg-gray-50")}>
              <div className="space-y-1">
                <Label className={cn(effectiveTheme === "dark" ? "text-white" : "text-gray-900")}>Fase I</Label>
                <p className={cn("text-sm", effectiveTheme === "dark" ? "text-gray-400" : "text-gray-600")}>
                  Permite iniciar la evaluación (diagnóstico).
                </p>
              </div>
              <Switch
                checked={flags.faseI}
                onCheckedChange={(v) => void onToggle("faseI", v)}
              />
            </div>

            <div className={cn("flex items-center justify-between rounded-lg border p-4", effectiveTheme === "dark" ? "border-zinc-700 bg-zinc-800/50" : "border-gray-200 bg-gray-50")}>
              <div className="space-y-1">
                <Label className={cn(effectiveTheme === "dark" ? "text-white" : "text-gray-900")}>Fase II</Label>
                <p className={cn("text-sm", effectiveTheme === "dark" ? "text-gray-400" : "text-gray-600")}>
                  Permite la evaluación por refuerzo (cuando la fase anterior esté completada).
                </p>
              </div>
              <Switch
                checked={flags.faseII}
                onCheckedChange={(v) => void onToggle("faseII", v)}
              />
            </div>

            <div className={cn("flex items-center justify-between rounded-lg border p-4", effectiveTheme === "dark" ? "border-zinc-700 bg-zinc-800/50" : "border-gray-200 bg-gray-50")}>
              <div className="space-y-1">
                <Label className={cn(effectiveTheme === "dark" ? "text-white" : "text-gray-900")}>Fase III</Label>
                <p className={cn("text-sm", effectiveTheme === "dark" ? "text-gray-400" : "text-gray-600")}>
                  Permite el simulacro ICFES final (cuando la fase anterior esté completada).
                </p>
              </div>
              <Switch
                checked={flags.faseIII}
                onCheckedChange={(v) => void onToggle("faseIII", v)}
              />
            </div>

            <div className="pt-2">
              <Button
                variant="secondary"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["globalPhaseAuthorization"] })}
              >
                Refrescar estado
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

