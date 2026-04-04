import 'dart:async';
import 'package:dynamic_sdk/dynamic_sdk.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config.dart';

// Wrapper autour du Dynamic SDK
// Gère : connexion, déconnexion, récupération du token JWT et de l'adresse wallet
class DynamicService {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'dynamic_token';
  static const _addressKey = 'wallet_address';

  // --- Mock ---
  static final _mockController = StreamController<String?>.broadcast();

  // Lance la modal d'auth Dynamic (email / social / passkey)
  static void showAuth() {
    if (Config.kMockMode) {
      _mockController.add('mock_jwt_token_sleepmask_demo');
      return;
    }
    DynamicSDK.instance.ui.showAuth();
  }

  // Déconnexion
  static Future<void> logout() async {
    if (Config.kMockMode) {
      _mockController.add(null);
      return;
    }
    await DynamicSDK.instance.auth.logout();
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _addressKey);
  }

  // Stream : vrai si l'user est connecté
  static Stream<bool> get authStateChanges => tokenChanges.map((t) => t != null);

  // Token JWT actuel (null si déconnecté)
  static Stream<String?> get tokenChanges {
    if (Config.kMockMode) return _mockController.stream;
    return DynamicSDK.instance.auth.tokenChanges;
  }

  // Adresse EVM du wallet embarqué
  static Stream<String?> get walletAddressChanges {
    if (Config.kMockMode) {
      return _mockController.stream.map(
        (t) => t != null ? '0x72f262444ef740B4F6456910Ad64a1B3102CFCf4' : null,
      );
    }
    return DynamicSDK.instance.wallets.userWalletsChanges.map(
      (wallets) => wallets.isNotEmpty ? wallets.first.address : null,
    );
  }

  // Récupère le token JWT synchrone depuis le secure storage
  static Future<String?> getSavedToken() => _storage.read(key: _tokenKey);

  // Persiste le token quand l'auth change (à appeler une fois au démarrage)
  static void persistToken() {
    if (Config.kMockMode) return;
    DynamicSDK.instance.auth.tokenChanges.listen((token) async {
      if (token != null) {
        await _storage.write(key: _tokenKey, value: token);
      } else {
        await _storage.delete(key: _tokenKey);
      }
    });
  }
}
