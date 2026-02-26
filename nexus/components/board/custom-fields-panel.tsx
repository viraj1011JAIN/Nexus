"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Settings2,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Link,
  Mail,
  Phone,
  ChevronDown,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getCustomFieldsForBoard,
  getCardCustomFieldValues,
  createCustomField,
  deleteCustomField,
  setCustomFieldValue,
  clearCustomFieldValue,
} from "@/actions/custom-field-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "CHECKBOX"
  | "SELECT"
  | "MULTI_SELECT"
  | "URL"
  | "EMAIL"
  | "PHONE";

interface FieldOption {
  id: string;
  label: string;
  color?: string;
}

interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  isRequired: boolean;
  order: number;
  options?: FieldOption[] | null;
}

interface FieldValue {
  id: string;
  fieldId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  valueBoolean?: boolean | null;
  valueOptions?: string[];
}

interface CustomFieldsPanelProps {
  boardId: string;
  cardId: string;
  isAdmin?: boolean;
}

// ─── Type Icon Map ────────────────────────────────────────────────────────────

const FIELD_ICONS: Record<CustomFieldType, React.ReactNode> = {
  TEXT: <Type className="h-3.5 w-3.5" />,
  NUMBER: <Hash className="h-3.5 w-3.5" />,
  DATE: <Calendar className="h-3.5 w-3.5" />,
  CHECKBOX: <CheckSquare className="h-3.5 w-3.5" />,
  SELECT: <ChevronDown className="h-3.5 w-3.5" />,
  MULTI_SELECT: <List className="h-3.5 w-3.5" />,
  URL: <Link className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  PHONE: <Phone className="h-3.5 w-3.5" />,
};

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  DATE: "Date",
  CHECKBOX: "Checkbox",
  SELECT: "Select",
  MULTI_SELECT: "Multi-select",
  URL: "URL",
  EMAIL: "Email",
  PHONE: "Phone",
};

