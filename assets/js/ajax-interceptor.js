/**
 * AJAX 请求拦截器
 * 功能：在 HTTPS 页面上自动处理 HTTP 请求的 Mixed Content 问题
 * 优先尝试 HTTPS，失败后降级到 HTTP
 */

// 立即执行，不等待 jQuery
console.log('[AJAX拦截器] 文件已加载！');

(function() {
    // 检查是否已经拦截过
    if (window._ajaxInterceptorInstalled) {
        console.log('[AJAX拦截器] 已经安装过，跳过');
        return;
    }
    window._ajaxInterceptorInstalled = true;
    
    console.log('[AJAX拦截器] 开始安装...');
    
    // 等待 jQuery 加载完成
    function installInterceptor() {
        if (typeof $ === 'undefined' || !$.ajax) {
            console.log('[AJAX拦截器] 等待 jQuery 加载... (当前状态: $=' + (typeof $ !== 'undefined') + ', $.ajax=' + (typeof $ !== 'undefined' && $.ajax) + ')');
            setTimeout(installInterceptor, 100);
            return;
        }
        
        console.log('[AJAX拦截器] jQuery 已加载，开始拦截 AJAX 请求');
        
        // 保存原始的 jQuery ajax 方法
        var originalAjax = $.ajax;
        
        // 重写 jQuery ajax 方法
        $.ajax = function(options) {
            var originalUrl = options.url;
            
            console.log('[AJAX拦截器] 拦截到请求: ' + originalUrl);
            
            // 如果页面是 HTTPS，且 URL 是 HTTP
            if (window.location.protocol === 'https:' && originalUrl && originalUrl.indexOf('http://') === 0) {
                // 先尝试 HTTPS
                var httpsUrl = originalUrl.replace('http://', 'https://');
                
                console.log('[AJAX拦截器] 检测到 HTTPS 页面，尝试使用 HTTPS: ' + httpsUrl);
                
                // 创建一个新的 options 对象
                var httpsOptions = $.extend({}, options, {
                    url: httpsUrl
                });
                
                // 尝试 HTTPS 请求
                var deferred = $.Deferred();
                
                originalAjax(httpsOptions)
                    .done(function(data, textStatus, jqXHR) {
                        console.log('[AJAX拦截器] ✓ HTTPS 请求成功');
                        deferred.resolve(data, textStatus, jqXHR);
                    })
                    .fail(function(jqXHR, textStatus, errorThrown) {
                        // 如果 HTTPS 失败，降级到 HTTP（会有 Mixed Content 警告）
                        console.warn('[AJAX拦截器] ✗ HTTPS 请求失败，降级使用 HTTP: ' + originalUrl);
                        
                        // 创建降级的请求
                        var httpOptions = $.extend({}, options, {
                            url: originalUrl
                        });
                        
                        originalAjax(httpOptions)
                            .done(function(data, textStatus, jqXHR) {
                                console.log('[AJAX拦截器] ✓ HTTP 降级请求成功');
                                deferred.resolve(data, textStatus, jqXHR);
                            })
                            .fail(function(jqXHR, textStatus, errorThrown) {
                                console.error('[AJAX拦截器] ✗ HTTP 请求也失败');
                                deferred.reject(jqXHR, textStatus, errorThrown);
                            });
                    });
                
                return deferred.promise();
            } else {
                // 不是 HTTPS 页面，或者 URL 已经是 HTTPS，直接使用原始请求
                console.log('[AJAX拦截器] 跳过拦截，直接使用原始请求');
                return originalAjax(options);
            }
        };
        
        console.log('[AJAX拦截器] ✓ 安装成功！');
    }
    
    // 立即尝试安装
    installInterceptor();
})();
