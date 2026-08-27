import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormError({ error, mono = false }: { error: string | null; mono?: boolean }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription className={mono ? "whitespace-pre-wrap font-mono text-xs" : undefined}>
        {error}
      </AlertDescription>
    </Alert>
  );
}
