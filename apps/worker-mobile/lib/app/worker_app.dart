import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/worker_api.dart';
import '../l10n/generated/worker_strings.dart';
import '../offline/open_worker_database.dart';
import '../offline/receiving_store.dart';
import '../offline/worker_database.dart';
import 'session/session_controller.dart';
import 'session/session_screen.dart';
import 'session/session_store.dart';
import 'session/sign_in_screen.dart';
import 'worker_config.dart';
import 'worker_shell.dart';
import 'worker_theme.dart';

class WorkerApp extends StatefulWidget {
  const WorkerApp({
    super.key,
    this.config = const WorkerConfig(),
    this.api,
    this.receivingStore,
  });

  final WorkerConfig config;
  final WorkerApi? api;
  final ReceivingStore? receivingStore;

  @override
  State<WorkerApp> createState() => _WorkerAppState();
}

class _WorkerAppState extends State<WorkerApp> with WidgetsBindingObserver {
  final _store = SessionStore();
  final _navigator = GlobalKey<NavigatorState>();
  late final WorkerApi _api = widget.api ?? WorkerApi(widget.config.apiUri);
  late final ReceivingStore _receiving =
      widget.receivingStore ??
      ReceivingStore(WorkerDatabase(openWorkerDatabase()));
  late final SessionController _session = SessionController(
    config: widget.config,
    api: _api,
    store: _store,
    purgePrivateData: _receiving.purge,
  );
  Locale _locale = const Locale('en');
  bool _backgrounded = false;
  bool _localeSelected = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _session.addListener(_closeSessionDialogs);
    unawaited(_start());
  }

  Future<void> _start() async {
    await _session.start();
    if (mounted) await _restoreLanguage();
  }

  void _closeSessionDialogs() {
    if (_session.phase == SessionPhase.ready) return;
    _navigator.currentState?.popUntil((route) => route.isFirst);
  }

  Future<void> _restoreLanguage() async {
    try {
      final language = await _store.readLanguage();
      if (!mounted || _localeSelected) return;
      if (WorkerStrings.supportedLocales.any(
        (locale) => locale.languageCode == language,
      )) {
        setState(() => _locale = Locale(language!));
      }
    } on PlatformException {
      // Keep the default locale available while the session handles storage errors.
    }
  }

  Future<void> _changeLanguage(Locale locale) async {
    _localeSelected = true;
    _session.markActivity();
    setState(() => _locale = locale);
    try {
      await _store.saveLanguage(locale.languageCode);
    } on PlatformException {
      // The user can continue in the selected language for this launch.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.hidden ||
        state == AppLifecycleState.paused) {
      if (!_backgrounded) _session.backgrounded();
      _backgrounded = true;
    } else if (state == AppLifecycleState.resumed && _backgrounded) {
      _backgrounded = false;
      unawaited(_session.resumed());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _session.dispose();
    if (widget.api == null) _api.close();
    if (widget.receivingStore == null) unawaited(_receiving.close());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigator,
      debugShowCheckedModeBanner: false,
      onGenerateTitle: (context) => WorkerStrings.of(context).appName,
      locale: _locale,
      supportedLocales: WorkerStrings.supportedLocales,
      localizationsDelegates: WorkerStrings.localizationsDelegates,
      theme: workerTheme(_locale),
      builder: (context, child) => Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: (_) => _session.markActivity(),
        onPointerSignal: (_) => _session.markActivity(),
        child: Focus(
          canRequestFocus: false,
          onKeyEvent: (_, _) {
            _session.markActivity();
            return KeyEventResult.ignored;
          },
          child: child!,
        ),
      ),
      home: ListenableBuilder(
        listenable: _session,
        builder: (context, _) => switch (_session.phase) {
          SessionPhase.signedOut || SessionPhase.signingIn => SignInScreen(
            session: _session,
            locale: _locale,
            onLocaleChanged: _changeLanguage,
          ),
          SessionPhase.ready => WorkerShell(
            session: _session,
            receivingStore: _receiving,
            locale: _locale,
            onLocaleChanged: _changeLanguage,
          ),
          _ => SessionScreen(session: _session),
        },
      ),
    );
  }
}
