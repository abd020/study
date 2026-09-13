import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page introuvable"
      description="Le lien que tu as suivi ne correspond à aucune page de Revia."
      action={
        <Button asChild>
          <Link to="/">Retour au dashboard</Link>
        </Button>
      }
      className="mt-10"
    />
  );
}
