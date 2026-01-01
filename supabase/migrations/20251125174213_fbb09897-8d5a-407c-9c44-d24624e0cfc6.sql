-- Remove conflicting restrictive policy that limits access to user's own files only
DROP POLICY IF EXISTS "Users can view their conversation files" ON storage.objects;