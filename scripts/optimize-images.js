#!/usr/bin/env node

/**
 * 图片批量优化脚本
 * 将PNG/JPG图片转换为WebP格式，减小文件大小
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ImageBatchOptimizer {
  constructor() {
    this.assetsDir = path.join(__dirname, '../assets/images');
    this.outputDir = path.join(__dirname, '../assets/images/webp');
    this.convertedCount = 0;
    this.failedCount = 0;
    this.totalSizeSaved = 0;
  }

  /**
   * 初始化优化器
   */
  async init() {
    console.log('🖼️  图片批量优化工具启动...\n');
    
    // 检查cwebp工具是否可用
    try {
      await execAsync('cwebp -version');
      console.log('✅ cwebp 工具检测成功');
    } catch (error) {
      console.error('❌ cwebp 工具未找到，请先安装:');
      console.error('   Windows: choco install webp');
      console.error('   macOS: brew install webp');
      console.error('   Ubuntu: sudo apt-get install webp');
      process.exit(1);
    }
    
    // 创建输出目录
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    await this.startOptimization();
  }

  /**
   * 开始优化
   */
  async startOptimization() {
    const imageFiles = this.findImageFiles();
    
    if (imageFiles.length === 0) {
      console.log('📁 没有找到需要优化的图片文件');
      return;
    }
    
    console.log(`📊 找到 ${imageFiles.length} 个图片文件待优化\n`);
    
    const progressBar = this.createProgressBar(imageFiles.length);
    
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      await this.optimizeImage(file);
      
      // 更新进度条
      const progress = ((i + 1) / imageFiles.length * 100).toFixed(1);
      progressBar.update(i + 1, progress, file);
    }
    
    console.log('\n🎉 图片优化完成!');
    this.printSummary();
  }

  /**
   * 查找图片文件
   */
  findImageFiles() {
    const imageFiles = [];
    
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (this.isImageFile(file)) {
          imageFiles.push(fullPath);
        }
      });
    };
    
    walkDir(this.assetsDir);
    return imageFiles;
  }

  /**
   * 检查是否为图片文件
   */
  isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'].includes(ext);
  }

  /**
   * 优化单个图片
   */
  async optimizeImage(inputPath) {
    try {
      const ext = path.extname(inputPath).toLowerCase();
      const basename = path.basename(inputPath, ext);
      const relativePath = path.relative(this.assetsDir, inputPath);
      const outputDir = path.dirname(path.join(this.outputDir, relativePath));
      
      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, basename + '.webp');
      
      // 如果WebP文件已存在且比原文件新，跳过
      if (fs.existsSync(outputPath)) {
        const inputStat = fs.statSync(inputPath);
        const outputStat = fs.statSync(outputPath);
        
        if (outputStat.mtime > inputStat.mtime) {
          return;
        }
      }
      
      // 获取原文件大小
      const inputSize = fs.statSync(inputPath).size;
      
      // 转换为WebP
      const quality = ext === '.png' ? 90 : 85; // PNG用更高质量
      const command = `cwebp "${inputPath}" -q ${quality} -o "${outputPath}"`;
      
      await execAsync(command);
      
      // 计算节省的空间
      const outputSize = fs.statSync(outputPath).size;
      const sizeSaved = inputSize - outputSize;
      const percentSaved = ((sizeSaved / inputSize) * 100).toFixed(1);
      
      this.convertedCount++;
      this.totalSizeSaved += sizeSaved;
      
      // 记录优化信息
      console.log(`✅ ${path.basename(inputPath)} → ${path.basename(outputPath)} (节省 ${percentSaved}% = ${this.formatBytes(sizeSaved)})`);
      
    } catch (error) {
      console.error(`❌ 转换失败: ${inputPath} - ${error.message}`);
      this.failedCount++;
    }
  }

  /**
   * 创建进度条
   */
  createProgressBar(total) {
    let current = 0;
    
    return {
      update: (count, progress, filename) => {
        current = count;
        const barLength = 30;
        const filledLength = Math.round(barLength * progress / 100);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        process.stdout.write(`\r🔄 [${bar}] ${progress}% (${count}/${total}) ${path.basename(filename)}`);
      }
    };
  }

  /**
   * 格式化字节数
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 打印总结
   */
  printSummary() {
    console.log('\n📈 优化统计:');
    console.log(`   ✅ 成功转换: ${this.convertedCount} 个文件`);
    console.log(`   ❌ 转换失败: ${this.failedCount} 个文件`);
    console.log(`   💾 总共节省: ${this.formatBytes(this.totalSizeSaved)} 空间`);
    console.log(`   📁 WebP文件位置: ${this.outputDir}`);
    
    // 生成CSS映射文件
    this.generateCSSMapping();
    
    console.log('\n💡 使用建议:');
    console.log('   1. 在HTML中使用picture标签支持WebP降级');
    console.log('   2. 使用image-optimizer.js进行懒加载');
    console.log('   3. 配置服务器正确处理WebP MIME类型');
  }

  /**
   * 生成CSS映射文件
   */
  generateCSSMapping() {
    const mappingPath = path.join(__dirname, '../src/css/webp-mapping.css');
    let cssContent = `/* WebP图片映射 - 自动生成 */
/* 使用CSS变量方便切换图片格式 */\n\n`;
    
    // 遍历所有WebP文件生成CSS变量
    const walkDir = (dir, relativePath = '') => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath, path.join(relativePath, file));
        } else if (file.endsWith('.webp')) {
          const basename = path.basename(file, '.webp');
          const cssVarName = `--webp-${basename.replace(/[^a-zA-Z0-9]/g, '-')}`;
          const webpPath = path.join('/assets/images/webp', relativePath, file);
          
          cssContent += `${cssVarName}: url('${webpPath}');\n`;
        }
      });
    };
    
    walkDir(this.outputDir);
    
    fs.writeFileSync(mappingPath, cssContent);
    console.log(`📝 CSS映射文件已生成: ${mappingPath}`);
  }
}

// 运行优化器
if (require.main === module) {
  const optimizer = new ImageBatchOptimizer();
  optimizer.init().catch(console.error);
}

module.exports = ImageBatchOptimizer;