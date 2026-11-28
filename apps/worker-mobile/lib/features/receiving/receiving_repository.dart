import '../../api/worker_order.dart';
import '../../app/session/session_controller.dart';
import '../../offline/receiving_store.dart';

class ReceivingRepository {
  ReceivingRepository(this._session, this._store, this._scope)
    : _ownerScope = _session.receivingOwnerScope!;

  final SessionController _session;
  final ReceivingStore _store;
  final String _scope;
  final String _ownerScope;

  bool get active => _session.receivingScope == _scope;

  Future<CachedReceiving> read() =>
      _store.read(_scope, ownerScope: _ownerScope);

  Future<void> refresh(bool Function() isOpen) async {
    final queue = await _session.fetchReceivingQueue(_scope);
    await _store.replaceQueue(_scope, queue, () => active && isOpen());
  }

  Future<ReceiptDraft?> saveCartons(
    WorkerOrder order,
    WorkerOrderLine line,
    int cartons,
  ) => _store.saveCartons(
    _scope,
    order,
    line,
    cartons,
    () => active,
    ownerScope: _ownerScope,
  );

  Future<ReceiptDraft?> saveDetails(
    WorkerOrder order,
    WorkerOrderLine line,
    ReceiptLineDetails details,
  ) => _store.saveDetails(
    _scope,
    _ownerScope,
    order,
    line,
    details,
    () => active,
  );

  Future<LocalReceipt?> confirm(WorkerOrder order) => _store.confirm(
    _scope,
    _ownerScope,
    _session.config.warehouseId,
    order,
    () => active,
  );
}
