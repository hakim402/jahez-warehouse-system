import 'package:flutter/material.dart';

import '../../l10n/generated/worker_strings.dart';
import '../worker_theme.dart';
import 'session_controller.dart';

String? sessionIssueText(WorkerStrings strings, SessionIssue? issue) =>
    switch (issue) {
      SessionIssue.configuration => strings.configurationError,
      SessionIssue.credentials => strings.invalidCredentials,
      SessionIssue.company => strings.companyRequired,
      SessionIssue.worker => strings.workerRequired,
      SessionIssue.warehouse => strings.warehouseDenied,
      SessionIssue.unavailable => strings.serviceUnavailable,
      SessionIssue.unexpected => strings.unexpectedResponse,
      SessionIssue.storage => strings.storageError,
      SessionIssue.privateData => strings.draftStorageError,
      SessionIssue.serverSignOut => strings.signOutLocalOnly,
      null => null,
    };

class SessionFrame extends StatelessWidget {
  const SessionFrame({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [JahezColors.lavender, Colors.white, JahezColors.lavender],
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 24,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: (constraints.maxHeight - 48)
                        .clamp(0, double.infinity)
                        .toDouble(),
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: child,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class SessionScreen extends StatelessWidget {
  const SessionScreen({super.key, required this.session});

  final SessionController session;

  @override
  Widget build(BuildContext context) {
    final strings = WorkerStrings.of(context);
    final issue = sessionIssueText(strings, session.issue);
    final expired = session.phase == SessionPhase.expired;
    final blocked =
        session.phase == SessionPhase.blocked ||
        session.phase == SessionPhase.storageBlocked;
    final loading = !expired && !blocked;
    return SessionFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: JahezColors.border,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: loading
                    ? const SizedBox(
                        width: 32,
                        height: 32,
                        child: CircularProgressIndicator(strokeWidth: 3),
                      )
                    : Icon(
                        expired ? Icons.lock_outline : Icons.info_outline,
                        size: 36,
                        color: JahezColors.deep,
                      ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          if (expired || loading)
            Text(
              expired ? strings.signInAgain : strings.checkingSession,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          if (expired || issue != null) ...[
            const SizedBox(height: 8),
            Text(
              expired ? strings.sessionEnded : issue!,
              textAlign: TextAlign.center,
            ),
          ],
          if (expired || blocked) ...[
            const SizedBox(height: 24),
            FilledButton(
              onPressed: expired ? session.dismissExpired : session.retry,
              child: Text(expired ? strings.goToSignIn : strings.retry),
            ),
          ],
          if (session.phase == SessionPhase.blocked) ...[
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: session.signOut,
              child: Text(strings.switchWorker),
            ),
          ],
        ],
      ),
    );
  }
}
