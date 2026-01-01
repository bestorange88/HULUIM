export interface ImageQualityResult {
  passed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
  details: {
    resolution: { width: number; height: number; passed: boolean };
    fileSize: { size: number; passed: boolean };
    sharpness: { score: number; passed: boolean };
    brightness: { score: number; passed: boolean };
  };
}

/**
 * 检查图片质量
 * @param file 图片文件
 * @returns 质量检测结果
 */
export const checkImageQuality = async (file: File): Promise<ImageQualityResult> => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // 创建Image对象来加载图片
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) {
    throw new Error('无法创建canvas上下文');
  }

  // 设置canvas尺寸
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  // 1. 检查分辨率
  const minWidth = 800;
  const minHeight = 600;
  const resolutionPassed = img.width >= minWidth && img.height >= minHeight;
  
  if (!resolutionPassed) {
    issues.push(`分辨率过低 (${img.width}x${img.height})`);
    suggestions.push('请使用分辨率至少800x600的照片');
    score -= 30;
  }

  // 2. 检查文件大小
  const minSize = 100 * 1024; // 100KB
  const maxSize = 10 * 1024 * 1024; // 10MB
  const sizePassed = file.size >= minSize && file.size <= maxSize;
  
  if (file.size < minSize) {
    issues.push('文件太小，可能清晰度不足');
    suggestions.push('请上传更清晰的照片');
    score -= 20;
  } else if (file.size > maxSize) {
    issues.push('文件过大');
    suggestions.push('请压缩图片后重新上传');
    score -= 10;
  }

  // 3. 检查清晰度（使用拉普拉斯算子）
  const sharpnessScore = calculateSharpness(ctx, canvas.width, canvas.height);
  const sharpnessThreshold = 10; // 清晰度阈值
  const sharpnessPassed = sharpnessScore >= sharpnessThreshold;
  
  if (!sharpnessPassed) {
    issues.push('照片模糊不清');
    suggestions.push('请在光线充足的环境下拍摄，并确保对焦清晰');
    score -= 25;
  }

  // 4. 检查亮度
  const brightnessScore = calculateBrightness(ctx, canvas.width, canvas.height);
  const brightnessPassed = brightnessScore >= 80 && brightnessScore <= 200;
  
  if (brightnessScore < 80) {
    issues.push('照片过暗');
    suggestions.push('请在光线充足的环境下拍摄');
    score -= 15;
  } else if (brightnessScore > 200) {
    issues.push('照片过亮或曝光过度');
    suggestions.push('请避免强光直射，调整拍摄角度');
    score -= 15;
  }

  // 5. 综合建议
  if (issues.length === 0) {
    suggestions.push('照片质量良好，可以提交');
  }

  return {
    passed: score >= 60,
    score: Math.max(0, score),
    issues,
    suggestions,
    details: {
      resolution: { width: img.width, height: img.height, passed: resolutionPassed },
      fileSize: { size: file.size, passed: sizePassed },
      sharpness: { score: sharpnessScore, passed: sharpnessPassed },
      brightness: { score: brightnessScore, passed: brightnessPassed },
    },
  };
};

/**
 * 加载图片
 */
const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * 计算图片清晰度（拉普拉斯算子变化量）
 */
const calculateSharpness = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
  // 为了性能，只采样中心区域
  const sampleWidth = Math.min(400, width);
  const sampleHeight = Math.min(300, height);
  const startX = (width - sampleWidth) / 2;
  const startY = (height - sampleHeight) / 2;
  
  const imageData = ctx.getImageData(startX, startY, sampleWidth, sampleHeight);
  const data = imageData.data;
  
  let sum = 0;
  let count = 0;
  
  // 使用拉普拉斯算子检测边缘
  for (let y = 1; y < sampleHeight - 1; y++) {
    for (let x = 1; x < sampleWidth - 1; x++) {
      const idx = (y * sampleWidth + x) * 4;
      
      // 获取灰度值
      const center = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      // 上下左右四个方向的灰度值
      const top = (data[((y - 1) * sampleWidth + x) * 4] + 
                   data[((y - 1) * sampleWidth + x) * 4 + 1] + 
                   data[((y - 1) * sampleWidth + x) * 4 + 2]) / 3;
      const bottom = (data[((y + 1) * sampleWidth + x) * 4] + 
                      data[((y + 1) * sampleWidth + x) * 4 + 1] + 
                      data[((y + 1) * sampleWidth + x) * 4 + 2]) / 3;
      const left = (data[(y * sampleWidth + (x - 1)) * 4] + 
                    data[(y * sampleWidth + (x - 1)) * 4 + 1] + 
                    data[(y * sampleWidth + (x - 1)) * 4 + 2]) / 3;
      const right = (data[(y * sampleWidth + (x + 1)) * 4] + 
                     data[(y * sampleWidth + (x + 1)) * 4 + 1] + 
                     data[(y * sampleWidth + (x + 1)) * 4 + 2]) / 3;
      
      // 拉普拉斯算子
      const laplacian = Math.abs(4 * center - top - bottom - left - right);
      sum += laplacian;
      count++;
    }
  }
  
  return sum / count;
};

/**
 * 计算图片亮度
 */
const calculateBrightness = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
  // 采样中心区域
  const sampleWidth = Math.min(400, width);
  const sampleHeight = Math.min(300, height);
  const startX = (width - sampleWidth) / 2;
  const startY = (height - sampleHeight) / 2;
  
  const imageData = ctx.getImageData(startX, startY, sampleWidth, sampleHeight);
  const data = imageData.data;
  
  let sum = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    // 使用感知亮度公式
    const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += brightness;
  }
  
  return sum / (data.length / 4);
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
