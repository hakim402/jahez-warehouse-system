import 'package:flutter/material.dart';

import '../features/home/home_screen.dart';
import '../features/settings/settings_screen.dart';
import '../l10n/generated/worker_strings.dart';
import 'session/session_controller.dart';

class WorkerShell extends StatefulWidget {
  const WorkerShell({
    super.key,
    required this.session,
    required this.locale,
    required this.onLocaleChanged,
  });

  final SessionController session;
  final Locale locale;
  final ValueChanged<Locale> onLocaleChanged;

  @override
  State<WorkerShell> createState() => _WorkerShellState();
}

class _WorkerShellState extends State<WorkerShell> {
  var _section = 0;

  @override
  Widget build(BuildContext context) {
    final strings = WorkerStrings.of(context);
    final session = widget.session;
    final warehouse = session.warehouse!;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: ListView(
              key: ValueKey(_section),
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: [
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Image.asset(
                    'assets/brand/jahez-icon-brand.png',
                    width: 40,
                    height: 34,
                    excludeFromSemantics: true,
                  ),
                ),
                const SizedBox(height: 8),
                if (_section == 0)
                  HomeScreen(warehouseName: warehouse.name)
                else
                  SettingsScreen(
                    warehouseName: warehouse.name,
                    locale: widget.locale,
                    onLocaleChanged: widget.onLocaleChanged,
                    onSignOut: session.signOut,
                  ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _section,
        onDestinationSelected: (section) {
          session.markActivity();
          if (session.phase == SessionPhase.ready) {
            setState(() => _section = section);
          }
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: strings.home,
          ),
          NavigationDestination(
            icon: const Icon(Icons.inventory_2_outlined),
            label: strings.stock,
            enabled: false,
          ),
          NavigationDestination(
            icon: const Icon(Icons.assignment_outlined),
            label: strings.activity,
            enabled: false,
          ),
          NavigationDestination(
            icon: const Icon(Icons.settings_outlined),
            selectedIcon: const Icon(Icons.settings),
            label: strings.settings,
          ),
        ],
      ),
    );
  }
}
