import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/app_localizations.dart';

final excludedDomainsProvider = StateProvider<List<String>>(
  (ref) => ['youtube.com', 'netflix.com'],
);

final autoDetectionProvider = StateProvider<bool>((ref) => true);

class ExclusionListScreen extends ConsumerWidget {
  const ExclusionListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final domains = ref.watch(excludedDomainsProvider);
    final autoDetect = ref.watch(autoDetectionProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.get('exclusionList')),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: l10n.get('addDomain'),
            onPressed: () => _showAddDomainDialog(context, ref, l10n),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Auto-detection toggle
          Card(
            child: SwitchListTile(
              secondary: const Icon(Icons.auto_fix_high),
              title: Text(l10n.get('autoDetection')),
              subtitle: Text(l10n.get('autoDetectionDesc')),
              value: autoDetect,
              onChanged: (v) {
                ref.read(autoDetectionProvider.notifier).state = v;
              },
            ),
          ),
          const SizedBox(height: 16),

          // Domain list header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  l10n.get('exclusionList'),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                Text(
                  '${domains.length}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                ),
              ],
            ),
          ),

          if (domains.isEmpty)
            _EmptyState(l10n: l10n)
          else
            Card(
              child: Column(
                children: List.generate(domains.length, (index) {
                  final domain = domains[index];
                  return Column(
                    children: [
                      _DomainTile(
                        domain: domain,
                        onDelete: () {
                          final updated = List<String>.from(domains)
                            ..removeAt(index);
                          ref.read(excludedDomainsProvider.notifier).state =
                              updated;
                        },
                      ),
                      if (index < domains.length - 1)
                        const Divider(height: 1, indent: 56),
                    ],
                  );
                }),
              ),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddDomainDialog(context, ref, l10n),
        icon: const Icon(Icons.add),
        label: Text(l10n.get('addDomain')),
      ),
    );
  }

  Future<void> _showAddDomainDialog(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
  ) async {
    final controller = TextEditingController();
    final formKey = GlobalKey<FormState>();

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.get('addDomain')),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: controller,
            autofocus: true,
            decoration: InputDecoration(
              hintText: l10n.get('addDomainHint'),
              prefixIcon: const Icon(Icons.language),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.url,
            textInputAction: TextInputAction.done,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Please enter a domain';
              }
              final domain = value.trim().toLowerCase();
              if (!RegExp(r'^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$')
                  .hasMatch(domain)) {
                return 'Please enter a valid domain (e.g. example.com)';
              }
              return null;
            },
            onFieldSubmitted: (_) {
              if (formKey.currentState!.validate()) {
                _addDomain(controller.text.trim().toLowerCase(), ref);
                Navigator.of(context).pop();
              }
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(l10n.get('cancel')),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState!.validate()) {
                _addDomain(controller.text.trim().toLowerCase(), ref);
                Navigator.of(context).pop();
              }
            },
            child: Text(l10n.get('add')),
          ),
        ],
      ),
    );

    controller.dispose();
  }

  void _addDomain(String domain, WidgetRef ref) {
    final current = ref.read(excludedDomainsProvider);
    if (!current.contains(domain)) {
      ref.read(excludedDomainsProvider.notifier).state = [
        ...current,
        domain,
      ];
    }
  }
}

class _DomainTile extends StatelessWidget {
  final String domain;
  final VoidCallback onDelete;

  const _DomainTile({required this.domain, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(domain),
      direction: DismissDirection.endToStart,
      background: Container(
        color: Theme.of(context).colorScheme.errorContainer,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: Icon(
          Icons.delete_outline,
          color: Theme.of(context).colorScheme.onErrorContainer,
        ),
      ),
      onDismissed: (_) => onDelete(),
      child: ListTile(
        leading: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.language,
            size: 18,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        title: Text(domain),
        trailing: IconButton(
          icon: const Icon(Icons.delete_outline),
          onPressed: onDelete,
          color: Theme.of(context).colorScheme.error,
          iconSize: 20,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final AppLocalizations l10n;

  const _EmptyState({required this.l10n});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          Icon(
            Icons.check_circle_outline,
            size: 64,
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.4),
          ),
          const SizedBox(height: 16),
          Text(
            l10n.get('noDomains'),
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.get('noDomainsDesc'),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
