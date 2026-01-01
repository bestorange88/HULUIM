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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ChatSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNickname?: string;
  currentRemark?: string;
  onSave: (nickname: string, remark: string) => void;
}

export default function ChatSettingsDialog({
  open,
  onOpenChange,
  currentNickname = "",
  currentRemark = "",
  onSave,
}: ChatSettingsDialogProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const [remark, setRemark] = useState(currentRemark);

  // Sync state with props when dialog opens
  useEffect(() => {
    if (open) {
      setNickname(currentNickname);
      setRemark(currentRemark);
    }
  }, [open, currentNickname, currentRemark]);

  const handleSave = () => {
    onSave(nickname, remark);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>设置备注和标签</DialogTitle>
          <DialogDescription>
            设置对方的昵称备注，方便识别
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="nickname">备注名</Label>
            <Input
              id="nickname"
              placeholder="输入备注名"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="remark">备注信息</Label>
            <Textarea
              id="remark"
              placeholder="输入备注信息"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
