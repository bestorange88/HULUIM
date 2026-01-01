import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface UseApiCallOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
}

export function useApiCall<T = any>(options: UseApiCallOptions<T> = {}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (apiFunction: () => Promise<T>) => {
      setLoading(true);
      setError(null);

      let toastId: string | number | undefined;
      if (options.loadingMessage) {
        toastId = toast.loading(options.loadingMessage);
      }

      try {
        const result = await apiFunction();
        setData(result);

        if (toastId) toast.dismiss(toastId);
        if (options.successMessage) {
          toast.success(options.successMessage);
        }

        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        if (toastId) toast.dismiss(toastId);
        
        const errorMsg = options.errorMessage || error.message || t("common.error");
        toast.error(errorMsg);

        options.onError?.(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [options, t]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { execute, loading, error, data, reset };
}
