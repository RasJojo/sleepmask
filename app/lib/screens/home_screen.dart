import 'package:flutter/material.dart';
import '../services/dynamic_service.dart';
import '../services/api_service.dart';
import 'scan_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _balance;
  bool _loadingBalance = false;

  @override
  void initState() {
    super.initState();
    DynamicService.persistToken();
  }

  Future<void> _fetchBalance(String token) async {
    setState(() => _loadingBalance = true);
    try {
      final res = await ApiService.getBalance(userToken: token);
      setState(() => _balance = res['balance'] as String?);
    } catch (_) {
      setState(() => _balance = null);
    } finally {
      setState(() => _loadingBalance = false);
    }
  }

  Future<void> _deposit(String token) async {
    try {
      await ApiService.deposit(userToken: token, amount: '1000000'); // 1 USDC (6 dec)
      await _fetchBalance(token);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Dépôt en cours...')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur : $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<String?>(
      stream: DynamicService.tokenChanges,
      builder: (context, snapshot) {
        final token = snapshot.data;
        final isConnected = token != null;

        if (isConnected && _balance == null && !_loadingBalance) {
          _fetchBalance(token);
        }

        return Scaffold(
          backgroundColor: const Color(0xFF0D0D0D),
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: const Text(
              'Sleepmask',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 20,
              ),
            ),
            actions: [
              if (isConnected)
                IconButton(
                  icon: const Icon(Icons.logout, color: Colors.white54),
                  onPressed: DynamicService.logout,
                ),
            ],
          ),
          body: isConnected
              ? _buildConnected(token)
              : _buildDisconnected(),
        );
      },
    );
  }

  Widget _buildDisconnected() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.lock, size: 64, color: Color(0xFF6C63FF)),
          const SizedBox(height: 24),
          const Text(
            'Paiements privés en USDC',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Personne ne sait à qui tu paies.',
            style: TextStyle(color: Colors.white54, fontSize: 14),
          ),
          const SizedBox(height: 40),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6C63FF),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: DynamicService.showAuth,
            child: const Text('Connexion', style: TextStyle(fontSize: 16)),
          ),
        ],
      ),
    );
  }

  Widget _buildConnected(String token) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Carte solde
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6C63FF), Color(0xFF3B37D0)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Solde privé',
                  style: TextStyle(color: Colors.white70, fontSize: 14),
                ),
                const SizedBox(height: 8),
                _loadingBalance
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text(
                        _balance != null ? '$_balance USDC' : '—',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                const SizedBox(height: 4),
                const Text(
                  'Pool Unlink · Base Sepolia',
                  style: TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          // Bouton Déposer
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1E1E1E),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            icon: const Icon(Icons.add_circle_outline),
            label: const Text('Déposer 1 USDC', style: TextStyle(fontSize: 16)),
            onPressed: () => _deposit(token),
          ),
          const SizedBox(height: 16),

          // Bouton Scanner QR
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6C63FF),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scanner & Payer', style: TextStyle(fontSize: 16)),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ScanScreen(userToken: token),
                ),
              );
            },
          ),

          const Spacer(),
          const Center(
            child: Text(
              'Le marchand ne sait pas qui tu es.',
              style: TextStyle(color: Colors.white24, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
