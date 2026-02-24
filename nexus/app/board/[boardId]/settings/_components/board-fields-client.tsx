"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Loader2, Text, Hash, Calendar, CheckSquare, List, Link2, Mail, Phone, ChevronDown, ToggleLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getCustomFieldsForBoard,
} from "@/actions/custom-field-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "TEXT",         label: "Text",         icon: Text },
  { value: "NUMBER",       label: "Number",        icon: Hash },
  { value: "DATE",         label: "Date",          icon: Calendar },
  { value: "CHECKBOX",     label: "Checkbox",      icon: CheckSquare },
  { value: "SELECT",       label: "Single Select", icon: ChevronDown },
  { value: "MULTI_SELECT", label: "Multi Select",  icon: List },
  { value: "URL",          label: "URL",           icon: Link2 },
  { value: "EMAIL",        label: "Email",         icon: Mail },
  { value: "PHONE",        label: "Phone",         icon: Phone },
] as const;

type FieldType = typeof FIELD_TYPES[number]["value"];

export interface CustomField {
  id: string;
  name: string;
  type: FieldType;
  isRequired: boolean;
  options?: string[] | null;
  order: number;
}

interface BoardFieldsClientProps {
  boardId: string;
  initialFields: CustomField[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoardFieldsClient({ boardId, initialFields }: BoardFieldsClientProps) {
  const [fields, setFields] = useState<CustomField[]>(initialFields);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // Track which fields have in-flight toggle-required requests to prevent double-submits
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // New field form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<FieldType>("TEXT");
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState("");

  const reload = useCallback(async () => {
    const result = await getCustomFieldsForBoard(boardId);
    if (result.error) {
      console.error("[BoardFieldsClient] reload failed:", result.error);
      toast.error("Failed to reload custom fields.");
      return;
    }
    if (result.data) setFields(result.data as CustomField[]);
  }, [boardId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;

    // Validate options for SELECT / MULTI_SELECT before touching saving state
    const options = ["SELECT", "MULTI_SELECT"].includes(newType)
      ? newOptions.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    if ((newType === "SELECT" || newType === "MULTI_SELECT") && (!options || options.length === 0)) {
      toast.error("Please add at least one option (comma-separated).");
      return;
    }

    setSaving(true);
    try {

      const result = await createCustomField(
        newName.trim(),
        newType,
        boardId,
        options,   // already computed above
        newRequired
      );
      if (result.error) { toast.error(result.error); return; }
      toast.success("Custom field created!");
      setNewName(""); setNewType("TEXT"); setNewRequired(false); setNewOptions("");
      setShowCreate(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create field.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRequired = async (field: CustomField) => {
    if (togglingIds.has(field.id)) return;
    setTogglingIds((prev) => { const next = new Set(prev); next.add(field.id); return next; });
    try {
      const result = await updateCustomField(field.id, { isRequired: !field.isRequired });
      if (result.error) { toast.error(result.error); return; }
      // Use the server-returned value as the source of truth rather than locally
      // inverting, to avoid stale-closure polarity bugs when rapid toggling occurs.
      setFields((prev) =>
        prev.map((f) =>
          f.id === field.id
            ? { ...f, isRequired: result.data?.isRequired ?? !field.isRequired }
            : f
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update field.");
    } finally {
      setTogglingIds((prev) => { const next = new Set(prev); next.delete(field.id); return next; });
    }
  };

  const handleDelete = async (fieldId: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      const result = await deleteCustomField(fieldId);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Field deleted.");
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
      setDeleteTarget(null);
    } catch (err) {
      console.error("[BoardFieldsClient] handleDelete threw:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete field.");
    } finally {
      setDeleting(false);
    }
  };

  const fieldTypeConfig = (type: string) => FIELD_TYPES.find((t) => t.value === type);

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Custom Fields</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define custom fields for cards on this board. Fields appear in each card&apos;s custom
          fields tab.
        </p>
      </div>

      <Separator />

      {/* Existing fields */}
      {fields.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-xl border-2 border-dashed">
          <ToggleLeft className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">No custom fields yet.</p>
          <p className="text-sm mt-1 opacity-70">Add a field to capture extra card metadata.</p>
          <Button className="mt-4 gap-1" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Add Field
          </Button>
        </div>
      )}

      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((field) => {
            const config = fieldTypeConfig(field.type);
            const Icon = config?.icon ?? Text;
            return (
              <div
                key={field.id}
                className="flex items-center gap-3 p-4 rounded-xl border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Icon className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="font-medium truncate">{field.name}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {config?.label ?? field.type}
                  </Badge>
                  {field.isRequired && (
                    <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 shrink-0">
                      Required
                    </Badge>
                  )}
                  {(field.options?.length ?? 0) > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {field.options!.length} option{field.options!.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={`req-${field.id}`} className="text-xs text-muted-foreground">
                      Required
                    </Label>
                    <Switch
                      id={`req-${field.id}`}
                      checked={field.isRequired}
                      onCheckedChange={() => handleToggleRequired(field)}
                      className="data-[state=checked]:bg-indigo-600"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete "${field.name}" field`}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(field.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add field form */}
      {showCreate && (
        <div className="p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-4">
          <h3 className="font-semibold text-sm">New Custom Field</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-xs text-muted-foreground">Field Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Estimate, Customer, Region"
                onKeyDown={(e) => e.key === "Enter" && !saving && handleCreate()}
              />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as FieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <t.icon className="h-3.5 w-3.5" />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {["SELECT", "MULTI_SELECT"].includes(newType) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Options <span className="text-muted-foreground/60">(comma-separated)</span>
              </Label>
              <Input
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder="Option A, Option B, Option C"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              id="new-required"
              checked={newRequired}
              onCheckedChange={setNewRequired}
              className="data-[state=checked]:bg-indigo-600"
            />
            <Label htmlFor="new-required" className="text-sm cursor-pointer">
              Mark as required
            </Label>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              size="sm"
              className={cn(saving && "opacity-70")}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Create Field
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
                setNewType("TEXT");
                setNewRequired(false);
                setNewOptions("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!showCreate && fields.length > 0 && (
        <Button variant="outline" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Add Field
        </Button>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{fields.find((f) => f.id === deleteTarget)?.name ?? "this field"}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the field{" "}
              <strong>{fields.find((f) => f.id === deleteTarget)?.name ?? ""}</strong>{" "}
              and all values for this field across every card on this board. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            {/* Use a plain Button rather than AlertDialogAction so the AlertDialog does NOT
                auto-close on click. This lets us show the "Deleting…" spinner state and only
                close the dialog ourselves after the server action completes. */}
            <Button
              variant="destructive"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deleting}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deleting ? "Deleting…" : "Delete Field"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
