/**
 * 图片优化模块
 * 负责图片懒加载、格式转换、压缩等优化功能
 */
export class ImageOptimizer {
  constructor() {
    this.observer = null;
    this.optimizedImages = new Map();
    this.isWebPSupported = this.checkWebPSupport();
    this.init();
  }

  /**
   * 初始化图片优化器
   */
  init() {
    this.setupLazyLoading();
    this.optimizeExistingImages();
    console.log('图片优化器初始化完成');
  }

  /**
   * 检查WebP支持
   */
  checkWebPSupport() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * 设置懒加载
   */
  setupLazyLoading() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });
    }
  }

  /**
   * 加载图片
   */
  loadImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;
    const sizes = img.dataset.sizes;
    
    if (src) {
      img.src = src;
    }
    
    if (srcset) {
      img.srcset = srcset;
    }
    
    if (sizes) {
      img.sizes = sizes;
    }
    
    img.classList.add('loaded');
    
    // 添加加载动画
    img.classList.remove('loading');
    
    // 图片加载事件
    img.addEventListener('load', () => {
      img.classList.add('img-loaded');
    });
    
    img.addEventListener('error', () => {
      img.classList.add('img-error');
      this.handleImageError(img);
    });
  }

  /**
   * 处理图片加载错误
   */
  handleImageError(img) {
    // 设置默认图片
    img.src = '/assets/images/placeholder.png';
    img.alt = '图片加载失败';
  }

  /**
   * 优化现有图片
   */
  optimizeExistingImages() {
    // 为所有现有图片添加懒加载
    document.querySelectorAll('img:not([data-lazy="false"])').forEach(img => {
      this.setupLazyImage(img);
    });

    // 为卡片背景图片添加懒加载
    document.querySelectorAll('[data-bg-image]').forEach(element => {
      this.setupLazyBackground(element);
    });
  }

  /**
   * 设置懒加载图片
   */
  setupLazyImage(img) {
    // 如果图片已有src，移动到data-src
    if (img.src && !img.dataset.src) {
      img.dataset.src = img.src;
      img.src = this.getPlaceholderImage();
      img.classList.add('loading');
    }

    // 观察图片
    if (this.observer) {
      this.observer.observe(img);
    } else {
      // 降级到立即加载
      this.loadImage(img);
    }
  }

  /**
   * 设置懒加载背景图
   */
  setupLazyBackground(element) {
    const bgImage = element.dataset.bgImage;
    
    if (bgImage && this.observer) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            element.style.backgroundImage = `url(${bgImage})`;
            element.classList.add('bg-loaded');
            observer.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '50px 0px'
      });
      
      observer.observe(element);
    } else {
      // 降级
      element.style.backgroundImage = `url(${bgImage})`;
    }
  }

  /**
   * 获取占位图片
   */
  getPlaceholderImage() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMGYwZjAiLz48L3N2Zz4=';
  }

  /**
   * 创建响应式图片
   */
  createResponsiveImage(src, alt, sizes = []) {
    const picture = document.createElement('picture');
    
    if (this.isWebPSupported) {
      // WebP源
      const webpSource = document.createElement('source');
      const webpSrcset = this.generateSrcSet(src, 'webp');
      webpSource.srcset = webpSrcset;
      webpSource.type = 'image/webp';
      picture.appendChild(webpSource);
    }
    
    // 降级源
    const img = document.createElement('img');
    img.dataset.src = this.generateSrcSet(src);
    img.alt = alt;
    img.className = 'lazy-image loading';
    img.decoding = 'async';
    
    picture.appendChild(img);
    
    // 设置懒加载
    this.setupLazyImage(img);
    
    return picture;
  }

  /**
   * 生成源集
   */
  generateSrcSet(baseSrc, format = 'original') {
    const sizes = [320, 640, 768, 1024, 1280, 1536];
    const srcset = [];
    
    sizes.forEach(width => {
      const optimizedSrc = this.getOptimizedSrc(baseSrc, width, format);
      srcset.push(`${optimizedSrc} ${width}w`);
    });
    
    return srcset.join(', ');
  }

  /**
   * 获取优化后的图片地址
   */
  getOptimizedSrc(originalSrc, width, format = 'original') {
    // 如果是WebP请求，尝试转换格式
    if (format === 'webp') {
      return originalSrc.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    }
    
    // 如果是其他格式，保持原样
    return originalSrc;
  }

  /**
   * 压缩图片
   */
  async compressImage(file, quality = 0.8, maxWidth = 1920) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // 计算新尺寸
        let { width, height } = img;
        
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = height * ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制压缩后的图片
        ctx.drawImage(img, 0, 0, width, height);
        
        // 转换为Blob
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 转换为WebP
   */
  async convertToWebP(file, quality = 0.8) {
    if (!this.isWebPSupported) {
      return file; // 不支持WebP，返回原文件
    }
    
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 绘制图片
        ctx.drawImage(img, 0, 0);
        
        // 转换为WebP
        canvas.toBlob(resolve, 'image/webp', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 批量优化图片
   */
  async batchOptimize(files, options = {}) {
    const {
      quality = 0.8,
      maxWidth = 1920,
      convertToWebP = true,
      progressCallback = null
    } = options;
    
    const results = [];
    const total = files.length;
    
    for (let i = 0; i < total; i++) {
      const file = files[i];
      
      try {
        let processedFile = file;
        
        // 压缩图片
        if (file.type.startsWith('image/')) {
          processedFile = await this.compressImage(file, quality, maxWidth);
          
          // 转换为WebP
          if (convertToWebP && this.isWebPSupported) {
            processedFile = await this.convertToWebP(processedFile, quality);
          }
        }
        
        results.push({
          original: file,
          optimized: processedFile,
          success: true,
          index: i
        });
        
      } catch (error) {
        results.push({
          original: file,
          optimized: null,
          success: false,
          error: error.message,
          index: i
        });
      }
      
      // 进度回调
      if (progressCallback) {
        progressCallback(i + 1, total, results[i]);
      }
    }
    
    return results;
  }

  /**
   * 获取图片信息
   */
  getImageInfo(file) {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height,
          size: file.size,
          type: file.type,
          name: file.name
        });
      };
      
      img.onerror = () => {
        resolve({
          width: 0,
          height: 0,
          aspectRatio: 0,
          size: file.size,
          type: file.type,
          name: file.name,
          error: 'Failed to load image'
        });
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 预加载图片
   */
  preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = reject;
      
      img.src = src;
    });
  }

  /**
   * 批量预加载图片
   */
  async preloadImages(srcs) {
    const promises = srcs.map(src => this.preloadImage(src));
    return Promise.allSettled(promises);
  }

  /**
   * 创建图片加载指示器
   */
  createLoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'image-loading-indicator';
    indicator.innerHTML = `
      <div class="spinner-border spinner-border-sm" role="status">
        <span class="visually-hidden">加载中...</span>
      </div>
    `;
    return indicator;
  }

  /**
   * 添加新的懒加载图片
   */
  addLazyImage(container, src, alt = '', className = '') {
    const img = document.createElement('img');
    img.dataset.src = src;
    img.alt = alt;
    img.className = `lazy-image loading ${className}`;
    img.decoding = 'async';
    
    container.appendChild(img);
    this.setupLazyImage(img);
    
    return img;
  }

  /**
   * 监听新添加的图片
   */
  observeNewImages() {
    // 使用MutationObserver监听DOM变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查新添加的图片
            if (node.tagName === 'IMG') {
              this.setupLazyImage(node);
            } else if (node.querySelectorAll) {
              // 检查子元素中的图片
              node.querySelectorAll('img').forEach(img => {
                this.setupLazyImage(img);
              });
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    return observer;
  }

  /**
   * 销毁图片优化器
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.optimizedImages.clear();
  }

  /**
   * 获取优化统计
   */
  getStats() {
    return {
      supportedFormats: {
        webp: this.isWebPSupported
      },
      optimizedCount: this.optimizedImages.size,
      observerActive: this.observer !== null
    };
  }
}

// 导出单例实例
export const imageOptimizer = new ImageOptimizer();

// 导出到全局作用域（向后兼容）
window.imageOptimizer = imageOptimizer;