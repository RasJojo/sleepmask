import 'package:dynamic_sdk/dynamic_sdk.dart';
import 'package:flutter/material.dart';
import 'config.dart';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  if (!Config.kMockMode) {
    DynamicSDK.init(
      props: ClientProps(
        environmentId: Config.dynamicEnvId,
        appName: 'Sleepmask Pro',
        appLogoUrl: 'https://sleepmask.xyz/logo.png',
      ),
    );
  }

  runApp(const SleepmaskApp());
}

class SleepmaskApp extends StatelessWidget {
  const SleepmaskApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sleepmask Pro',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C63FF),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF0D0D0D),
      ),
      home: Config.kMockMode
          ? const HomeScreen()
          : Stack(
              children: [
                const HomeScreen(),
                // Dynamic widget — doit toujours être présent dans le widget tree
                DynamicSDK.instance.dynamicWidget,
              ],
            ),
    );
  }
}
