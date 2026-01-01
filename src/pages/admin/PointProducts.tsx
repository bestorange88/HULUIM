import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, Edit, Plus, Trash2, Package, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface PointProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  type: string;
  points_required: number;
  stock: number | null;
  is_active: boolean;
  image_url: string | null;
  sort_order: number;
  created_at: string;
}

export default function AdminPointProducts() {
  const [products, setProducts] = useState<PointProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<PointProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PointProduct | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('virtual');
  const [formPoints, setFormPoints] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  const loadProducts = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('请先登录');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-point-products', {
        body: { adminToken, action: 'list' }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setProducts(data.products || []);
      setFilteredProducts(data.products || []);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setSelectedProduct(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (product: PointProduct) => {
    setSelectedProduct(product);
    setFormName(product.name);
    setFormDescription(product.description || '');
    setFormCategory(product.category);
    setFormPoints(product.points_required.toString());
    setFormStock(product.stock?.toString() || '');
    setFormIsActive(product.is_active);
    setFormImageUrl(product.image_url || '');
    setFormSortOrder(product.sort_order.toString());
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCategory('virtual');
    setFormPoints('');
    setFormStock('');
    setFormIsActive(true);
    setFormImageUrl('');
    setFormSortOrder('0');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过5MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `product_${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormImageUrl(urlData.publicUrl);
      toast.success('图片上传成功');
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error('图片上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearImage = () => {
    setFormImageUrl('');
  };

  const handleSubmit = async () => {
    if (!formName || !formPoints) {
      toast.error('请填写必填项');
      return;
    }

    setSubmitting(true);
    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('请先登录');
        return;
      }

      const productData = {
        name: formName,
        description: formDescription || null,
        category: formCategory,
        type: formCategory === 'virtual' ? 'virtual' : 'physical',
        points_required: parseFloat(formPoints),
        stock: formStock ? parseInt(formStock) : null,
        is_active: formIsActive,
        image_url: formImageUrl || null,
        sort_order: parseInt(formSortOrder) || 0,
      };

      if (selectedProduct) {
        const { data, error } = await supabase.functions.invoke('admin-point-products', {
          body: { adminToken, action: 'update', productId: selectedProduct.id, productData }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);
        toast.success('商品已更新');
      } else {
        const { data, error } = await supabase.functions.invoke('admin-point-products', {
          body: { adminToken, action: 'create', productData }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);
        toast.success('商品已创建');
      }

      setDialogOpen(false);
      loadProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个商品吗？')) return;

    try {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) {
        toast.error('请先登录');
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-point-products', {
        body: { adminToken, action: 'delete', productId: id }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success('商品已删除');
      loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('删除失败');
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      virtual: '虚拟商品',
      physical: '实物商品',
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">积分商品管理</h1>
          <p className="text-muted-foreground mt-2">管理积分商城的商品</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          添加商品
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>商品列表</CardTitle>
          <CardDescription>共 {products.length} 个商品</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索商品名称或分类..."
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名称</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>所需积分</TableHead>
                  <TableHead>库存</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        {!product.image_url && (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {product.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryLabel(product.category)}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-red-500">
                        {product.points_required} 积分
                      </span>
                    </TableCell>
                    <TableCell>
                      {product.stock !== null ? product.stock : '无限制'}
                    </TableCell>
                    <TableCell>
                      {product.is_active ? (
                        <Badge className="bg-green-500">上架</Badge>
                      ) : (
                        <Badge variant="secondary">下架</Badge>
                      )}
                    </TableCell>
                    <TableCell>{product.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(product)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProduct ? '编辑商品' : '添加商品'}</DialogTitle>
            <DialogDescription>
              {selectedProduct ? '修改商品信息' : '创建新的积分商品'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">商品名称 *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="输入商品名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">所需积分 *</Label>
                <Input
                  id="points"
                  type="number"
                  value={formPoints}
                  onChange={(e) => setFormPoints(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">商品描述</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="输入商品描述"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">商品分类</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual">虚拟商品</SelectItem>
                  <SelectItem value="physical">实物商品</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">库存</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  placeholder="留空为无限制"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">排序</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>商品图片</Label>
              <div className="flex items-center gap-4">
                {formImageUrl ? (
                  <div className="relative">
                    <img
                      src={formImageUrl}
                      alt="商品图片"
                      className="w-20 h-20 object-cover rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={clearImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-muted rounded border flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? '上传中...' : '上传图片'}
                  </Button>
                  <p className="text-xs text-muted-foreground">支持 JPG、PNG，最大 5MB</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="isActive">上架商品</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
