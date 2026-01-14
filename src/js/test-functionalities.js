/**
 * 功能测试脚本
 * 用于验证所有新创建的模块是否正常工作
 */

// 测试通知管理器
function testNotificationManager() {
    console.log('🔔 测试通知管理器...');
    if (window.modernNav && window.modernNav.notificationManager) {
        try {
            window.modernNav.notificationManager.info('这是一条测试信息', '测试通知');
            window.modernNav.notificationManager.success('功能测试成功', '成功');
            console.log('✅ 通知管理器测试通过');
            return true;
        } catch (error) {
            console.error('❌ 通知管理器测试失败:', error);
            return false;
        }
    } else {
        console.error('❌ 通知管理器未找到');
        return false;
    }
}

// 测试UI管理器
function testUIManager() {
    console.log('🎨 测试UI管理器...');
    if (window.modernNav && window.modernNav.uiManager) {
        try {
            const deviceInfo = window.modernNav.uiManager.getDeviceInfo();
            console.log('设备信息:', deviceInfo);
            window.modernNav.uiManager.showToast('UI管理器测试', 'info');
            console.log('✅ UI管理器测试通过');
            return true;
        } catch (error) {
            console.error('❌ UI管理器测试失败:', error);
            return false;
        }
    } else {
        console.error('❌ UI管理器未找到');
        return false;
    }
}

// 测试图片优化器
function testImageOptimizer() {
    console.log('🖼️ 测试图片优化器...');
    if (window.modernNav && window.modernNav.imageOptimizer) {
        try {
            const stats = window.modernNav.imageOptimizer.getStats();
            console.log('图片优化器统计:', stats);
            console.log('✅ 图片优化器测试通过');
            return true;
        } catch (error) {
            console.error('❌ 图片优化器测试失败:', error);
            return false;
        }
    } else {
        console.error('❌ 图片优化器未找到');
        return false;
    }
}

// 测试搜索管理器
function testSearchManager() {
    console.log('🔍 测试搜索管理器...');
    if (window.modernNav && window.modernNav.searchManager) {
        try {
            const stats = window.modernNav.searchManager.getSearchStats();
            console.log('搜索管理器统计:', stats);
            console.log('✅ 搜索管理器测试通过');
            return true;
        } catch (error) {
            console.error('❌ 搜索管理器测试失败:', error);
            return false;
        }
    } else {
        console.error('❌ 搜索管理器未找到');
        return false;
    }
}

// 测试安全管理器
function testSecurityManager() {
    console.log('🔒 测试安全管理器...');
    if (window.modernNav && window.modernNav.securityManager) {
        try {
            const isLoggedIn = window.modernNav.securityManager.isLoggedIn();
            console.log('登录状态:', isLoggedIn);
            console.log('✅ 安全管理器测试通过');
            return true;
        } catch (error) {
            console.error('❌ 安全管理器测试失败:', error);
            return false;
        }
    } else {
        console.error('❌ 安全管理器未找到');
        return false;
    }
}

// 测试收藏管理器
function testFavoriteManager() {
    console.log('⭐ 测试收藏管理器...');
    if (window.modernNav && window.modernNav.favoriteManager) {
        try {
            const stats = window.modernNav.favoriteManager.getStats();
            console.log('收藏管理器统计:', stats);
            console.log('✅ 收藏管理器测试通过');
            return true;
        } catch (error) {
            console.error('❌ 收藏管理器测试失败:', error);
            return false;
        }
    } else {
        console.error('❌ 收藏管理器未找到');
        return false;
    }
}

// 测试应用初始化
function testAppInit() {
    console.log('🚀 测试应用初始化...');
    if (window.app && window.app.isInitialized) {
        console.log('✅ 应用初始化测试通过');
        return true;
    } else {
        console.error('❌ 应用未正确初始化');
        return false;
    }
}

// 运行所有测试
function runAllTests() {
    console.log('🧪 开始功能测试...\n');
    
    const tests = [
        testAppInit,
        testNotificationManager,
        testUIManager,
        testImageOptimizer,
        testSearchManager,
        testSecurityManager,
        testFavoriteManager
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(test => {
        try {
            if (test()) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error('测试执行错误:', error);
            failed++;
        }
        console.log(''); // 空行分隔
    });
    
    console.log('📊 测试结果总结:');
    console.log(`✅ 通过: ${passed} 个测试`);
    console.log(`❌ 失败: ${failed} 个测试`);
    console.log(`📈 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log('🎉 所有功能测试通过！网站优化完成。');
    } else {
        console.log('⚠️  部分功能存在问题，请检查错误信息。');
    }
    
    return failed === 0;
}

// 页面加载完成后运行测试
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runAllTests, 2000); // 等待2秒确保所有模块加载完成
    });
} else {
    setTimeout(runAllTests, 2000);
}

// 导出到全局作用域，方便手动调用
window.runTests = runAllTests;
window.testFeatures = {
    app: testAppInit,
    notifications: testNotificationManager,
    ui: testUIManager,
    images: testImageOptimizer,
    search: testSearchManager,
    security: testSecurityManager,
    favorites: testFavoriteManager
};