// Form validation utilities

export const validators = {
  phone: (value: string): string | null => {
    if (!value) return "手机号不能为空";
    // 支持11位及以上的手机号（国际号码可能超过11位）
    if (!/^\d{11,15}$/.test(value.replace(/^\+/, '').replace(/\s/g, ''))) {
      return "请输入有效的手机号（11-15位数字）";
    }
    return null;
  },

  idCard: (value: string): string | null => {
    if (!value) return "身份证号不能为空";
    if (!/^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/.test(value)) {
      return "请输入有效的身份证号";
    }
    return null;
  },

  amount: (value: number, min?: number, max?: number): string | null => {
    if (value <= 0) return "金额必须大于0";
    if (min !== undefined && value < min) return `最小金额为 ${min}`;
    if (max !== undefined && value > max) return `最大金额为 ${max}`;
    return null;
  },

  required: (value: any, fieldName: string = "此字段"): string | null => {
    if (!value || (typeof value === "string" && !value.trim())) {
      return `${fieldName}不能为空`;
    }
    return null;
  },

  minLength: (value: string, min: number, fieldName: string = "此字段"): string | null => {
    if (value.length < min) return `${fieldName}至少需要${min}个字符`;
    return null;
  },

  maxLength: (value: string, max: number, fieldName: string = "此字段"): string | null => {
    if (value.length > max) return `${fieldName}不能超过${max}个字符`;
    return null;
  },

  email: (value: string): string | null => {
    if (!value) return "邮箱不能为空";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "请输入有效的邮箱地址";
    return null;
  },

  url: (value: string): string | null => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return "请输入有效的URL";
    }
  },

  number: (value: any): string | null => {
    if (isNaN(Number(value))) return "请输入有效的数字";
    return null;
  }
};

export type ValidationRule = (value: any) => string | null;

export const validate = (value: any, rules: ValidationRule[]): string | null => {
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return null;
};
