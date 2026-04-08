import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zxeznkuodpseijkvjwxa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_G18eiBCQd7apcIbTx4275Q_Kkbx8nFk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
