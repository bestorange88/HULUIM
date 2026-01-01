import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, CheckCircle, XCircle, Clock, Eye, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { exportToCSV } from "@/utils/exportUtils";

interface Verification {
  id: string;
  user_id: string;
  real_name: string;
  id_card_number: string;
  id_card_front_url: string;
  id_card_back_url: string;
  face_video_url: string;
  face_image_url: string;
  status: string;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
    phone: string;
  };
}

export default function RealNameVerifications() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [filteredVerifications, setFilteredVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    loadVerifications();
  }, []);

  useEffect(() => {
    filterVerifications();
  }, [searchQuery, verifications, statusFilter]);

  const loadVerifications = async () => {
    setLoading(true);
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast({
          title: "请先登录",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-settings', {
        body: { token: adminToken, action: 'list_verifications' }
      });

      if (error) {
        toast({
          title: "加载失败",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const verifications = data?.data || [];
      
      // 为每个验证记录生成签名URL
      const verificationsWithSignedUrls = await Promise.all(
        verifications.map(async (verification: any) => {
          const signedVerification = { ...verification };
          
          // 为身份证正面生成签名URL
          if (verification.id_card_front_url) {
            const frontPath = extractFilePathFromUrl(verification.id_card_front_url, verification.user_id);
            if (frontPath) {
              const { data: signedUrlData } = await supabase.storage
                .from("verification-documents")
                .createSignedUrl(frontPath, 60 * 60); // 1小时有效期
              if (signedUrlData) {
                signedVerification.id_card_front_url = signedUrlData.signedUrl;
              }
            }
          }
          
          // 为身份证反面生成签名URL
          if (verification.id_card_back_url) {
            const backPath = extractFilePathFromUrl(verification.id_card_back_url, verification.user_id);
            if (backPath) {
              const { data: signedUrlData } = await supabase.storage
                .from("verification-documents")
                .createSignedUrl(backPath, 60 * 60);
              if (signedUrlData) {
                signedVerification.id_card_back_url = signedUrlData.signedUrl;
              }
            }
          }
          
          // 为人脸截图生成签名URL
          if (verification.face_image_url) {
            const imagePath = extractFilePathFromUrl(verification.face_image_url, verification.user_id);
            if (imagePath) {
              const { data: signedUrlData } = await supabase.storage
                .from("verification-documents")
                .createSignedUrl(imagePath, 60 * 60);
              if (signedUrlData) {
                signedVerification.face_image_url = signedUrlData.signedUrl;
              }
            }
          }
          
          // 为人脸视频生成签名URL
          if (verification.face_video_url) {
            const videoPath = extractFilePathFromUrl(verification.face_video_url, verification.user_id);
            if (videoPath) {
              const { data: signedUrlData } = await supabase.storage
                .from("verification-documents")
                .createSignedUrl(videoPath, 60 * 60);
              if (signedUrlData) {
                signedVerification.face_video_url = signedUrlData.signedUrl;
              }
            }
          }
          
          return signedVerification;
        })
      );
      
      setVerifications(verificationsWithSignedUrls);
    } catch (err: any) {
      toast({
        title: "加载失败",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 从URL中提取文件路径的辅助函数
  const extractFilePathFromUrl = (url: string, userId: string): string | null => {
    try {
      // URL格式可能是: https://.../storage/v1/object/public/verification-documents/userId/filename
      // 或签名URL: https://.../storage/v1/object/sign/verification-documents/userId/filename?token=...
      const match = url.match(/verification-documents\/(.+?)(\?|$)/);
      if (match && match[1]) {
        return match[1];
      }
      // 如果无法从URL提取，尝试基于userId构建路径
      if (url.includes(userId)) {
        const parts = url.split(userId + '/');
        if (parts.length > 1) {
          const filename = parts[1].split('?')[0];
          return `${userId}/${filename}`;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const filterVerifications = () => {
    let filtered = verifications;

    if (statusFilter !== "all") {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter((v) =>
        v.real_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.id_card_number.includes(searchQuery) ||
        v.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.profiles?.phone?.includes(searchQuery)
      );
    }

    setFilteredVerifications(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />待审核</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />已通过</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />未通过</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleReview = (verification: Verification) => {
    setSelectedVerification(verification);
    setReviewNotes(verification.review_notes || "");
    setReviewDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedVerification) return;

    setProcessing(true);
    
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast({
          title: "请先登录",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-settings', {
        body: { 
          token: adminToken, 
          action: 'approve_verification',
          id: selectedVerification.id,
          userId: selectedVerification.user_id,
          reviewNotes: reviewNotes
        }
      });

      if (error) {
        toast({
          title: "操作失败",
          description: error.message,
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      // Send system notification
      await sendVerificationNotification(
        selectedVerification.user_id,
        "approved",
        reviewNotes
      );

      toast({
        title: "审核完成",
        description: "已通过实名认证",
      });
      setReviewDialogOpen(false);
      loadVerifications();
    } catch (err: any) {
      toast({
        title: "操作失败",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedVerification) return;
    if (!reviewNotes.trim()) {
      toast({
        title: "请填写拒绝原因",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast({
          title: "请先登录",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-settings', {
        body: { 
          token: adminToken, 
          action: 'reject_verification',
          id: selectedVerification.id,
          reviewNotes: reviewNotes
        }
      });

      if (error) {
        toast({
          title: "操作失败",
          description: error.message,
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      // Send system notification
      await sendVerificationNotification(
        selectedVerification.user_id,
        "rejected",
        reviewNotes
      );

      toast({
        title: "审核完成",
        description: "已拒绝实名认证",
      });
      setReviewDialogOpen(false);
      loadVerifications();
    } catch (err: any) {
      toast({
        title: "操作失败",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const sendVerificationNotification = async (
    userId: string,
    status: "approved" | "rejected",
    notes: string
  ) => {
    try {
      // Get customer service account
      const { data: customerService } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", "customer_service")
        .single();

      if (!customerService) {
        console.error("Customer service account not found");
        return;
      }

      // Get or create conversation with user
      const { data: existingConversation } = await supabase.rpc(
        "create_direct_conversation",
        { friend_id: userId }
      );

      const conversationId = existingConversation;

      if (!conversationId) {
        console.error("Failed to create conversation");
        return;
      }

      // Create notification message
      const title = status === "approved" ? "✅ 实名认证通过" : "❌ 实名认证未通过";
      const content =
        status === "approved"
          ? `恭喜您！您的实名认证已通过审核。\n\n审核意见：${notes || "无"}\n\n您现在可以使用完整的平台功能了。`
          : `很抱歉，您的实名认证未通过审核。\n\n拒绝原因：${notes}\n\n请根据提示重新提交认证资料。`;

      // Send message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: customerService.id,
        content: `【系统通知】\n${title}\n\n${content}`,
        type: "text",
        status: "sent",
      });

      console.log("Verification notification sent successfully");
    } catch (error) {
      console.error("Failed to send verification notification:", error);
    }
  };

  const maskIdCard = (idCard: string) => {
    if (idCard.length <= 8) return idCard;
    return idCard.slice(0, 4) + "****" + idCard.slice(-4);
  };

  const handleExport = () => {
    const exportData = filteredVerifications.map(v => ({
      '用户名': v.profiles?.username || '-',
      '昵称': v.profiles?.display_name || '-',
      '手机号': v.profiles?.phone || '-',
      '真实姓名': v.real_name,
      '身份证号': v.id_card_number,
      '状态': v.status === 'pending' ? '待审核' : v.status === 'approved' ? '已通过' : '未通过',
      '提交时间': format(new Date(v.created_at), "yyyy-MM-dd HH:mm"),
      '审核时间': v.reviewed_at ? format(new Date(v.reviewed_at), "yyyy-MM-dd HH:mm") : '-',
      '审核意见': v.review_notes || '-'
    }));
    
    exportToCSV(exportData, '实名认证列表');
    toast({
      title: '导出成功',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-text">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">实名认证审核</h2>
        <p className="text-muted-foreground">管理用户实名认证申请</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索姓名、身份证号、用户名、手机号..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                导出数据
              </Button>
            </div>

            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value="pending">待审核</TabsTrigger>
                <TabsTrigger value="approved">已通过</TabsTrigger>
                <TabsTrigger value="rejected">未通过</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户信息</TableHead>
                <TableHead>真实姓名</TableHead>
                <TableHead>身份证号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>提交时间</TableHead>
                <TableHead>审核时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVerifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                filteredVerifications.map((verification) => (
                  <TableRow key={verification.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{verification.profiles?.display_name}</span>
                        <span className="text-sm text-muted-foreground">@{verification.profiles?.username}</span>
                        {verification.profiles?.phone && (
                          <span className="text-sm text-muted-foreground">{verification.profiles.phone}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{verification.real_name}</TableCell>
                    <TableCell>{maskIdCard(verification.id_card_number)}</TableCell>
                    <TableCell>{getStatusBadge(verification.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(verification.created_at), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {verification.reviewed_at
                        ? format(new Date(verification.reviewed_at), "yyyy-MM-dd HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReview(verification)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>实名认证详情</DialogTitle>
            <DialogDescription>查看认证资料并进行审核</DialogDescription>
          </DialogHeader>

          {selectedVerification && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>真实姓名</Label>
                  <p className="text-lg font-medium">{selectedVerification.real_name}</p>
                </div>
                <div>
                  <Label>身份证号</Label>
                  <p className="text-lg font-medium">{selectedVerification.id_card_number}</p>
                </div>
              </div>

              <div>
                <Label>身份证正面</Label>
                <img
                  src={selectedVerification.id_card_front_url}
                  alt="身份证正面"
                  className="w-full rounded-lg border mt-2"
                />
              </div>

              <div>
                <Label>身份证反面</Label>
                <img
                  src={selectedVerification.id_card_back_url}
                  alt="身份证反面"
                  className="w-full rounded-lg border mt-2"
                />
              </div>

              <div>
                <Label>刷脸截图</Label>
                <img
                  src={selectedVerification.face_image_url}
                  alt="刷脸截图"
                  className="w-full rounded-lg border mt-2"
                />
              </div>

              <div>
                <Label>刷脸视频</Label>
                <video
                  src={selectedVerification.face_video_url}
                  controls
                  className="w-full rounded-lg border mt-2"
                />
              </div>

              <div>
                <Label htmlFor="reviewNotes">审核备注</Label>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="填写审核意见..."
                  rows={3}
                  className="mt-2"
                  disabled={selectedVerification.status !== "pending"}
                />
              </div>

              {selectedVerification.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    通过认证
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={processing}
                    variant="destructive"
                    className="flex-1"
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    拒绝认证
                  </Button>
                </div>
              )}

              {selectedVerification.status !== "pending" && (
                <Alert>
                  <AlertDescription>
                    {selectedVerification.status === "approved" ? "此认证已通过审核" : "此认证已被拒绝"}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
