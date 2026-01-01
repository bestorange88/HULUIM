-- Add avatar frame field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_frame TEXT DEFAULT 'none';

COMMENT ON COLUMN profiles.avatar_frame IS 'User selected avatar frame style';

-- Create avatar frames table for available frames
CREATE TABLE IF NOT EXISTS avatar_frames (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  style_class TEXT NOT NULL,
  required_tier TEXT, -- 'gold', 'diamond', 'elite', or null for free
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE avatar_frames ENABLE ROW LEVEL SECURITY;

-- Everyone can view active frames
CREATE POLICY "Anyone can view active avatar frames"
  ON avatar_frames FOR SELECT
  USING (is_active = true);

-- Insert default avatar frames
INSERT INTO avatar_frames (id, name, description, style_class, required_tier, sort_order) VALUES
  ('none', '无边框', '默认样式，无头像框', 'none', null, 0),
  ('basic_gold', '金色光环', '基础金色边框', 'basic-gold', null, 1),
  ('basic_silver', '银色光环', '基础银色边框', 'basic-silver', null, 2),
  ('gold_crown', '黄金皇冠', '黄金会员专属皇冠边框', 'gold-crown', 'gold', 10),
  ('gold_luxury', '金色奢华', '黄金会员专属奢华边框', 'gold-luxury', 'gold', 11),
  ('diamond_shine', '钻石光辉', '钻石会员专属闪耀边框', 'diamond-shine', 'diamond', 20),
  ('diamond_star', '钻石星辰', '钻石会员专属星辰边框', 'diamond-star', 'diamond', 21),
  ('elite_phoenix', '至尊凤凰', '至尊会员专属凤凰边框', 'elite-phoenix', 'elite', 30),
  ('elite_dragon', '至尊神龙', '至尊会员专属神龙边框', 'elite-dragon', 'elite', 31),
  ('elite_supreme', '至尊荣耀', '至尊会员专属荣耀边框', 'elite-supreme', 'elite', 32)
ON CONFLICT (id) DO NOTHING;