import 'package:flutter/material.dart';
import '../services/api_service.dart';

enum PaymentStatus { loading, success, error }

class PaymentScreen extends StatefulWidget {
  final String userToken;
  final String requestId;

  const PaymentScreen({
    super.key,
    required this.userToken,
    required this.requestId,
  });

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  PaymentStatus _status = PaymentStatus.loading;
  String? _txHash;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _executePay();
  }

  Future<void> _executePay() async {
    try {
      final res = await ApiService.pay(
        userToken: widget.userToken,
        requestId: widget.requestId,
      );
      setState(() {
        _status = PaymentStatus.success;
        _txHash = res['txHash'] as String?;
      });
    } catch (e) {
      setState(() {
        _status = PaymentStatus.error;
        _errorMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0D),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Paiement',
          style: TextStyle(color: Colors.white),
        ),
        automaticallyImplyLeading: false,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: switch (_status) {
            PaymentStatus.loading => _buildLoading(),
            PaymentStatus.success => _buildSuccess(),
            PaymentStatus.error   => _buildError(),
          },
        ),
      ),
    );
  }

  Widget _buildLoading() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: const [
        CircularProgressIndicator(color: Color(0xFF6C63FF)),
        SizedBox(height: 24),
        Text(
          'Paiement ZK en cours...',
          style: TextStyle(color: Colors.white70, fontSize: 16),
        ),
        SizedBox(height: 8),
        Text(
          'Les preuves zero-knowledge sont générées.\nPatiente quelques secondes.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white38, fontSize: 13),
        ),
      ],
    );
  }

  Widget _buildSuccess() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.check_circle, color: Color(0xFF4CAF50), size: 80),
        const SizedBox(height: 24),
        const Text(
          'Paiement envoyé',
          style: TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Le marchand a reçu les fonds.\nTon identité reste privée.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white54, fontSize: 14),
        ),
        if (_txHash != null) ...[
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A1A),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              'TX: ${_txHash!.substring(0, 18)}...${_txHash!.substring(_txHash!.length - 6)}',
              style: const TextStyle(
                color: Color(0xFF6C63FF),
                fontSize: 12,
                fontFamily: 'monospace',
              ),
            ),
          ),
        ],
        const SizedBox(height: 40),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF6C63FF),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
          child: const Text('Retour'),
        ),
      ],
    );
  }

  Widget _buildError() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.error_outline, color: Colors.redAccent, size: 80),
        const SizedBox(height: 24),
        const Text(
          'Paiement échoué',
          style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Text(
          _errorMessage ?? 'Erreur inconnue',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white54, fontSize: 13),
        ),
        const SizedBox(height: 40),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white54,
                side: const BorderSide(color: Colors.white24),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
              child: const Text('Annuler'),
            ),
            const SizedBox(width: 16),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              onPressed: () {
                setState(() {
                  _status = PaymentStatus.loading;
                  _errorMessage = null;
                });
                _executePay();
              },
              child: const Text('Réessayer'),
            ),
          ],
        ),
      ],
    );
  }
}
