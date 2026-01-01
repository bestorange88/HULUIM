-- Make created_by NOT NULL and set default value
ALTER TABLE public.conversations 
ALTER COLUMN created_by SET NOT NULL,
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Update any existing null values
UPDATE public.conversations 
SET created_by = auth.uid() 
WHERE created_by IS NULL;