class WorkerConfig {
  const WorkerConfig({
    this.apiBaseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'https://api.jahez.online/api/v1',
    ),
    this._warehouseId = const String.fromEnvironment(
      'WAREHOUSE_ID',
      defaultValue: yiwuWarehouseId,
    ),
    this._tenantId = const String.fromEnvironment('TENANT_ID'),
  });

  // Public routing identifier from the deployed Office Web configuration.
  static const yiwuWarehouseId = 'ef334d51-f70d-4959-bc64-44c6c500abbc';

  static final _uuid = RegExp(
    r'^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );

  final String apiBaseUrl;
  final String _warehouseId;
  final String _tenantId;

  String get warehouseId => _warehouseId.trim().toLowerCase();
  String get tenantId => _tenantId.trim().toLowerCase();

  Uri? get apiUri {
    final uri = Uri.tryParse(apiBaseUrl.trim());
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        !_uuid.hasMatch(warehouseId) ||
        (tenantId.isNotEmpty && !_uuid.hasMatch(tenantId))) {
      return null;
    }
    return uri.replace(path: uri.path.replaceFirst(RegExp(r'/+$'), ''));
  }

  String get sessionScope => '$apiUri|$warehouseId|$tenantId';
}
