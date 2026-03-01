"use client";

import { useState, useEffect } from "react";
import { LayoutTemplate, X, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTemplates, type TemplateSummary } from "@/actions/template-actions";

interface TemplatePickerProps {
  onSelect: (template: TemplateSummary) => void;
  onClear?: () => void;
  selectedId?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Marketing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Product: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Design: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  HR: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  General: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export function TemplatePicker({ onSelect, onClear, selectedId }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const selectedTemplate = templates.find((t) => t.id === selectedId);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data, error } = await getTemplates();
        if (cancelled) return;
        setLoading(false);
        if (!error && data) setTemplates(data);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [open]);

  const categories = ["All", ...Array.from(new Set(templates.map((t) => t.category))).sort()];
  const filtered =
    selectedCategory === "All" ? templates : templates.filter((t) => t.category === selectedCategory);

  return (
    <div className="relative">
      {/* Trigger row */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-2 text-xs"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          {selectedId ? `Template: ${selectedTemplate?.title ?? ""}` : "Use Template"}
        </Button>
        {selectedId && onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="gap-1 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-xl max-h-[70vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-base">Board Templates</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Category tabs */}
            <div className="px-5 py-2.5 border-b flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading && (
                <div className="py-12 flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
              {!loading &&
                filtered.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      onSelect(template);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 p-3 rounded-lg border text-left transition-all ${
                      selectedId === template.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/40 hover:bg-muted"
                    }`}
                  >
                    {/* Icon */}
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <LayoutTemplate className="h-5 w-5 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{template.title}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.General
                          }`}
                        >
                          {template.category}
                        </span>
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {template.description}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {template.listCount} {template.listCount === 1 ? "list" : "lists"}
                      </p>
                    </div>

                    {selectedId === template.id ? (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                ))}
              {!loading && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No templates in this category.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
