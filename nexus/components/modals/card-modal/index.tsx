"use client";

import { useEffect, useState, useRef, ElementRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, AuditLog, List } from "@prisma/client";
import { Layout, AlignLeft, Check } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCardModal } from "@/hooks/use-card-modal";
import { getCard } from "@/actions/get-card"; 
import { updateCard } from "@/actions/update-card"; 
import { Activity } from "./activity";
import { getAuditLogs } from "@/actions/get-audit-logs";

// [FIXED: Senior Type Safety] Define the proper relation type to replace 'any'
type CardWithList = Card & { list: List };

export const CardModal = () => {
  const params = useParams();
  const router = useRouter(); 
  
  // Destructure centralized state from Zustand
  const id = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const mode = useCardModal((state) => state.mode);
  const onClose = useCardModal((state) => state.onClose);

  const [cardData, setCardData] = useState<CardWithList | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isDescEditing, setIsDescEditing] = useState(false);
  const [savedField, setSavedField] = useState<"title" | "desc" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const descInputRef = useRef<ElementRef<"textarea">>(null);

  // Fetch data when modal opens
  useEffect(() => {
    if (id && isOpen) {
        const fetchData = async () => {
            const card = await getCard(id);
            if (card) {
                setCardData(card as CardWithList);
                setTitle(card.title);
                setDescription(card.description || "");
                
                // [FIXED: Direct Edit Support] Automatically open editor if opened in 'edit' mode
                if (mode === "edit") {
                  setIsDescEditing(true);
                }
            }

            const logs = await getAuditLogs(id);
            setAuditLogs(logs);
        }
        fetchData();
    }
  }, [id, isOpen, mode]);

  // Handle auto-focus when entering edit mode
  useEffect(() => {
    if (isDescEditing) {
        descInputRef.current?.focus();
    }
  }, [isDescEditing]);

  // UX: Escape key to cancel editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDescEditing(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const onSaveTitle = async () => {
    if (!cardData) return;
    if (title.trim() === cardData.title.trim()) return;

    await updateCard({
      boardId: params.boardId as string,
      id: cardData.id,
      title: title
    });
    
    router.refresh(); 

    setCardData({ ...cardData, title });
    setSavedField("title");
    setTimeout(() => setSavedField(null), 2000);
  };

  const onSaveDesc = async () => {
    if (!cardData) return;

    const originalDesc = (cardData.description || "").trim();
    const currentDesc = (description || "").trim();

    if (originalDesc === currentDesc) {
      setIsDescEditing(false);
      return;
    }

    setIsSaving(true);

    // ⭐ OPTIMISTIC UPDATE: Change UI immediately (zero-latency UX)
    const previousDescription = cardData.description;
    setCardData({ ...cardData, description: currentDesc });

    // 🔄 BACKGROUND SYNC: Perform actual database update
    const result = await updateCard({
      boardId: params.boardId as string,
      id: cardData.id,
      description: currentDesc
    });

    setIsSaving(false);

    if (result.error) {
      // ❌ ROLLBACK: Revert to previous state if DB fails
      setCardData({ ...cardData, description: previousDescription });
      setDescription(previousDescription || "");
      toast.error(`Failed to save: ${result.error}`);
      return;
    }

    // ✅ SUCCESS: Refresh and show confirmation
    setIsDescEditing(false);
    setSavedField("desc");
    toast.success("Description saved");
    router.refresh();
    setTimeout(() => setSavedField(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="md:max-w-3xl p-0 overflow-hidden bg-white z-[9999] pointer-events-auto shadow-strong">
        <DialogTitle className="hidden">Card Details</DialogTitle>

        {!cardData ? (
             <div className="p-6">Loading...</div>
        ) : (
            <div className="p-6">
                
                {/* --- 1. TITLE SECTION --- */}
                <div className="flex items-start gap-x-3 mb-8 w-full">
                    <Layout className="h-5 w-5 mt-1 text-neutral-700 shrink-0" />
                    <div className="w-full relative"> 
                        <div className="flex items-center gap-x-2">
                             <input 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={onSaveTitle}
                                aria-label="Card title"
                                placeholder="Card title"
                                className="font-semibold text-xl px-1 border-2 border-transparent focus:border-brand-500 rounded-sm w-[95%] bg-transparent focus:bg-white truncate transition-all outline-none"
                             />
                        </div>
                        
                        {savedField === "title" && (
                            <div className="absolute top-0 right-10 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-medium flex items-center animate-in fade-in zoom-in">
                                <Check className="h-3 w-3 mr-1" /> Saved
                            </div>
                        )}

                        <p className="text-sm text-muted-foreground px-1 mt-1">
                            in list <span className="underline">{cardData.list.title}</span>
                        </p>
                    </div>
                </div>

                {/* --- 2. DESCRIPTION SECTION --- */}
                <div className="flex items-start gap-x-3 w-full mb-10">
                    <AlignLeft className="h-5 w-5 mt-1 text-neutral-700 shrink-0" />
                    <div className="w-full">
                        <div className="mb-2">
                            <p className="font-semibold text-neutral-700 text-lg">Description</p>
                        </div>
                        
                        {isDescEditing ? (
                            <div className="space-y-3">
                                <textarea
                                    ref={descInputRef}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full mt-2 p-3 border-2 border-brand-500 rounded-md outline-none focus:ring-0 min-h-[150px] resize-none text-sm shadow-soft transition-all bg-white"
                                    placeholder="Add a more detailed description..."
                                    disabled={isSaving}
                                />
                                <div className="flex items-center gap-x-2">
                                    <Button 
                                        onClick={onSaveDesc}
                                        disabled={isSaving || (cardData && description.trim() === (cardData.description || "").trim())}
                                        className={`${
                                            cardData && description.trim() !== (cardData.description || "").trim()
                                                ? "bg-black hover:bg-neutral-900 text-white"
                                                : "bg-neutral-400 text-neutral-700 cursor-not-allowed"
                                        } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                                    >
                                        {isSaving ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Saving...
                                            </>
                                        ) : (
                                            "Save"
                                        )}
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                            setDescription(cardData?.description || "");
                                            setIsDescEditing(false);
                                        }}
                                        disabled={isSaving}
                                        className="text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div 
                                onClick={() => setIsDescEditing(true)}
                                className="min-h-[78px] bg-slate-100 text-sm py-3 px-3.5 rounded-md hover:bg-slate-200 cursor-pointer whitespace-pre-wrap transition-all border border-transparent hover:border-slate-300"
                                role="button"
                                tabIndex={0}
                            >
                                {description || "Add a more detailed description..."}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- 3. ACTIVITY LOG SECTION --- */}
                <div className="w-full border-t pt-8">
                    <Activity items={auditLogs} />
                </div>

            </div>
        )}
      </DialogContent>
    </Dialog>
  );
};