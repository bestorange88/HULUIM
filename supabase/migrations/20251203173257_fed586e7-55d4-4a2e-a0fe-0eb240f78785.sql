-- Set default require_approval to true for new conversations
ALTER TABLE public.conversations 
ALTER COLUMN require_approval SET DEFAULT true;

-- Update existing groups that don't have require_approval set
UPDATE public.conversations 
SET require_approval = true 
WHERE type = 'group' AND require_approval IS NULL;