"use client";

import { useState, useEffect } from "react";
import {
  LayoutTemplate,
  X,
  Check,
  Code2,
  Megaphone,
  Package,
  Palette,
  Users,
  FolderKanban,
  ChevronRight,
  Layers,
  StickyNote,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTemplates, getTemplateById, type TemplateSummary, type TemplateDetail } from "@/actions/template-actions";

interface TemplatePickerProps {
  onSelect: (template: TemplateSummary) => void;
  onClear?: () => void;
  selectedId?: string;
}

// ── Category config with gradients and icons ────────────────────────────────

interface CategoryStyle {
  gradient: string;
  bg: string;
  text: string;
  border: string;
  badge: string;
  icon: React.ElementType;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  Engineering: {
    gradient: "from-[#7B2FF7] to-[#4F46E5]",
    bg: "bg-[#7B2FF7]/8 dark:bg-[#7B2FF7]/15",
    text: "text-[#7B2FF7] dark:text-[#A78BFA]",
    border: "border-[#7B2FF7]/20 dark:border-[#7B2FF7]/30",
    badge: "bg-[#7B2FF7]/10 text-[#7B2FF7] dark:bg-[#7B2FF7]/20 dark:text-[#A78BFA]",
    icon: Code2,
  },
  Marketing: {
    gradient: "from-[#EC4899] to-[#F43F5E]",
    bg: "bg-[#EC4899]/8 dark:bg-[#EC4899]/15",
    text: "text-[#EC4899] dark:text-[#F9A8D4]",
    border: "border-[#EC4899]/20 dark:border-[#EC4899]/30",
    badge: "bg-[#EC4899]/10 text-[#EC4899] dark:bg-[#EC4899]/20 dark:text-[#F9A8D4]",
    icon: Megaphone,
  },
  Product: {
    gradient: "from-[#8B5CF6] to-[#A855F7]",
    bg: "bg-[#8B5CF6]/8 dark:bg-[#8B5CF6]/15",
    text: "text-[#8B5CF6] dark:text-[#C4B5FD]",
    border: "border-[#8B5CF6]/20 dark:border-[#8B5CF6]/30",
    badge: "bg-[#8B5CF6]/10 text-[#8B5CF6] dark:bg-[#8B5CF6]/20 dark:text-[#C4B5FD]",
    icon: Package,
  },
  Design: {
    gradient: "from-[#F59E0B] to-[#EF4444]",
    bg: "bg-[#F59E0B]/8 dark:bg-[#F59E0B]/15",
    text: "text-[#D97706] dark:text-[#FCD34D]",
    border: "border-[#F59E0B]/20 dark:border-[#F59E0B]/30",
    badge: "bg-[#F59E0B]/10 text-[#D97706] dark:bg-[#F59E0B]/20 dark:text-[#FCD34D]",
    icon: Palette,
  },
  HR: {
    gradient: "from-[#10B981] to-[#059669]",
    bg: "bg-[#10B981]/8 dark:bg-[#10B981]/15",
    text: "text-[#059669] dark:text-[#6EE7B7]",
    border: "border-[#10B981]/20 dark:border-[#10B981]/30",
    badge: "bg-[#10B981]/10 text-[#059669] dark:bg-[#10B981]/20 dark:text-[#6EE7B7]",
    icon: Users,
  },
  General: {
    gradient: "from-[#6B7280] to-[#4B5563]",
    bg: "bg-[#6B7280]/8 dark:bg-[#6B7280]/15",
    text: "text-[#6B7280] dark:text-[#9CA3AF]",
    border: "border-[#6B7280]/20 dark:border-[#6B7280]/30",
    badge: "bg-[#6B7280]/10 text-[#6B7280] dark:bg-[#6B7280]/20 dark:text-[#9CA3AF]",
    icon: FolderKanban,
  },
};

function getStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.General;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TemplatePicker({ onSelect, onClear, selectedId }: TemplatePickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDetail | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  // Fetch templates when expanded
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data, error } = await getTemplates();
        if (cancelled) return;
        if (!error && data) setTemplates(data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [expanded]);

  const categories = ["All", ...Array.from(new Set(templates.map((t) => t.category))).sort()];
  const filtered = selectedCategory === "All" ? templates : templates.filter((t) => t.category === selectedCategory);

  // Load template preview
  const handlePreview = async (templateId: string) => {
    setLoadingPreview(true);
    try {
      const { data } = await getTemplateById(templateId);
      if (data) setPreviewTemplate(data);
    } catch {
      // silent
    } finally {
      setLoadingPreview(false);
    }
  };

  // ── Selected state (collapsed) ──────────────────────────────────────────
  if (!expanded && selectedId && selectedTemplate) {
    const style = getStyle(selectedTemplate.category);
    const Icon = style.icon;
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-xl border", style.border, style.bg)}>
        <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0", style.gradient)}>
          <Icon className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{selectedTemplate.title}</p>
          <p className="text-xs text-muted-foreground">{selectedTemplate.listCount} lists &middot; {selectedTemplate.category}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
          >
            Change
          </button>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Clear template"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Collapsed state (no selection) ──────────────────────────────────────
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-accent/40 transition-all duration-200 group"
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#7B2FF7] to-[#C01CC4] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(123,47,247,0.25)]">
          <LayoutTemplate className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-foreground">Start from a Template</p>
          <p className="text-xs text-muted-foreground">Pre-built boards with lists &amp; cards</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>
    );
  }

  // ── Template preview panel ──────────────────────────────────────────────
  if (previewTemplate) {
    const style = getStyle(previewTemplate.category);
    const Icon = style.icon;
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Preview header with gradient */}
        <div className={cn("bg-gradient-to-r p-4 relative", style.gradient)}>
          <button
            type="button"
            onClick={() => setPreviewTemplate(null)}
            className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            aria-label="Back to templates"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="text-center pt-2">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-2">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">{previewTemplate.title}</h3>
            {previewTemplate.description && (
              <p className="text-xs text-white/80 mt-1 max-w-sm mx-auto">{previewTemplate.description}</p>
            )}
          </div>
        </div>

        {/* Lists preview */}
        <div className="p-4 space-y-2.5 max-h-48 overflow-y-auto">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {previewTemplate.lists.length} Lists included
          </p>
          {previewTemplate.lists.map((list) => (
            <div key={list.id} className={cn("rounded-lg border p-3", style.border, style.bg)}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Layers className={cn("h-3.5 w-3.5", style.text)} />
                  <span className="text-sm font-semibold text-foreground">{list.title}</span>
                </div>
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", style.badge)}>
                  {list.cards.length} {list.cards.length === 1 ? "card" : "cards"}
                </span>
              </div>
              {list.cards.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {list.cards.map((card) => (
                    <span
                      key={card.id}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-background border border-border text-muted-foreground"
                    >
                      {card.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Use template button */}
        <div className="border-t border-border p-3 flex gap-2">
          <button
            type="button"
            onClick={() => setPreviewTemplate(null)}
            className="flex-1 h-9 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect(previewTemplate);
              setPreviewTemplate(null);
              setExpanded(false);
            }}
            className={cn(
              "flex-1 h-9 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-1.5",
              "bg-gradient-to-r shadow-lg hover:shadow-xl hover:-translate-y-px transition-all duration-200",
              style.gradient
            )}
          >
            <Check className="h-3.5 w-3.5" />
            Use This Template
          </button>
        </div>
      </div>
    );
  }

  // ── Expanded gallery ────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7B2FF7] to-[#C01CC4] flex items-center justify-center">
            <LayoutTemplate className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Choose a Template</h3>
        </div>
        <button
          type="button"
          onClick={() => { setExpanded(false); setPreviewTemplate(null); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close templates"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category filter pills */}
      <div className="px-4 py-2.5 border-b border-border flex gap-1.5 overflow-x-auto scrollbar-hide">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          const style = cat !== "All" ? getStyle(cat) : null;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0",
                isActive
                  ? cat === "All"
                    ? "bg-gradient-to-r from-[#7B2FF7] to-[#C01CC4] text-white shadow-[0_2px_8px_rgba(123,47,247,0.3)]"
                    : cn("bg-gradient-to-r text-white shadow-lg", style?.gradient)
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Template cards */}
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        {loading && (
          <div className="py-10 flex flex-col items-center justify-center gap-2">
            <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Loading templates...</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="py-10 flex flex-col items-center justify-center gap-2">
            <LayoutTemplate className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground text-center">
              No templates found in this category.
            </p>
            <p className="text-xs text-muted-foreground/60 text-center">
              Templates are seeded by your admin.
            </p>
          </div>
        )}

        {!loading && filtered.map((template) => {
          const style = getStyle(template.category);
          const Icon = style.icon;
          const isSelected = selectedId === template.id;

          return (
            <div
              key={template.id}
              className={cn(
                "group relative rounded-xl border overflow-hidden transition-all duration-200",
                isSelected
                  ? cn(style.border, "ring-2", `ring-${style.text.split("-")[1]}/30`, "shadow-md")
                  : "border-border hover:border-primary/30 hover:shadow-md"
              )}
            >
              {/* Gradient accent bar */}
              <div className={cn("h-1.5 bg-gradient-to-r", style.gradient)} />

              <div className="p-3 flex items-start gap-3">
                {/* Category icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md",
                  style.gradient
                )}>
                  <Icon className="h-5 w-5 text-white" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-foreground truncate">{template.title}</span>
                    {isSelected && (
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", style.badge)}>
                        Selected
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{template.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className={cn("text-[11px] font-semibold flex items-center gap-1", style.text)}>
                      <Layers className="h-3 w-3" />
                      {template.listCount} {template.listCount === 1 ? "list" : "lists"}
                    </span>
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", style.badge)}>
                      {template.category}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(template.id);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label={`Preview ${template.title}`}
                    title="Preview"
                  >
                    {loadingPreview ? (
                      <div className="h-3.5 w-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(template);
                      setExpanded(false);
                    }}
                    className={cn(
                      "h-8 px-3 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1",
                      "bg-gradient-to-r shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-200",
                      style.gradient
                    )}
                  >
                    {isSelected ? <Check className="h-3 w-3" /> : <StickyNote className="h-3 w-3" />}
                    {isSelected ? "Selected" : "Use"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
