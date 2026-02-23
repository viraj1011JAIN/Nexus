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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
            <Settings2 className="h-5 w-5 text-indigo-500" />
            Create Custom Field
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Field name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Story Points, Campaign, Bug ID"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Field type</label>
            <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FIELD_TYPE_LABELS) as CustomFieldType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-2">
                      {FIELD_ICONS[t]}
                      {FIELD_TYPE_LABELS[t]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsOptions && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Options (comma-separated)</label>
              <Input
                value={optionsRaw}
                onChange={(e) => setOptionsRaw(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox
              id="required"
              checked={isRequired}
              onCheckedChange={(v) => setIsRequired(!!v)}
            />
            <label htmlFor="required" className="text-sm">Required field</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
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
  const [open, setOpen] = useState(true);

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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer py-1 group">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Custom Fields</span>
              {fields.length > 0 && (
                <Badge variant="outline" className="text-xs h-5 px-1.5">
                  {fields.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add field
                </Button>
              )}
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {fields.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No custom fields yet</p>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs h-7"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add first field
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {fields
                .sort((a, b) => a.order - b.order)
                .map((field) => (
                  <div key={field.id} className="group flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">
                          {FIELD_ICONS[field.type]}
                        </span>
                        <label className="text-xs font-medium text-muted-foreground flex-1">
                          {field.name}
                          {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(field.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-red-500 transition-all"
                            title="Delete field"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <FieldValueInput
                        field={field}
                        value={getValueFor(field.id)}
                        onSave={handleSave}
                        onClear={handleClear}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Separator className="my-1" />

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
