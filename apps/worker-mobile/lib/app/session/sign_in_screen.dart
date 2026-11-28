import 'package:flutter/material.dart';

import '../../l10n/generated/worker_strings.dart';
import '../../shared/widgets/language_selector.dart';
import '../worker_config.dart';
import '../worker_theme.dart';
import 'session_controller.dart';
import 'session_screen.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({
    super.key,
    required this.session,
    required this.locale,
    required this.onLocaleChanged,
  });

  final SessionController session;
  final Locale locale;
  final ValueChanged<Locale> onLocaleChanged;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _hidePassword = true;

  Future<void> _submit() async {
    if (widget.session.phase != SessionPhase.signedOut ||
        !_form.currentState!.validate()) {
      return;
    }
    FocusScope.of(context).unfocus();
    final password = _password.text;
    _password.clear();
    await widget.session.signIn(_phone.text, password);
  }

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = WorkerStrings.of(context);
    final textTheme = Theme.of(context).textTheme;
    final signingIn = widget.session.phase == SessionPhase.signingIn;
    final issue = sessionIssueText(strings, widget.session.issue);
    final warehouse =
        widget.session.config.warehouseId == WorkerConfig.yiwuWarehouseId
        ? strings.shortWarehouseLabel
        : strings.warehouse;

    return SessionFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Image.asset(
            'assets/brand/jahez-master-brand.png',
            height: 96,
            fit: BoxFit.contain,
            semanticLabel: strings.appName,
          ),
          const SizedBox(height: 24),
          Text(strings.signIn, style: textTheme.headlineMedium),
          const SizedBox(height: 16),
          DecoratedBox(
            decoration: BoxDecoration(
              color: JahezColors.lavender,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: JahezColors.border),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    LanguageSelector(
                      locale: widget.locale,
                      onChanged: widget.onLocaleChanged,
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        const Icon(
                          Icons.warehouse_outlined,
                          color: JahezColors.deep,
                        ),
                        Text(warehouse, style: textTheme.titleMedium),
                        DecoratedBox(
                          decoration: BoxDecoration(
                            color: JahezColors.border,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            child: Text(
                              strings.sharedDevice,
                              style: textTheme.labelMedium?.copyWith(
                                color: JahezColors.deep,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(strings.phoneNumber, style: textTheme.titleSmall),
                    const SizedBox(height: 4),
                    TextFormField(
                      controller: _phone,
                      enabled: !signingIn,
                      textDirection: TextDirection.ltr,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        hintText: strings.phoneHint,
                        prefixIcon: const Icon(Icons.phone_iphone),
                      ),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? strings.phoneRequired
                          : null,
                    ),
                    const SizedBox(height: 12),
                    Text(strings.password, style: textTheme.titleSmall),
                    const SizedBox(height: 4),
                    TextFormField(
                      controller: _password,
                      enabled: !signingIn,
                      obscureText: _hidePassword,
                      autocorrect: false,
                      enableSuggestions: false,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        hintText: strings.passwordHint,
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          tooltip: _hidePassword
                              ? strings.showPassword
                              : strings.hidePassword,
                          onPressed: signingIn
                              ? null
                              : () => setState(
                                  () => _hidePassword = !_hidePassword,
                                ),
                          icon: Icon(
                            _hidePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (value) => value == null || value.isEmpty
                          ? strings.passwordRequired
                          : null,
                    ),
                    if (issue != null) ...[
                      const SizedBox(height: 12),
                      Semantics(
                        liveRegion: true,
                        child: Text(
                          issue,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: signingIn ? null : _submit,
                      child: signingIn
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(strings.signIn),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      strings.sharedDeviceHelp,
                      textAlign: TextAlign.center,
                      style: textTheme.bodySmall?.copyWith(
                        color: JahezColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
