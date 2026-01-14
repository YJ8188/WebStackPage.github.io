const supabaseUrl = 'https://yzyhtqiwcbpqsglfbvqa.supabase.co';
const supabaseKey = 'sb_publishable_hgJCIbPhEyiCOWHV1hJMeg_QArg-t_v';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log('[Supabase] 客户端已初始化');
