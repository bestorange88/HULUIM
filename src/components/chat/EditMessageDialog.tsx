import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";

interface EditMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalContent: string;
  onSave: (newContent: string) => void;
}

export default function EditMessageDialog({
  open,
  onOpenChange,
  originalContent,
  onSave,
}: EditMessageDialogProps) {
  const [content, setContent] = useState(originalContent);
  const { t } = useTranslation();

  useEffect(() => {
    setContent(originalContent);
  }, [originalContent]);

  const handleSave = () => {
    if (content.trim() && content !== originalContent) {
      onSave(content.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("messages.editMessage")}</DialogTitle>
          <DialogDescription>
            {t("messages.editDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("messages.enterContent")}
            rows={4}
            className="resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!content.trim() || content === originalContent}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
