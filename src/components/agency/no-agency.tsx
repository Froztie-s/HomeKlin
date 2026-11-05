import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// An agency sign-in that no partner agency row points to yet (agencies.user_id): it has nothing of its
// own to show or change, so the page says what to do instead of showing empty lists.
export function NoAgency({ title, body }: { title: string; body: string }) {
  return (
    <EmptyState icon={Building2} title={title}>
      {body}
    </EmptyState>
  );
}
