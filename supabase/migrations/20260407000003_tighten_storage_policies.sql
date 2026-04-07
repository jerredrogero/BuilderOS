-- Tighten storage bucket policies
-- Replace overly broad "any authenticated user" policies with builder/buyer-scoped access

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;

-- New upload policy: only allow uploads if the user is a builder member (owner or staff)
-- for the builder_id in the storage path, OR a buyer assigned to the home in the path.
-- Storage paths follow: {builder_id}/{homeId}/... or {builder_id}/templates/... or {builder_id}/logo-...
CREATE POLICY "Builder members can upload files" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (
      -- Builder members (owner or staff): path starts with their builder_id
      (storage.foldername(name))[1] IN (
        SELECT b.id::text FROM builders b
        JOIN memberships bm ON bm.builder_id = b.id
        WHERE bm.user_id = auth.uid() AND bm.role IN ('owner', 'staff')
      )
      OR
      -- Buyers: second path segment is a home_id they are assigned to
      EXISTS (
        SELECT 1 FROM home_assignments ha
        WHERE ha.user_id = auth.uid()
        AND (storage.foldername(name))[2] = ha.home_id::text
      )
    )
  );

-- New read policy: builder members can read files in their builder's path,
-- buyers can read files for homes they are assigned to
CREATE POLICY "Authorized users can read files" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (
      -- Builder members (owner or staff): path starts with their builder_id
      (storage.foldername(name))[1] IN (
        SELECT b.id::text FROM builders b
        JOIN memberships bm ON bm.builder_id = b.id
        WHERE bm.user_id = auth.uid() AND bm.role IN ('owner', 'staff')
      )
      OR
      -- Buyers: second path segment is a home_id they are assigned to
      EXISTS (
        SELECT 1 FROM home_assignments ha
        WHERE ha.user_id = auth.uid()
        AND (storage.foldername(name))[2] = ha.home_id::text
      )
    )
  );

-- Delete policy: only builder owners can delete storage objects
CREATE POLICY "Builder owners can delete files" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT b.id::text FROM builders b
      JOIN memberships bm ON bm.builder_id = b.id
      WHERE bm.user_id = auth.uid() AND bm.role = 'owner'
    )
  );
