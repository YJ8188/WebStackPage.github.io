const supabaseUrl = 'https://yzyhtqiwcbpqsglfbvqa.supabase.co';
const supabaseKey = 'sb_publishable_hgJCIbPhEyiCOWHV1hJMeg_QArg-t_v';

console.log('[Supabase] URL:', supabaseUrl);
console.log('[Supabase] Key:', supabaseKey);
console.log('[Supabase] Key 长度:', supabaseKey.length);

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log('[Supabase] 客户端已初始化');
console.log('[Supabase] 客户端:', supabaseClient);
