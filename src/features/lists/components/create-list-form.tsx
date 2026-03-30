"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/features/shared/components/button";
import { createList, type CreateListInput } from "@/lib/api/lists";

interface CreateListFormProps {
  onCreated?: () => void;
  onCancel?: () => void;
}

export function CreateListForm({ onCreated, onCancel }: CreateListFormProps) {
  const t = useTranslations("lists");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateListInput = {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      };
      await createList(data);
      onCreated?.();
    } catch {
      setError("Failed to create list. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-1">
        <span className="text-xs text-muted font-medium uppercase tracking-wide">
          {t("name")}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("name")}
          maxLength={100}
          required
          autoFocus
          className="rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2 focus:outline-none focus:border-accent/50"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-xs text-muted font-medium uppercase tracking-wide">
          {t("description")}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("description")}
          maxLength={500}
          rows={2}
          className="rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2 focus:outline-none focus:border-accent/50 resize-none"
        />
      </label>

      {error != null && (
        <p className="text-sm text-error">{error}</p>
      )}

      <div className="flex items-center gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
        )}
        <Button type="submit" size="sm" loading={isSubmitting} disabled={!name.trim()}>
          {isSubmitting ? t("saving") : t("create")}
        </Button>
      </div>
    </form>
  );
}
