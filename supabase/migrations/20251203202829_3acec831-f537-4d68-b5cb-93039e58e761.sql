-- Clear existing avatar frames and add new beautiful frames for each membership tier
DELETE FROM public.avatar_frames;

-- 黄金会员 (Gold Member) Frames - required_tier: gold
INSERT INTO public.avatar_frames (id, name, description, style_class, required_tier, sort_order, is_active) VALUES
('gold-classic', '经典金框', '简约大气的金色边框', 'gold-classic', 'gold', 1, true),
('gold-shine', '璀璨金光', '闪耀的金色光芒', 'gold-shine', 'gold', 2, true),
('gold-royal', '皇家金辉', '尊贵的皇家金框', 'gold-royal', 'gold', 3, true);

-- 钻石会员 (Diamond Member) Frames - required_tier: diamond
INSERT INTO public.avatar_frames (id, name, description, style_class, required_tier, sort_order, is_active) VALUES
('diamond-ice', '冰晶钻石', '晶莹剔透的钻石光芒', 'diamond-ice', 'diamond', 4, true),
('diamond-crystal', '水晶之光', '闪烁的水晶边框', 'diamond-crystal', 'diamond', 5, true),
('diamond-aurora', '极光幻彩', '梦幻的极光效果', 'diamond-aurora', 'diamond', 6, true);

-- 至尊会员 (Elite Member) Frames - required_tier: elite  
INSERT INTO public.avatar_frames (id, name, description, style_class, required_tier, sort_order, is_active) VALUES
('elite-flame', '烈焰至尊', '燃烧的火焰边框', 'elite-flame', 'elite', 7, true),
('elite-galaxy', '银河星云', '神秘的星空效果', 'elite-galaxy', 'elite', 8, true),
('elite-supreme', '至尊荣耀', '最高荣耀的尊贵边框', 'elite-supreme', 'elite', 9, true);

-- 无边框选项 (No Frame)
INSERT INTO public.avatar_frames (id, name, description, style_class, required_tier, sort_order, is_active) VALUES
('no-frame', '无边框', '默认无边框', 'none', NULL, 0, true);