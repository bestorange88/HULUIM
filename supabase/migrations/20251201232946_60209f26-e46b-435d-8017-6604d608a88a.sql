-- Add tags and group_note fields to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS group_note TEXT;