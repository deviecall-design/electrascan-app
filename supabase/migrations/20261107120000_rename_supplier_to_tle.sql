-- Relabel the stored supplier from Lawrence & Hanson / L&H to TLE.
-- Rows stay. Other supplier names are not changed. Nothing is dropped.

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.workspace_settings',
    'public.materials_requests',
    'public.supplier_price_links'
  ]
  LOOP
    IF to_regclass(target) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      $sql$
        UPDATE %s
        SET supplier_name = 'TLE'
        WHERE lower(btrim(replace(supplier_name, '&amp;', '&'))) IN (
          'lawrence & hanson',
          'lawrence and hanson',
          'l&h',
          'l & h',
          'l and h'
        )
      $sql$,
      target
    );
    EXECUTE format(
      'ALTER TABLE %s ALTER COLUMN supplier_name SET DEFAULT %L',
      target,
      'TLE'
    );
  END LOOP;
END $$;
