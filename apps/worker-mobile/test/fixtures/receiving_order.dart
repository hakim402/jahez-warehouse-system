import 'package:worker_mobile/api/worker_order.dart';

WorkerOrder fixtureOrder([String id = 'order-one']) => WorkerOrder.fromJson({
  'id': id,
  'orderNo': 'TEST-001',
  'status': 'ready',
  'supplier': {'name': 'Synthetic Supplier', 'nameCn': null},
  'customer': {'shippingMark': 'TEST-MARK'},
  'expectedCartons': 4,
  'remainingCartons': 4,
  'lines': [
    {
      'id': 'line-one',
      'remainingCartons': 4,
      'product': {'nameEn': 'Paper boxes'},
      'unitPrice': 'never-store-this',
    },
  ],
  'totalAmount': 'never-store-this',
});
