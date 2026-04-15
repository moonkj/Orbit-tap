import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_colors.dart';

// Mock data provider - in production would read from App Groups
final gestureStatsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  // Simulated data structure matching browser.storage.local gestureStats
  return {
    'totalGestures': 247,
    'gestureCount': {
      'SWIPE_BACK': 89,
      'SWIPE_FORWARD': 52,
      'V_SHAPE': 34,
      'L_SHAPE': 18,
      'DOUBLE_TAP': 25,
      'LONG_PRESS': 15,
      'TWO_FINGER_FLICK_UP': 10,
      'button_back': 4,
    },
    'weeklyData': [12, 28, 45, 38, 52, 41, 31],
    'lastUpdated': DateTime.now().millisecondsSinceEpoch,
  };
});

class StatsScreen extends ConsumerWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final statsAsync = ref.watch(gestureStatsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.get('statistics'))),
      body: statsAsync.when(
        data: (stats) => _StatsContent(stats: stats, l10n: l10n),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, s) => Center(child: Text('Error: $e')),
      ),
    );
  }
}

class _StatsContent extends StatelessWidget {
  final Map<String, dynamic> stats;
  final AppLocalizations l10n;

  const _StatsContent({required this.stats, required this.l10n});

  @override
  Widget build(BuildContext context) {
    final total = stats['totalGestures'] as int;
    final gestureCount = Map<String, int>.from(stats['gestureCount'] ?? {});
    final weeklyData = List<int>.from(stats['weeklyData'] ?? [0, 0, 0, 0, 0, 0, 0]);
    final timeSaved = (total * 2.5 / 60).toStringAsFixed(1); // ~2.5s per gesture

    // Sort gestures by count
    final sortedGestures = gestureCount.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Summary Cards
        Row(
          children: [
            Expanded(child: _SummaryCard(
              title: l10n.get('totalGestures'),
              value: '$total',
              icon: Icons.gesture,
              color: AppColors.primary,
            )),
            const SizedBox(width: 12),
            Expanded(child: _SummaryCard(
              title: l10n.get('timeSaved'),
              value: '$timeSaved ${l10n.get('minutes')}',
              icon: Icons.timer,
              color: AppColors.success,
            )),
          ],
        ),
        const SizedBox(height: 24),

        // Weekly Chart
        Text(
          l10n.get('weeklyUsage'),
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 200,
          child: BarChart(
            BarChartData(
              alignment: BarChartAlignment.spaceAround,
              maxY: (weeklyData.reduce((a, b) => a > b ? a : b) * 1.3).toDouble(),
              barTouchData: BarTouchData(enabled: true),
              titlesData: FlTitlesData(
                show: true,
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (value, meta) {
                      const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                      return Text(days[value.toInt() % 7], style: const TextStyle(fontSize: 12));
                    },
                  ),
                ),
                leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(show: false),
              gridData: const FlGridData(show: false),
              barGroups: weeklyData.asMap().entries.map((e) {
                return BarChartGroupData(
                  x: e.key,
                  barRods: [
                    BarChartRodData(
                      toY: e.value.toDouble(),
                      color: AppColors.primary,
                      width: 24,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
        const SizedBox(height: 24),

        // Most Used Gestures
        Text(
          l10n.get('mostUsed'),
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        ...sortedGestures.take(5).map((entry) {
          final percentage = total > 0 ? (entry.value / total * 100) : 0.0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _GestureStatRow(
              name: _gestureDisplayName(entry.key),
              count: entry.value,
              percentage: percentage,
              total: total,
            ),
          );
        }),
      ],
    );
  }

  String _gestureDisplayName(String key) {
    const names = {
      'SWIPE_BACK': 'Swipe Back',
      'SWIPE_FORWARD': 'Swipe Forward',
      'V_SHAPE': 'V Shape',
      'L_SHAPE': 'L Shape',
      'DOUBLE_TAP': 'Double Tap',
      'LONG_PRESS': 'Long Press',
      'TWO_FINGER_FLICK_UP': 'Two Finger Up',
      'TWO_FINGER_FLICK_DOWN': 'Two Finger Down',
      'button_back': 'Button Back',
      'button_forward': 'Button Forward',
    };
    return names[key] ?? key;
  }
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryCard({required this.title, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
            Text(title, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _GestureStatRow extends StatelessWidget {
  final String name;
  final int count;
  final double percentage;
  final int total;

  const _GestureStatRow({required this.name, required this.count, required this.percentage, required this.total});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: percentage / 100,
                      backgroundColor: Colors.grey.withValues(alpha: 0.2),
                      minHeight: 6,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('$count', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                Text('${percentage.toStringAsFixed(1)}%', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
