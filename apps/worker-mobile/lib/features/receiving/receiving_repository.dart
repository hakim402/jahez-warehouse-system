import '../../api/worker_order.dart';
import '../../app/session/session_controller.dart';
import '../../offline/receiving_store.dart';

class ReceivingRepository {
  const ReceivingRepository(this._session, this._store, this._scope);

  final SessionController _session;
  final ReceivingStore _store;
  final String _scope;

  bool get active => _session.receivingScope == _scope;

  Future<CachedReceiving> read() => _store.read(_scope);

  Future<void> refresh(bool Function() isOpen) async {
    final queue = await _session.fetchReceivingQueue(_scope);
    await _store.replaceQueue(_scope, queue, () => active && isOpen());
  }

  Future<ReceiptDraft?> saveCartons(
    WorkerOrder order,
    WorkerOrderLine line,
    int cartons,
  ) => _store.saveCartons(_scope, order, line, cartons, () => active);
}
