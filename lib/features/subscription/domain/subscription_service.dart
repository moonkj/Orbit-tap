import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/utils/platform_channel.dart';

enum SubscriptionState { loading, free, premium, error }

class SubscriptionNotifier extends StateNotifier<SubscriptionState> {
  SubscriptionNotifier() : super(SubscriptionState.loading) {
    checkStatus();
  }

  Future<void> checkStatus() async {
    state = SubscriptionState.loading;
    try {
      final isActive = await PlatformChannel.isSubscriptionActive();
      state = isActive ? SubscriptionState.premium : SubscriptionState.free;
    } catch (_) {
      state = SubscriptionState.error;
    }
  }

  Future<bool> purchase() async {
    final success = await PlatformChannel.purchase('com.swift.app.monthly');
    if (success) {
      state = SubscriptionState.premium;
    }
    return success;
  }

  Future<bool> restore() async {
    final success = await PlatformChannel.restorePurchases();
    if (success) {
      await checkStatus();
    }
    return success;
  }
}

final subscriptionProvider = StateNotifierProvider<SubscriptionNotifier, SubscriptionState>((ref) {
  return SubscriptionNotifier();
});
