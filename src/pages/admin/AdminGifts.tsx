import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Gift, Search, X } from 'lucide-react';
import { format } from 'date-fns';

interface GiftRecord {
  id: string;
  user_id: string;
  gift_type: string;
  amount: number;
  admin_username: string;
  notes: string | null;
  created_at: string;
  profile?: {
    display_name: string;
    username: string;
    user_id: string;
  };
}

interface UserOption {
  id: string;
  display_name: string;
  username: string;
  user_id: string;
}

export default function AdminGifts() {
  const [giftType, setGiftType] = useState<string>('points');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [giftRecords, setGiftRecords] = useState<GiftRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGiftRecords();
  }, []);

  const fetchGiftRecords = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_gifts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch user profiles for the records
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, user_id')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        const recordsWithProfiles = data.map(r => ({
          ...r,
          profile: profileMap.get(r.user_id)
        }));
        setGiftRecords(recordsWithProfiles);
      } else {
        setGiftRecords([]);
      }
    } catch (error) {
      console.error('Error fetching gift records:', error);
      toast.error('获取赠送记录失败');
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, user_id')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,user_id.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      // Filter out already selected users
      const filteredResults = (data || []).filter(
        user => !selectedUsers.some(selected => selected.id === user.id)
      );
      setSearchResults(filteredResults as UserOption[]);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    searchUsers(value);
  };

  const addUser = (user: UserOption) => {
    setSelectedUsers([...selectedUsers, user]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleSendGift = async () => {
    if (selectedUsers.length === 0) {
      toast.error('请选择至少一个用户');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('请输入有效的金额');
      return;
    }

    setIsSending(true);
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) throw new Error('未登录');

      // Get admin username from session
      const { data: session } = await supabase
        .from('admin_sessions')
        .select('username')
        .eq('session_token', adminToken)
        .single();

      const adminUsername = session?.username || 'admin';

      // Process each selected user
      for (const user of selectedUsers) {
        // Create gift record
        const { error: giftError } = await supabase
          .from('admin_gifts')
          .insert({
            user_id: user.id,
            gift_type: giftType,
            amount: amountNum,
            admin_username: adminUsername,
            notes: notes || null
          });

        if (giftError) throw giftError;

        // Add points or balance based on gift type
        if (giftType === 'points') {
          // Get current points
          const { data: pointsData } = await supabase
            .from('user_points')
            .select('balance')
            .eq('user_id', user.id)
            .single();

          const currentBalance = pointsData?.balance || 0;
          const newBalance = Number(currentBalance) + amountNum;

          if (pointsData) {
            await supabase
              .from('user_points')
              .update({ balance: newBalance })
              .eq('user_id', user.id);
          } else {
            await supabase
              .from('user_points')
              .insert({ user_id: user.id, balance: newBalance });
          }

          // Create point transaction record
          await supabase
            .from('point_transactions')
            .insert({
              user_id: user.id,
              type: 'admin_gift',
              amount: amountNum,
              balance_before: currentBalance,
              balance_after: newBalance,
              description: `管理员赠送积分${notes ? ': ' + notes : ''}`
            });
        } else if (giftType === 'red_envelope') {
          // Get current wallet balance
          const { data: walletData } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', user.id)
            .single();

          const currentBalance = walletData?.balance || 0;
          const newBalance = Number(currentBalance) + amountNum;

          await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', user.id);

          // Create transaction record
          await supabase
            .from('transactions')
            .insert({
              user_id: user.id,
              type: 'admin_gift',
              amount: amountNum,
              balance_before: currentBalance,
              balance_after: newBalance,
              description: `管理员赠送红包${notes ? ': ' + notes : ''}`,
              status: 'completed'
            });
        }
      }

      toast.success(`成功向 ${selectedUsers.length} 位用户发送${giftType === 'points' ? '积分' : '红包'}`);
      
      // Reset form
      setSelectedUsers([]);
      setAmount('');
      setNotes('');
      
      // Refresh records
      fetchGiftRecords();
    } catch (error) {
      console.error('Error sending gift:', error);
      toast.error('发送失败');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">赠送管理</h1>

      {/* Send Gift Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            发送赠送
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label>选择用户（支持多选）</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名/昵称/ID"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="border rounded-md bg-background shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map(user => (
                  <div
                    key={user.id}
                    className="px-3 py-2 hover:bg-muted cursor-pointer flex justify-between items-center"
                    onClick={() => addUser(user)}
                  >
                    <div>
                      <span className="font-medium">{user.display_name}</span>
                      <span className="text-muted-foreground ml-2">@{user.username}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{user.user_id}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedUsers.map(user => (
                  <Badge key={user.id} variant="secondary" className="gap-1">
                    {user.display_name} ({user.user_id})
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeUser(user.id)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Gift Type */}
          <div className="space-y-2">
            <Label>奖品类型</Label>
            <Select value={giftType} onValueChange={setGiftType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="points">积分</SelectItem>
                <SelectItem value="red_envelope">红包（余额）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>金额</Label>
            <Input
              type="number"
              placeholder={giftType === 'points' ? '输入积分数量' : '输入红包金额（元）'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>备注（可选）</Label>
            <Textarea
              placeholder="输入赠送备注..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button 
            onClick={handleSendGift} 
            disabled={isSending || selectedUsers.length === 0 || !amount}
            className="w-full"
          >
            {isSending ? '发送中...' : `发送${giftType === 'points' ? '积分' : '红包'}`}
          </Button>
        </CardContent>
      </Card>

      {/* Gift Records */}
      <Card>
        <CardHeader>
          <CardTitle>赠送记录</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : giftRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无赠送记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>操作人</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {giftRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {format(new Date(record.created_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{record.profile?.display_name || '-'}</span>
                        {record.profile?.user_id && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({record.profile.user_id})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.gift_type === 'points' ? 'default' : 'destructive'}>
                        {record.gift_type === 'points' ? '积分' : '红包'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {record.gift_type === 'points' ? record.amount : `¥${record.amount}`}
                    </TableCell>
                    <TableCell>{record.admin_username}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {record.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
