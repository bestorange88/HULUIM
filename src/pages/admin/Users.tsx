import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Edit, VolumeX, Wallet, Plus, Minus, User, Lock, Download, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';
import { exportToCSV } from '@/utils/exportUtils';
import { hashTransactionPassword } from '@/utils/security';

interface UserProfile {
  id: string;
  user_id: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: string | null;
  created_at: string;
  last_seen: string | null;
  bio: string | null;
  gender: string | null;
  birth_date: string | null;
  phone: string | null;
  invite_code: string | null;
  referred_by_code: string | null;
  membership_tier?: string | null;
  points?: number;
  balance?: number;
  referrer?: {
    display_name: string;
    username: string;
  };
  account_type?: 'normal' | 'test';
  is_customer_service?: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [muteDialogOpen, setMuteDialogOpen] = useState(false);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editLoginPassword, setEditLoginPassword] = useState('');
  const [editTransactionPassword, setEditTransactionPassword] = useState('');
  
  // Mute state
  const [muteDuration, setMuteDuration] = useState('24');
  
  // Balance state
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceNote, setBalanceNote] = useState('');
  const [balanceOperation, setBalanceOperation] = useState<'add' | 'subtract'>('add');
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = users.filter(
        (user) =>
          user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('未登录');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-users-query', {
        body: { adminToken }
      });

      if (error) {
        console.error('Failed to load users:', error);
        toast.error('加载用户失败');
        return;
      }

      if (!data?.users) {
        console.error('No users data returned');
        return;
      }

      // 推荐人信息已由后端返回，只需添加账户类型标记
      const usersWithAccountType = data.users.map((user: any) => ({
        ...user,
        account_type: user.username?.startsWith('test_') ? 'test' : 'normal'
      }));

      setUsers(usersWithAccountType);
      setFilteredUsers(usersWithAccountType);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = filteredUsers.map(user => ({
      '用户ID': user.id,
      '用户名': user.username,
      '昵称': user.display_name,
      '手机号': user.phone || '-',
      '邀请码': user.invite_code || '-',
      '推荐人': user.referrer ? `${user.referrer.display_name}(@${user.referrer.username})` : '-',
      '账户类型': user.account_type === 'test' ? '测试账户' : '正常用户',
      '会员等级': user.membership_tier || '普通用户',
      '积分': user.points || 0,
      '余额': user.balance || 0,
      '状态': user.status === 'online' ? '在线' : '离线',
      '注册时间': new Date(user.created_at).toLocaleString('zh-CN'),
      '最后在线': user.last_seen ? new Date(user.last_seen).toLocaleString('zh-CN') : '从未'
    }));
    
    exportToCSV(exportData, '用户列表');
    toast.success('导出成功');
  };

  const getEffectiveStatus = (status: string | null, lastSeen: string | null): 'online' | 'offline' => {
    if (!lastSeen) return 'offline';
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = Date.now();
    const twoMinutesMs = 2 * 60 * 1000;
    if (now - lastSeenTime > twoMinutesMs) {
      return 'offline';
    }
    return status === 'online' ? 'online' : 'offline';
  };

  const getStatusBadge = (status: string | null, lastSeen: string | null) => {
    const effectiveStatus = getEffectiveStatus(status, lastSeen);
    if (effectiveStatus === 'online') {
      return <Badge className="bg-green-500">在线</Badge>;
    }
    return <Badge variant="secondary">离线</Badge>;
  };

  const getGenderLabel = (gender: string | null) => {
    if (gender === 'male') return '男';
    if (gender === 'female') return '女';
    if (gender === 'other') return '保密';
    return '-';
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setEditDisplayName(user.display_name);
    setEditBio(user.bio || '');
    setEditGender(user.gender || '');
    setEditBirthDate(user.birth_date || '');
    setEditLoginPassword('');
    setEditTransactionPassword('');
    setEditDialogOpen(true);
  };

  const openMuteDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setMuteDuration('24');
    setMuteDialogOpen(true);
  };

  const openBalanceDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setBalanceAmount('');
    setBalanceNote('');
    setBalanceOperation('add');
    setBalanceDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('未登录');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: {
          adminToken,
          userId: selectedUser.id,
          displayName: editDisplayName,
          bio: editBio,
          gender: editGender || null,
          birthDate: editBirthDate || null,
          loginPassword: editLoginPassword || undefined,
          transactionPassword: editTransactionPassword || undefined
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(data?.message || '用户信息已更新');
      setEditDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      toast.error(error?.message || '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMuteSubmit = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const hours = parseInt(muteDuration);
      const muteUntil = new Date();
      muteUntil.setHours(muteUntil.getHours() + hours);

      const { error } = await supabase
        .from('profiles')
        .update({
          is_muted: true,
          muted_until: muteUntil.toISOString(),
          muted_reason: '管理员禁言',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success(`用户 ${selectedUser.display_name} 已被禁言 ${muteDuration} 小时`);
      setMuteDialogOpen(false);
      loadUsers();
    } catch (error) {
      console.error('Failed to mute user:', error);
      toast.error('禁言失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBalanceSubmit = async () => {
    if (!selectedUser || !balanceAmount) return;
    setSubmitting(true);
    try {
      const amount = parseFloat(balanceAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('请输入有效金额');
        return;
      }

      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('未登录');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-adjust-balance', {
        body: {
          adminToken,
          userId: selectedUser.id,
          operation: balanceOperation,
          amount,
          note: balanceNote
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${balanceOperation === 'add' ? '加款' : '扣款'}成功，新余额: ¥${data.newBalance.toFixed(2)}`);
      setBalanceDialogOpen(false);
      loadUsers();
    } catch (error) {
      console.error('Failed to adjust balance:', error);
      toast.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccountTypeChange = async (userId: string, newType: 'normal' | 'test') => {
    try {
      // 更新用户名来标记账户类型
      const user = users.find(u => u.id === userId);
      if (!user) return;

      let newUsername = user.username;
      if (newType === 'test' && !user.username.startsWith('test_')) {
        newUsername = 'test_' + user.username;
      } else if (newType === 'normal' && user.username.startsWith('test_')) {
        newUsername = user.username.replace('test_', '');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`账户类型已更新为${newType === 'test' ? '测试账户' : '正常用户'}`);
      loadUsers();
    } catch (error) {
      console.error('Failed to update account type:', error);
      toast.error('更新失败');
    }
  };

   // 新增用户状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  
  const handleCreateUser = async () => {
    setSubmitting(true);
    try {
      if (!newUsername || !newDisplayName || !newPhone || !newPassword) {
        toast.error('请填写所有必填字段');
        return;
      }

      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('未登录');
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          adminToken,
          username: newUsername,
          displayName: newDisplayName,
          phone: newPhone,
          password: newPassword
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.detail || data.error);

      toast.success(`用户 ${newDisplayName} 创建成功，邀请码: ${data.inviteCode}`);
      setCreateDialogOpen(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewPhone('');
      setNewPassword('123456');
      loadUsers();
    } catch (error: any) {
      console.error('Failed to create user:', error);
      toast.error(error.message || '创建用户失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 select-text">
      <div>
        <h1 className="text-3xl font-bold">用户管理</h1>
        <p className="text-muted-foreground mt-2">管理所有平台用户</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>用户列表</CardTitle>
              <CardDescription>共 {users.length} 个用户</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
                <User className="h-4 w-4 mr-2" />
                新增用户
              </Button>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                导出数据
              </Button>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户名或昵称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="whitespace-nowrap px-2 py-2">ID</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">用户名</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">昵称</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">手机号</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">邀请码</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">推荐人</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">会员等级</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">积分</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">余额</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">状态</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">性质</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">注册时间</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2">最后在线</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="text-xs">
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono text-primary">{user.user_id || '-'}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">@{user.username}</TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">{user.display_name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.display_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono">{user.phone || '-'}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      <span className="font-mono text-primary">{user.invite_code || '-'}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      {user.referrer ? user.referrer.display_name : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      {user.membership_tier ? (
                        <Badge className="bg-amber-500 text-[10px] px-1.5 py-0.5">{user.membership_tier}</Badge>
                      ) : (
                        <span className="text-muted-foreground">普通</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      <span className="text-orange-500">{user.points || 0}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      <span className="text-green-600">¥{(user.balance || 0).toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">{getStatusBadge(user.status, user.last_seen)}</TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      {user.is_customer_service ? (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">系统账号</Badge>
                      ) : user.username?.startsWith("test_") || user.username?.includes("internal") ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">内部员工</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-700">真实注册</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      {new Date(user.created_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2">
                      {user.last_seen
                        ? formatDistanceToNow(new Date(user.last_seen), { addSuffix: true, locale: zhCN })
                        : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => openEditDialog(user)}>
                          <Edit className="h-3 w-3 mr-0.5" />编辑
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => openMuteDialog(user)}>
                          <VolumeX className="h-3 w-3 mr-0.5" />禁言
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => openBalanceDialog(user)}>
                          <Wallet className="h-3 w-3 mr-0.5" />加减金
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

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>
              修改用户 {selectedUser?.display_name} 的信息
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                基本资料
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Lock className="h-4 w-4" />
                安全设置
              </TabsTrigger>
            </TabsList>
            <ScrollArea className="h-[400px] mt-4">
              <TabsContent value="profile" className="space-y-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">昵称</Label>
                  <Input
                    id="displayName"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">性别</Label>
                  <Select value={editGender} onValueChange={setEditGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择性别" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">男</SelectItem>
                      <SelectItem value="female">女</SelectItem>
                      <SelectItem value="other">保密</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">出生日期</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">个性签名</Label>
                  <Input
                    id="bio"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="暂无签名"
                  />
                </div>
              </TabsContent>
              <TabsContent value="security" className="space-y-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="loginPassword">登录密码</Label>
                  <Input
                    id="loginPassword"
                    type="password"
                    value={editLoginPassword}
                    onChange={(e) => setEditLoginPassword(e.target.value)}
                    placeholder="留空则不修改"
                  />
                  <p className="text-xs text-muted-foreground">
                    修改登录密码需要通过管理员API完成
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transactionPassword">交易密码</Label>
                  <Input
                    id="transactionPassword"
                    type="password"
                    value={editTransactionPassword}
                    onChange={(e) => setEditTransactionPassword(e.target.value)}
                    placeholder="留空则不修改"
                  />
                  <p className="text-xs text-muted-foreground">
                    用于红包、转账等资金操作的密码
                  </p>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditSubmit} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mute User Dialog */}
      <Dialog open={muteDialogOpen} onOpenChange={setMuteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>禁言用户</DialogTitle>
            <DialogDescription>
              禁言用户 {selectedUser?.display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="muteDuration">禁言时长（小时）</Label>
              <Input
                id="muteDuration"
                type="number"
                value={muteDuration}
                onChange={(e) => setMuteDuration(e.target.value)}
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMuteDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleMuteSubmit} disabled={submitting} variant="destructive">
              {submitting ? '处理中...' : '确认禁言'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Dialog */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>加减金</DialogTitle>
            <DialogDescription>
              调整用户 {selectedUser?.display_name} 的余额
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>操作类型</Label>
              <div className="flex gap-2">
                <Button
                  variant={balanceOperation === 'add' ? 'default' : 'outline'}
                  onClick={() => setBalanceOperation('add')}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  加款
                </Button>
                <Button
                  variant={balanceOperation === 'subtract' ? 'default' : 'outline'}
                  onClick={() => setBalanceOperation('subtract')}
                  className="flex-1"
                >
                  <Minus className="h-4 w-4 mr-1" />
                  扣款
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="balanceAmount">金额</Label>
              <Input
                id="balanceAmount"
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="请输入金额"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balanceNote">备注</Label>
              <Input
                id="balanceNote"
                value={balanceNote}
                onChange={(e) => setBalanceNote(e.target.value)}
                placeholder={balanceOperation === 'add' ? '管理员加款' : '管理员扣款'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleBalanceSubmit} 
              disabled={submitting || !balanceAmount}
              variant={balanceOperation === 'subtract' ? 'destructive' : 'default'}
            >
              {submitting ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
            <DialogDescription>
              创建新用户账户，邀请码将自动生成
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newUsername">用户名 *</Label>
              <Input
                id="newUsername"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="请输入用户名"
              />
              </div>
              <div className="space-y-2">
              <Label htmlFor="newDisplayName">昵称 *</Label>
              <Input
                id="newDisplayName"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="请输入昵称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPhone">手机号 *</Label>
              <Input
                id="newPhone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="请输入手机号"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">密码 *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
            取消
            </Button>
            <Button onClick={handleCreateUser} disabled={submitting || !newUsername || !newDisplayName || !newPhone || !newPassword}>
              {submitting ? '创建中...' : '创建用户'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