/** Accent colour per field type — bg / text / border */
const FIELD_TYPE_COLORS: Record<CustomFieldType, { bg: string; text: string; border: string }> = {
  TEXT:         { bg: "#EEF2FF", text: "#4F46E5", border: "#C7D2FE" },
  NUMBER:       { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
  DATE:         { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  CHECKBOX:     { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD" },
  SELECT:       { bg: "#FDF4FF", text: "#7C3AED", border: "#E9D5FF" },
  MULTI_SELECT: { bg: "#FDF4FF", text: "#7C3AED", border: "#E9D5FF" },
  URL:          { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
  EMAIL:        { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3" },
  PHONE:        { bg: "#FEF9C3", text: "#A16207", border: "#FDE047" },
};

// ─── Field Value Input ────────────────────────────────────────────────────────

function FieldValueInput({
  field,
  value,
  onSave,
  onClear,
}: {
  field: CustomField;
  value: FieldValue | undefined;
  onSave: (fieldId: string, data: Partial<FieldValue>) => void;
  onClear: (fieldId: string) => void;
}) {
  const [localVal, setLocalVal] = useState<string>(() => {
    if (!value) return "";
    switch (field.type) {
      case "TEXT":
      case "URL":
      case "EMAIL":
      case "PHONE":
        return value.valueText ?? "";
      case "NUMBER":
        return value.valueNumber?.toString() ?? "";
      case "DATE":
        return value.valueDate ? new Date(value.valueDate).toISOString().split("T")[0] : "";
      default:
        return "";
    }
  });

  const handleTextBlur = () => {
    if (!localVal.trim()) {
      onClear(field.id);
      return;
    }
    const key =
      field.type === "NUMBER"
        ? "valueNumber"
        : field.type === "DATE"
        ? "valueDate"
        : "valueText";
    const val =
      field.type === "NUMBER"
        ? parseFloat(localVal) || 0
        : field.type === "DATE"
        ? (() => { const d = new Date(localVal); return isNaN(d.getTime()) ? undefined : d.toISOString(); })()
        : localVal.trim();
    if (val === undefined) { toast.error("Invalid date value."); return; }
    onSave(field.id, { [key]: val });
  };

  switch (field.type) {
    case "TEXT":
    case "URL":
    case "EMAIL":
    case "PHONE":
      return (
        <Input
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={handleTextBlur}
          placeholder={`Enter ${field.type.toLowerCase()}…`}
          className="h-7 text-xs"
          type={field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : "text"}
        />
      );

    case "NUMBER":
      return (
        <Input
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={handleTextBlur}
          placeholder="0"
          className="h-7 text-xs"
          type="number"
        />
      );

    case "DATE":
      return (
        <Input
          value={localVal}
          onChange={(e) => {
            setLocalVal(e.target.value);
            if (e.target.value) {
              onSave(field.id, { valueDate: new Date(e.target.value).toISOString() });
            } else {
              onClear(field.id);
            }
          }}
          className="h-7 text-xs"
          type="date"
        />
      );

    case "CHECKBOX":
      return (
        <Checkbox
          checked={value?.valueBoolean ?? false}
          onCheckedChange={(checked) => {
            onSave(field.id, { valueBoolean: !!checked });
          }}
        />
      );

    case "SELECT": {
      const options = (field.options ?? []) as FieldOption[];
      return (
        <Select
          value={value?.valueText ?? ""}
          onValueChange={(v) => {
            if (v === "__clear__") { onClear(field.id); return; }
            onSave(field.id, { valueText: v });
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__" className="text-muted-foreground">
              — None —
            </SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={opt.label}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "MULTI_SELECT": {
      const options = (field.options ?? []) as FieldOption[];
      const selected = value?.valueOptions ?? [];
      return (
        <div className="flex flex-wrap gap-1">
          {options.map((opt) => {
            const isSelected = selected.includes(opt.label);
            return (
              <button
                key={opt.id}
                onClick={() => {
                  const next = isSelected
                    ? selected.filter((s) => s !== opt.label)
                    : [...selected, opt.label];
                  if (next.length === 0) onClear(field.id);
                  else onSave(field.id, { valueOptions: next });
                }}
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs border transition-colors",
                  isSelected
                    ? "bg-blue-100 text-blue-700 border-blue-300"
                    : "bg-muted text-muted-foreground border-muted hover:border-blue-300"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }

    default:
      return null;
  }
}

// ─── Create Field Dialog ──────────────────────────────────────────────────────

function CreateFieldDialog({
  boardId,
  open,
  onClose,
  onCreated,
}: {
  boardId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("TEXT");
  const [optionsRaw, setOptionsRaw] = useState(""); // comma-separated
  const [isRequired, setIsRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsOptions = type === "SELECT" || type === "MULTI_SELECT";

  const handleCreate = async () => {
    if (!name.trim()) return;
    if (needsOptions && !optionsRaw.trim()) {
      toast.error("Add at least one option (comma-separated).");
      return;
    }
    setSaving(true);
    try {
      const options = needsOptions
        ? optionsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      const result = await createCustomField(
        name.trim(),
        type,
        boardId,
        options,
        isRequired,
      );
      if (result.error) { toast.error(result.error); return; }
      toast.success("Custom field created.");
      setName(""); setType("TEXT"); setOptionsRaw(""); setIsRequired(false);
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Settings2 className="h-4 w-4 text-indigo-600" />
            </div>
            Create Custom Field
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Field name */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Field name <span className="text-red-500">*</span></label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Story Points, Campaign, Bug ID"
              autoFocus
            />
          </div>

          {/* Field type — visual grid */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Field type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FIELD_TYPE_LABELS) as CustomFieldType[]).map((t) => {
                const colors = FIELD_TYPE_COLORS[t];
                const isSelected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    style={isSelected ? {
                      background: colors.bg,
                      borderColor: colors.border,
                      color: colors.text,
                    } : undefined}
                    className={cn(
                      "relative flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all text-left",
                      isSelected
                        ? "shadow-sm ring-1 ring-offset-0"
                        : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/50",
                    )}
                  >
                    <span style={isSelected ? { color: colors.text } : undefined}>
                      {FIELD_ICONS[t]}
                    </span>
                    {FIELD_TYPE_LABELS[t]}
                    {isSelected && (
                      <Check className="h-3 w-3 absolute top-1.5 right-1.5" style={{ color: colors.text }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options (for SELECT / MULTI_SELECT) */}
          {needsOptions && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Options <span className="text-xs font-normal text-muted-foreground">(comma-separated)</span></label>
              <Input
                value={optionsRaw}
                onChange={(e) => setOptionsRaw(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
              />
              {optionsRaw && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {optionsRaw.split(",").map((o) => o.trim()).filter(Boolean).map((o) => (
                    <span key={o} className="px-2 py-0.5 bg-muted text-xs rounded-full text-muted-foreground border">{o}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Required */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="required"
              checked={isRequired}
              onCheckedChange={(v) => setIsRequired(!!v)}
            />
            <label htmlFor="required" className="text-sm cursor-pointer select-none">
              Required field
              <span className="ml-1 text-xs text-muted-foreground">(users must fill this in)</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || saving || (needsOptions && !optionsRaw.trim())}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function CustomFieldsPanel({ boardId, cardId, isAdmin = false }: CustomFieldsPanelProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<FieldValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const [fieldsRes, valuesRes] = await Promise.all([
      getCustomFieldsForBoard(boardId),
      getCardCustomFieldValues(cardId),
    ]);
    if (fieldsRes.data) setFields(fieldsRes.data as CustomField[]);
    if (valuesRes.data) setValues(valuesRes.data as FieldValue[]);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [fieldsRes, valuesRes] = await Promise.all([
        getCustomFieldsForBoard(boardId),
        getCardCustomFieldValues(cardId),
      ]);
      if (cancelled) return;
      if (fieldsRes.data) setFields(fieldsRes.data as CustomField[]);
      if (valuesRes.data) setValues(valuesRes.data as FieldValue[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [boardId, cardId]);

  const getValueFor = (fieldId: string) => values.find((v) => v.fieldId === fieldId);

  const handleSave = async (fieldId: string, data: Partial<FieldValue>) => {
    const valueData = {
      valueText: data.valueText ?? undefined,
      valueNumber: data.valueNumber ?? undefined,
      valueDate: data.valueDate ? String(data.valueDate) : undefined,
      valueBoolean: data.valueBoolean ?? undefined,
      valueOptions: (data.valueOptions as string[] | undefined) ?? undefined,
    };
    const result = await setCustomFieldValue(fieldId, cardId, valueData);
    if (result.error) { toast.error(result.error); return; }
    // Optimistic update
    setValues((prev) => {
      const existing = prev.findIndex((v) => v.fieldId === fieldId);
      const newVal = { id: result.data?.id ?? fieldId, fieldId, cardId, ...data } as FieldValue;
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], ...data };
        return updated;
      }
      return [...prev, newVal];
    });
  };

  const handleClear = async (fieldId: string) => {
    const val = getValueFor(fieldId);
    if (!val) return;
    const result = await clearCustomFieldValue(fieldId, cardId);
    if (result.error) { toast.error(result.error); return; }
    setValues((prev) => prev.filter((v) => v.fieldId !== fieldId));
  };

  const handleDelete = async (fieldId: string) => {
    if (!window.confirm("Delete this custom field? All stored values will be lost.")) return;
    const result = await deleteCustomField(fieldId);
    if (result.error) { toast.error(result.error); return; }
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    setValues((prev) => prev.filter((v) => v.fieldId !== fieldId));
    toast.success("Field deleted.");
  };

  if (loading && fields.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
            <Settings2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="text-sm font-semibold text-foreground">Custom Fields</span>
          {fields.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {fields.length}
            </span>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:hover:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add field
          </button>
        )}
      </div>

      {/* Field list */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-border text-center">
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
            <Settings2 className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No custom fields yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Fields are shared across all cards on this board</p>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add first field
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {fields
            .sort((a, b) => a.order - b.order)
            .map((field) => {
              const colors = FIELD_TYPE_COLORS[field.type];
              const valueNode = (
                <FieldValueInput
                  field={field}
                  value={getValueFor(field.id)}
                  onSave={handleSave}
                  onClear={handleClear}
                />
              );

              return (
                <div
                  key={field.id}
                  className="group flex items-center gap-3 px-3.5 py-3 bg-background hover:bg-muted/30 transition-colors"
                >
                  {/* Type pill */}
                  <div
                    className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap"
                    style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                  >
                    {FIELD_ICONS[field.type]}
                    {FIELD_TYPE_LABELS[field.type]}
                  </div>

                  {/* Field name */}
                  <label className="flex-shrink-0 text-xs font-medium text-foreground w-[90px] truncate">
                    {field.name}
                    {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </label>

                  {/* Spacer */}
                  <div className="flex-1 min-w-0">
                    {valueNode}
                  </div>

                  {/* Delete (admin, hover) */}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(field.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Delete field"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {showCreate && (
        <CreateFieldDialog
          boardId={boardId}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
