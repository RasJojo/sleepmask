import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../config.dart';
import 'payment_screen.dart';

class ScanScreen extends StatefulWidget {
  final String userToken;
  const ScanScreen({super.key, required this.userToken});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  bool _scanned = false;

  void _onDetect(BarcodeCapture capture) {
    if (_scanned) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;
    _navigate(barcode.rawValue!);
  }

  void _navigate(String raw) {
    if (_scanned) return;
    final uri = Uri.tryParse(raw);
    final requestId = uri?.queryParameters['requestId'] ?? raw;
    setState(() => _scanned = true);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => PaymentScreen(
          userToken: widget.userToken,
          requestId: requestId,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Scanner le QR marchand',
          style: TextStyle(color: Colors.white),
        ),
      ),
      body: Config.kMockMode ? _buildMock() : _buildScanner(),
    );
  }

  Widget _buildScanner() {
    return Stack(
      children: [
        MobileScanner(onDetect: _onDetect),
        Center(
          child: Container(
            width: 260,
            height: 260,
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFF6C63FF), width: 3),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
        Positioned(
          bottom: 60,
          left: 0,
          right: 0,
          child: Center(
            child: Text(
              _scanned ? 'QR détecté...' : 'Pointe vers le QR code du marchand',
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMock() {
    return Stack(
      children: [
        // Fond simulant une caméra
        Container(
          color: const Color(0xFF111111),
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Viseur
                Container(
                  width: 260,
                  height: 260,
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFF6C63FF), width: 3),
                    borderRadius: BorderRadius.circular(16),
                    color: const Color(0xFF1A1A1A),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.qr_code,
                      size: 100,
                      color: Color(0xFF6C63FF),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6C63FF),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('Simuler un scan', style: TextStyle(fontSize: 16)),
                  onPressed: () => _navigate('sleepmask://pay?requestId=0xmock_request_demo_12345'),
                ),
                const SizedBox(height: 12),
                const Text(
                  'MODE DÉMO — caméra désactivée',
                  style: TextStyle(color: Colors.white24, fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
