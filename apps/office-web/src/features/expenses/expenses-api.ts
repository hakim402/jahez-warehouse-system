import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { authenticatedJson, useSession } from '../../app/session';
import type { WarehouseScope } from '../../app/use-warehouse-scope';
import type { Language } from '../../app/i18n';

export type ExpenseCategory = { id: string; name: string; nameCn: string | null; active: boolean };
export type Expense = {
  id: string; expenseNo: string; warehouseId: string; amount: number; currency: string; expenseDate: string;
  categoryId: string; categoryName: string; customerId: string | null; customerName: string | null;
  customerMark: string | null; orderId: string | null; orderNo: string | null;
  invoiceFileId: string | null; noInvoiceNote: string | null; recordedBy: string; createdAt: string;
};
export type ExpenseInput = {
  clientOperationId: string; warehouseId: string; amount: string; currency: string; expenseDate: string;
  categoryId: string; customerId: string | null; orderId: string | null; invoiceFileId: string | null; noInvoiceNote: string | null;
};
export function categoryName(category: ExpenseCategory, language: Language) {
  return language === 'zh-Hans' && category.nameCn ? category.nameCn : category.name;
}
export function useExpenseCategories() {
  const { session } = useSession();
  const queryKey = ['expense-categories', session?.user.tenantId, session?.user.id] as const;
  return { ...useQuery({ queryKey, queryFn: async ({ signal }) => {
    const response = await authenticatedJson<{ categories: ExpenseCategory[] }>('/expense-categories', { signal });
    return response.categories;
  } }), queryKey };
}
export function useExpenses(scope: WarehouseScope) {
  return useQuery({
    queryKey: scope.queryKey('expenses'), enabled: scope.canRead && Boolean(scope.warehouseId), refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const response = await authenticatedJson<{ warehouseId: string; expenses: Expense[] }>(
        '/expenses?warehouseId=' + encodeURIComponent(scope.warehouseId!), { signal });
      if (response.warehouseId !== scope.warehouseId) throw new ApiError(404);
      return response.expenses;
    },
  });
}
export function recordExpense(input: ExpenseInput) {
  return authenticatedJson<Expense>('/expenses', { method: 'POST', json: input });
}
export function saveExpenseCategory(input: { name?: string; nameCn?: string | null; active?: boolean }, id?: string) {
  return authenticatedJson<ExpenseCategory>('/expense-categories' + (id ? '/' + encodeURIComponent(id) : ''), {
    method: id ? 'PATCH' : 'POST', json: input,
  });
}
