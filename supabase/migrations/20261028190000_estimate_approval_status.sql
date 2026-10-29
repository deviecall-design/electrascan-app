-- Approval state for a saved estimate. Does not delete rows.
-- estimates.status keeps its existing check (draft, sent, viewed, approved).
-- approval_status is the Approvals queue: ready, sent for signature, signed, materials sent.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS approval_status text;

UPDATE public.estimates
SET approval_status = CASE
  WHEN status = 'approved' THEN 'approved'
  WHEN status IN ('sent', 'viewed') THEN 'sent_for_signature'
  ELSE 'ready_for_approval'
END
WHERE approval_status IS NULL;

ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_approval_status_check;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_approval_status_check
  CHECK (
    approval_status IS NULL
    OR approval_status IN (
      'ready_for_approval',
      'sent_for_signature',
      'approved',
      'materials_sent'
    )
  );
