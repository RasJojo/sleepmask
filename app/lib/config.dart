// Configuration — valeurs injectées via --dart-define au build
// Exemple : flutter run --dart-define=DYNAMIC_ENV_ID=xxx --dart-define=BACKEND_URL=http://localhost:3000
//
// En dev local, on peut aussi mettre les valeurs en dur ici (ne pas committer avec les vraies valeurs)

class Config {
  // Passe à false pour brancher le vrai backend + Dynamic SDK
  static const bool kMockMode = true;

  static const String dynamicEnvId = String.fromEnvironment(
    'DYNAMIC_ENV_ID',
    defaultValue: 'REMPLACER_PAR_TON_ENV_ID', // depuis app.dynamic.xyz
  );

  static const String backendUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: 'http://localhost:3000', // backend local en dev
  );
}
