/**
 * Cloudflare Pages Functions - 币安API代理
 * 用于解决国内无法直接访问币安API的问题
 */
export async function onRequest(context) {
  const { request, env } = context;
  
  // 处理CORS预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const url = new URL(request.url);
    
    // 提取路径参数
    const path = url.pathname.replace('/api/binance', '');
    const query = url.search;
    
    // 构建币安API URL
    const binanceUrl = `https://api.binance.com${path}${query}`;
    
    console.log(`[币安代理] 请求: ${binanceUrl}`);
    
    // 转发请求到币安
    const binanceResponse = await fetch(binanceUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    
    // 获取响应数据
    const data = await binanceResponse.text();
    
    // 返回响应
    return new Response(data, {
      status: binanceResponse.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10', // 缓存10秒
      },
    });
    
  } catch (error) {
    console.error('[币安代理] 错误:', error);
    return new Response(JSON.stringify({ 
      error: '代理请求失败',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    });
  }
}