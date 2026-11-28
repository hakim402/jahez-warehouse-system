const copy = {
  exportExcel: ['Export Excel', 'تصدير Excel', '导出 Excel'],
  reportBuilder: ['Report builder', 'إعداد التقرير', '创建报表'],
  reportType: ['Report type', 'نوع التقرير', '报表类型'],
  reportReceived: ['Goods received', 'البضائع المستلمة', '收货明细'],
  reportDispatched: ['Goods dispatched', 'البضائع المشحونة', '发货明细'],
  reportInventory: ['Current inventory', 'المخزون الحالي', '当前库存'],
  reportMovements: ['Stock movements', 'حركات المخزون', '库存流水'],
  reportComparison: ['Order vs received', 'مقارنة الطلب والاستلام', '订单与收货对比'],
  reportOrder: ['Purchase order', 'أمر الشراء', '采购订单'],
  reportChooseOrder: ['Select a purchase order', 'اختر أمر شراء', '请选择采购订单'],
  reportAllOrders: ['All purchase orders', 'جميع أوامر الشراء', '全部采购订单'],
  reportGenerate: ['Generate Excel', 'إنشاء ملف Excel', '生成 Excel'],
  reportSubmitting: ['Submitting…', 'جارٍ الإرسال…', '正在提交…'],
  reportSubmitted: ['Export requested. Follow its progress in export history.', 'تم طلب التصدير. تابع تقدمه في سجل التصدير.', '已提交导出请求，请在导出历史中查看进度。'],
  reportScopeNote: ['The workbook uses the warehouse and filters selected here.', 'يستخدم الملف المستودع وعوامل التصفية المحددة هنا.', '工作簿使用当前仓库和此处选择的筛选条件。'],
  reportSubmitError: ['Could not confirm the request. Check export history before trying again.', 'تعذر تأكيد الطلب. تحقق من سجل التصدير قبل المحاولة مجدداً.', '无法确认请求，请先查看导出历史再重试。'],
  reportHistory: ['Export history', 'سجل التصدير', '导出历史'],
  reportFilters: ['Filters', 'عوامل التصفية', '筛选条件'],
  reportFilterValue: ['{{label}}: {{value}}', '{{label}}: {{value}}', '{{label}}：{{value}}'],
  reportNoFilters: ['All records', 'جميع السجلات', '全部记录'],
  reportRequestedAt: ['Requested at', 'وقت الطلب', '请求时间'],
  reportRefresh: ['Refresh', 'تحديث', '刷新'],
  reportEmpty: ['No exports yet.', 'لا توجد عمليات تصدير بعد.', '暂无导出记录。'],
  reportHistoryLimit: ['Showing the latest 100 export requests.', 'يتم عرض أحدث ١٠٠ طلب تصدير.', '显示最近 100 条导出请求。'],
  reportViewError: ['View error', 'عرض الخطأ', '查看错误'],
  reportJobFailed: ['The workbook could not be generated. Review the report filters and submit a new request.', 'تعذر إنشاء الملف. راجع عوامل التصفية وأرسل طلباً جديداً.', '无法生成工作簿，请检查筛选条件后重新提交。'],
  reportDownloading: ['Downloading…', 'جارٍ التنزيل…', '正在下载…'],
  reportDownloadError: ['Could not download the workbook. Refresh the history and try again.', 'تعذر تنزيل الملف. حدّث السجل وحاول مجدداً.', '无法下载工作簿，请刷新历史记录后重试。'],
} as const;

const statuses = {
  queued: ['Queued', 'في قائمة الانتظار', '排队中'],
  processing: ['Processing', 'قيد المعالجة', '处理中'],
  completed: ['Ready', 'جاهز', '已就绪'],
  failed: ['Failed', 'فشل', '失败'],
} as const;

export function reportCopy(language: 0 | 1 | 2) {
  return {
    ...Object.fromEntries(Object.entries(copy).map(([key, values]) => [key, values[language]])),
    exportStatus: Object.fromEntries(Object.entries(statuses).map(([key, values]) => [key, values[language]])),
  };
}
