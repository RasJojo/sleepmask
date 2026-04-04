import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

class ApiService {
  static final _base = Config.backendUrl;

  // POST /api/deposit
  static Future<Map<String, dynamic>> deposit({
    required String userToken,
    required String amount,
  }) async {
    if (Config.kMockMode) {
      await Future.delayed(const Duration(milliseconds: 1200));
      return {'success': true};
    }
    final res = await http.post(
      Uri.parse('$_base/api/deposit'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'userToken': userToken, 'amount': amount}),
    );
    return _handle(res);
  }

  // POST /api/create-payment-request
  static Future<Map<String, dynamic>> createPaymentRequest({
    required String merchantAddress,
    required String amount,
  }) async {
    if (Config.kMockMode) {
      await Future.delayed(const Duration(milliseconds: 500));
      return {
        'requestId': '0xmock_req_${DateTime.now().millisecondsSinceEpoch}',
        'qrCode': 'sleepmask://pay?requestId=0xmock_req_demo',
      };
    }
    final res = await http.post(
      Uri.parse('$_base/api/create-payment-request'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'merchantAddress': merchantAddress, 'amount': amount}),
    );
    return _handle(res);
  }

  // POST /api/pay — simule 2.5s de génération de preuve ZK
  static Future<Map<String, dynamic>> pay({
    required String userToken,
    required String requestId,
  }) async {
    if (Config.kMockMode) {
      await Future.delayed(const Duration(milliseconds: 2500));
      return {
        'txHash': '0xd4f8a3e1b9c72650f3a8c91e4b6d0527a3e8c1f9b4d72a630e5c891f4b6d0527',
      };
    }
    final res = await http.post(
      Uri.parse('$_base/api/pay'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'userToken': userToken, 'requestId': requestId}),
    );
    return _handle(res);
  }

  // GET /api/balance
  static Future<Map<String, dynamic>> getBalance({
    required String userToken,
  }) async {
    if (Config.kMockMode) {
      await Future.delayed(const Duration(milliseconds: 600));
      return {'balance': '42.00'};
    }
    final res = await http.get(
      Uri.parse('$_base/api/balance?userToken=${Uri.encodeComponent(userToken)}'),
    );
    return _handle(res);
  }

  static Map<String, dynamic> _handle(http.Response res) {
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    throw ApiException(
      statusCode: res.statusCode,
      message: body['error'] as String? ?? 'Unknown error',
    );
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  const ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
