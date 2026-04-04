import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadows } from '../theme';

type CameraPermissionState =
  | 'checking'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

type QrScannerModalProps = {
  visible: boolean;
  compact: boolean;
  onClose: () => void;
  onQrScanned: (data: string) => void;
};

export function QrScannerModal({
  visible,
  compact,
  onClose,
  onQrScanned,
}: QrScannerModalProps) {
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<CameraPermissionState>('checking');
  const [error, setError] = useState<string | null>(null);
  const scanLocked = useRef(false);

  const requestCameraAccess = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setPermission('unavailable');
      return;
    }

    setPermission('checking');
    setError(null);

    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );

      if (granted) {
        setPermission('granted');
        return;
      }

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Autoriser la caméra',
          message:
            'Sleepmask a besoin de la caméra pour lire un QR de paiement.',
          buttonPositive: 'Autoriser',
          buttonNegative: 'Refuser',
        },
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setPermission('granted');
        return;
      }

      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        setPermission('blocked');
        return;
      }

      setPermission('denied');
    } catch (nextError: any) {
      setPermission('denied');
      setError(nextError?.message || 'Impossible d’ouvrir la caméra.');
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      scanLocked.current = false;
      return;
    }

    requestCameraAccess().catch((nextError: any) => {
      setPermission('denied');
      setError(nextError?.message || 'Impossible d’ouvrir la caméra.');
    });
  }, [requestCameraAccess, visible]);

  const handleReadCode = useCallback(
    (event: any) => {
      const value = event?.nativeEvent?.codeStringValue?.trim();
      if (!value || scanLocked.current) {
        return;
      }

      scanLocked.current = true;
      onQrScanned(value);
      onClose();
    },
    [onClose, onQrScanned],
  );

  const renderPermissionState = () => {
    if (permission === 'checking') {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator color={colors.black} />
          <Text style={styles.stateTitle}>Ouverture de la caméra…</Text>
          <Text style={styles.stateText}>
            Préparation du lecteur QR sur cet appareil.
          </Text>
        </View>
      );
    }

    if (permission === 'granted') {
      return (
        <View style={styles.cameraShell}>
          <Camera
            style={StyleSheet.absoluteFill}
            cameraType={CameraType.Back}
            scanBarcode
            onReadCode={handleReadCode}
            showFrame
            laserColor={colors.mintDeep}
            frameColor={colors.surfaceRaised}
            scanThrottleDelay={1800}
            onError={(event: any) =>
              setError(
                event?.nativeEvent?.errorMessage ||
                  'La caméra n’a pas pu démarrer.',
              )
            }
          />
          <View
            pointerEvents="none"
            style={[
              styles.cameraOverlay,
              compact ? styles.cameraOverlayCompact : null,
            ]}
          >
            <Text style={styles.cameraTitle}>Cadrez le QR Sleepmask</Text>
            <Text style={styles.cameraText}>
              Le lien de paiement sera injecté directement dans le flux.
            </Text>
          </View>
        </View>
      );
    }

    const blocked = permission === 'blocked';
    const unavailable = permission === 'unavailable';

    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>
          {unavailable ? 'Scan caméra indisponible' : 'Caméra non autorisée'}
        </Text>
        <Text style={styles.stateText}>
          {unavailable
            ? 'Le scan natif est activé côté Android. Utilisez le collage de lien sur les autres plateformes.'
            : blocked
            ? 'La permission caméra est bloquée. Réactivez-la dans les réglages du téléphone.'
            : 'Autorisez la caméra pour scanner un QR de paiement réel.'}
        </Text>
        {!unavailable ? (
          <Pressable
            onPress={
              blocked
                ? () => {
                    Linking.openSettings().catch(() => undefined);
                  }
                : () => {
                    requestCameraAccess().catch(() => undefined);
                  }
            }
            style={({ pressed }) => [
              styles.actionButton,
              pressed ? styles.actionButtonPressed : null,
            ]}
          >
            <Text style={styles.actionButtonText}>
              {blocked ? 'Ouvrir les réglages' : 'Autoriser la caméra'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            shadows.floating,
            {
              marginTop: insets.top + 18,
              marginBottom: Math.max(insets.bottom, 18),
            },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Scanner pour payer</Text>
              <Text style={styles.subtitle}>
                Lisez un vrai QR Sleepmask depuis la caméra.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeChip}>
              <Text style={styles.closeText}>Fermer</Text>
            </Pressable>
          </View>

          {renderPermissionState()}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 25, 0.35)',
    paddingHorizontal: 18,
  },
  card: {
    flex: 1,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  closeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  cameraShell: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.black,
  },
  cameraOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(248, 250, 252, 0.90)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cameraOverlayCompact: {
    left: 14,
    right: 14,
    bottom: 14,
  },
  cameraTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cameraText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 30,
  },
  stateTitle: {
    marginTop: 14,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
  },
  stateText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.textMuted,
  },
  actionButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.black,
  },
  actionButtonPressed: {
    opacity: 0.82,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surfaceRaised,
  },
  errorText: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    fontSize: 13,
    lineHeight: 18,
    color: colors.dangerDeep,
  },
});
