import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface SensitiveWord {
  id: string;
  word: string;
  category: string;
  action: string;
  created_at: string;
}

export default function AdminSensitiveWords() {
  const [words, setWords] = useState<SensitiveWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newAction, setNewAction] = useState('block');
  const { toast } = useToast();

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    try {
      const { data, error } = await supabase
        .from('sensitive_words')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWords(data || []);
    } catch (error) {
      console.error('Failed to load sensitive words:', error);
      toast({
        title: '加载失败',
        description: '无法加载敏感词列表',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newWord.trim()) {
      toast({
        title: '输入错误',
        description: '请输入敏感词',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('sensitive_words').insert({
        word: newWord.trim(),
        category: newCategory,
        action: newAction,
      });

      if (error) throw error;

      toast({
        title: '添加成功',
        description: '敏感词已添加',
      });

      setNewWord('');
      setDialogOpen(false);
      loadWords();
    } catch (error: any) {
      console.error('Failed to add sensitive word:', error);
      toast({
        title: '添加失败',
        description: error.message || '无法添加敏感词',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个敏感词吗？')) return;

    try {
      const { error } = await supabase.from('sensitive_words').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: '删除成功',
        description: '敏感词已删除',
      });

      loadWords();
    } catch (error) {
      console.error('Failed to delete sensitive word:', error);
      toast({
        title: '删除失败',
        description: '无法删除敏感词',
        variant: 'destructive',
      });
    }
  };

  const getCategoryDisplay = (category: string) => {
    const categoryMap: Record<string, string> = {
      general: '通用',
      politics: '政治',
      violence: '暴力',
      pornography: '色情',
      advertising: '广告',
    };
    return categoryMap[category] || category;
  };

  const getActionDisplay = (action: string) => {
    return action === 'block' ? '阻止发送' : '替换为***';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">敏感词管理</h1>
          <p className="text-muted-foreground mt-2">管理平台敏感词过滤规则</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加敏感词
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加敏感词</DialogTitle>
              <DialogDescription>添加新的敏感词过滤规则</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="word">敏感词</Label>
                <Input
                  id="word"
                  placeholder="输入敏感词"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">分类</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用</SelectItem>
                    <SelectItem value="politics">政治</SelectItem>
                    <SelectItem value="violence">暴力</SelectItem>
                    <SelectItem value="pornography">色情</SelectItem>
                    <SelectItem value="advertising">广告</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="action">处理方式</Label>
                <Select value={newAction} onValueChange={setNewAction}>
                  <SelectTrigger id="action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">阻止发送</SelectItem>
                    <SelectItem value="replace">替换为***</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAdd}>添加</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>敏感词列表</CardTitle>
          <CardDescription>共 {words.length} 个敏感词</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : words.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无敏感词</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>敏感词</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>处理方式</TableHead>
                  <TableHead>添加时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {words.map((word) => (
                  <TableRow key={word.id}>
                    <TableCell className="font-medium">{word.word}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getCategoryDisplay(word.category)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={word.action === 'block' ? 'destructive' : 'default'}>
                        {getActionDisplay(word.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(word.created_at), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(word.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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