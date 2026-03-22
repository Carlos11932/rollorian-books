import { Button } from "@/features/shared/components/button";
import type { DeleteState } from "@/features/books/hooks/use-delete-book";

interface DeleteConfirmationProps {
  deleteState: DeleteState;
  disabled?: boolean;
  onRequest: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmation({
  deleteState,
  disabled = false,
  onRequest,
  onConfirm,
  onCancel,
}: DeleteConfirmationProps) {
  const isDeleting = deleteState === "deleting";

  if (deleteState === "confirming") {
    return (
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="md"
          loading={isDeleting}
          disabled={isDeleting}
          onClick={onConfirm}
          className="border-danger/40 text-danger hover:bg-danger/10"
        >
          {isDeleting ? "Removing..." : "Confirm remove"}
        </Button>
        <Button
          variant="ghost"
          size="md"
          disabled={isDeleting}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="md"
      disabled={disabled}
      onClick={onRequest}
      className="text-muted hover:text-danger hover:border-danger/30"
    >
      Remove book
    </Button>
  );
}
