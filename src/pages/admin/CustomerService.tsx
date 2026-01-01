import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Loader2, Upload } from "lucide-react";

interface CustomerServiceAccount {
  id: string;
  user_id: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const DEFAULT_ACCOUNTS = [
  { username: "alozonghe", display_name: "在线客服" },
  { username: "aloyyys", display_name: "营养及饮食咨询" },
  { username: "aloydkf", display_name: "运动与康复咨询" },
  { username: "alojygh", display_name: "教育规划及咨询" },
];

export default function CustomerService() {
  const [accounts, setAccounts] = useState<CustomerServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CustomerServiceAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "",
    display_name: "",
    avatar_url: "",
    password: "123456",
    is_active: true,
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/superadmin/login");
      return;
    }
    fetchAccounts();
  }, [navigate]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("customer_service_accounts")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast({
        title: "加载失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultAccounts = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < DEFAULT_ACCOUNTS.length; i++) {
        const account = DEFAULT_ACCOUNTS[i];
        await createCustomerServiceAccount({
          username: account.username,
          display_name: account.display_name,
          password: "123456",
          avatar_url: "",
          is_active: true,
          sort_order: i,
        });
      }
      toast({
        title: "初始化成功",
        description: "已创建4个默认客服账号",
      });
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: "初始化失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const createCustomerServiceAccount = async (data: {
    username: string;
    display_name: string;
    password: string;
    avatar_url: string;
    is_active: boolean;
    sort_order?: number;
  }) => {
    const response = await supabase.functions.invoke("manage-customer-service", {
      body: {
        action: "create",
        ...data,
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    if (!response.data?.success) {
      throw new Error(response.data?.error || "创建失败");
    }

    return response.data;
  };

  const updateCustomerServiceAccount = async (id: string, data: {
    display_name?: string;
    password?: string;
    avatar_url?: string;
    is_active?: boolean;
  }) => {
    const response = await supabase.functions.invoke("manage-customer-service", {
      body: {
        action: "update",
        id,
        ...data,
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    if (!response.data?.success) {
      throw new Error(response.data?.error || "更新失败");
    }

    return response.data;
  };

  const handleOpenDialog = (account?: CustomerServiceAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        username: account.username,
        display_name: account.display_name,
        avatar_url: account.avatar_url || "",
        password: "",
        is_active: account.is_active,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        username: "",
        display_name: "",
        avatar_url: "",
        password: "123456",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `cs-${Date.now()}.${fileExt}`;
      const filePath = `customer-service/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: urlData.publicUrl }));
      toast({ title: "头像上传成功" });
    } catch (error: any) {
      toast({
        title: "上传失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.username.trim() || !formData.display_name.trim()) {
      toast({
        title: "请填写完整信息",
        description: "用户名和显示名称不能为空",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingAccount) {
        await updateCustomerServiceAccount(editingAccount.id, {
          display_name: formData.display_name,
          avatar_url: formData.avatar_url,
          is_active: formData.is_active,
          ...(formData.password ? { password: formData.password } : {}),
        });
        toast({ title: "更新成功" });
      } else {
        if (!formData.password) {
          toast({
            title: "请设置密码",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        await createCustomerServiceAccount({
          username: formData.username,
          display_name: formData.display_name,
          password: formData.password,
          avatar_url: formData.avatar_url,
          is_active: formData.is_active,
        });
        toast({ title: "创建成功" });
      }
      setDialogOpen(false);
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: CustomerServiceAccount) => {
    if (!confirm(`确定要删除客服账号 "${account.display_name}" 吗？`)) return;

    try {
      const response = await supabase.functions.invoke("manage-customer-service", {
        body: {
          action: "delete",
          id: account.id,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || "删除失败");

      toast({ title: "删除成功" });
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (account: CustomerServiceAccount) => {
    try {
      await updateCustomerServiceAccount(account.id, {
        is_active: !account.is_active,
      });
      toast({ title: account.is_active ? "已禁用" : "已启用" });
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: "操作失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">客服管理</h1>
          <p className="text-muted-foreground">管理客服账号，这些账号将显示在用户端通讯录中</p>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <Button variant="outline" onClick={initializeDefaultAccounts} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                初始化默认客服
              </Button>
            )}
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              新增客服
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>客服账号列表</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无客服账号，点击"初始化默认客服"创建4个预设账号
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>头像</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead>显示名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={account.avatar_url || ""} />
                          <AvatarFallback>
                            {account.display_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-mono">{account.username}</TableCell>
                      <TableCell>{account.display_name}</TableCell>
                      <TableCell>
                        <Switch
                          checked={account.is_active}
                          onCheckedChange={() => handleToggleActive(account)}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(account.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(account)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(account)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "编辑客服账号" : "新增客服账号"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={formData.avatar_url} />
                    <AvatarFallback>
                      {formData.display_name?.charAt(0) || "客"}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute bottom-0 right-0 p-1 bg-primary rounded-full cursor-pointer hover:bg-primary/90">
                    <Upload className="h-4 w-4 text-primary-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>用户名 *</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="客服登录用户名"
                  disabled={!!editingAccount}
                />
                {editingAccount && (
                  <p className="text-xs text-muted-foreground">用户名创建后不可修改</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>显示名称 *</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="在通讯录中显示的名称"
                />
              </div>

              <div className="space-y-2">
                <Label>{editingAccount ? "新密码（留空不修改）" : "登录密码 *"}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={editingAccount ? "留空保持原密码" : "默认密码 123456"}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>启用状态</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
