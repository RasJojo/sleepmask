import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BalanceRevealCard } from './components/BalanceRevealCard';
import { BottomTabs } from './components/BottomTabs';
import { QrCodeMock } from './components/QrCodeMock';
import { QrScannerModal } from './components/QrScannerModal';
import { SegmentedControl } from './components/SegmentedControl';
import { SleepMaskMark } from './components/SleepMaskMark';
import { StatusPill } from './components/StatusPill';
import { TransactionSheet } from './components/TransactionSheet';
import type { ActivityItem, Holding } from './types';
import { colors, radius, shadows } from './theme';
import { useIdentity } from './hooks/useIdentity';
import { useBalance } from './hooks/useBalance';
import { useDeposit } from './hooks/useDeposit';
import { usePayment } from './hooks/usePayment';
import { useReceive } from './hooks/useReceive';
import { config } from './services/config';
import { depositUsdcToPrivateBalance } from './services/unlink';

type Stage = 'splash' | 'login' | 'app';
type TabKey = 'home' | 'transfer' | 'profile';
type TransferMode = 'pay' | 'receive';
type ReceiveShareMode = 'sleepmask' | 'classic';
type ModalState =
  | null
  | { type: 'scan' }
  | { type: 'fullQr' }
  | {
      type: 'transaction';
      phase: 'pending' | 'success';
      variant: 'pay' | 'receive';
    };

export function AppShell() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = width < 390 || height < 760;

  // ── Identité Sleepmask ───────────────────────────────────────────────────
  const {
    mnemonic,
    wallet,
    authenticated,
    walletAddress,
    connectionMethod,
    loading: identityLoading,
    error: identityError,
    initialize: initIdentity,
    logout: logoutIdentity,
  } = useIdentity();

  // ── Balance Unlink ────────────────────────────────────────────────────────
  const {
    balance,
    holdings,
    activity,
    unlinkAddress,
    privateUsdcRaw,
    error: balanceError,
    refresh: refreshBalance,
  } = useBalance(mnemonic, wallet);

  // ── Paiement ──────────────────────────────────────────────────────────────
  const {
    status: payStatus,
    error: payError,
    payRequest,
    payEvm,
    reset: resetPay,
  } = usePayment(mnemonic);

  // ── Dépôt ────────────────────────────────────────────────────────────────
  const {
    status: depositStatus,
    error: depositError,
    deposit,
    reset: resetDeposit,
  } = useDeposit(mnemonic, wallet);

  // ── Réception ─────────────────────────────────────────────────────────────
  const {
    status: receiveStatus,
    request: receiveRequest,
    error: receiveError,
    createRequest,
    reset: resetReceive,
  } = useReceive(unlinkAddress);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>('splash');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [transferMode, setTransferMode] = useState<TransferMode>('pay');
  const [balanceMasked, setBalanceMasked] = useState(true);
  const [payAmount, setPayAmount] = useState('');
  const [payRecipient, setPayRecipient] = useState('');
  const [payLinkInput, setPayLinkInput] = useState('');
  const [payEvmAddress, setPayEvmAddress] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [flexibleReceive, setFlexibleReceive] = useState(false);
  const [receiveShareMode, setReceiveShareMode] =
    useState<ReceiveShareMode>('sleepmask');
  const [modal, setModal] = useState<ModalState>(null);

  // QR parsé après scan
  const [parsedRequestId, setParsedRequestId] = useState<string | null>(null);
  const [parsedRecipient, setParsedRecipient] = useState<string | null>(null);
  const [parsedToken, setParsedToken] = useState<`0x${string}` | null>(null);

  // ── Auto-transition splash/login → app quand le wallet est connecté ─────
  useEffect(() => {
    if (authenticated && stage !== 'app') {
      setStage('app');
    }
  }, [authenticated, stage]);

  useEffect(() => {
    if (authenticated && mnemonic) {
      refreshBalance();
    }
  }, [authenticated, mnemonic, refreshBalance]);

  // ── Transition modale paiement : pending → success quand payStatus = success
  useEffect(() => {
    if (payStatus === 'success' && modal?.type === 'transaction' && modal.phase === 'pending') {
      setModal({ type: 'transaction', phase: 'success', variant: 'pay' });
      refreshBalance();
      resetPay();
    }
    if (payStatus === 'error' && payError) {
      Alert.alert('Paiement échoué', payError);
      setModal(null);
      resetPay();
    }
  }, [payStatus, payError, modal, refreshBalance, resetPay]);

  useEffect(() => {
    if (depositStatus === 'success') {
      Alert.alert('Dépôt confirmé', 'Les USDC ont été ajoutés à Sleepmask.');
      setDepositAmount('');
      refreshBalance();
      resetDeposit();
      return;
    }

    if (depositStatus === 'error' && depositError) {
      Alert.alert('Dépôt échoué', depositError);
      resetDeposit();
    }
  }, [depositError, depositStatus, refreshBalance, resetDeposit]);

  // ── Transition modale réception : paid → succès
  useEffect(() => {
    if (receiveStatus === 'paid') {
      setModal({ type: 'transaction', phase: 'success', variant: 'receive' });
      refreshBalance();
      resetReceive();
    }
  }, [receiveStatus, refreshBalance, resetReceive]);

  useEffect(() => {
    if (receiveRequest) {
      setReceiveShareMode('sleepmask');
    }
  }, [receiveRequest]);

  useEffect(() => {
    if (receiveError) {
      Alert.alert('Réception indisponible', receiveError);
    }
  }, [receiveError]);

  useEffect(() => {
    if (balanceError) {
      Alert.alert('Balance indisponible', balanceError);
    }
  }, [balanceError]);

  const transactionCounterparty = useMemo(() => {
    return modal?.type === 'transaction' && modal.variant === 'receive'
      ? 'Paiement Sleepmask'
      : payRecipient || 'Destinataire';
  }, [modal, payRecipient]);

  const openPay = () => {
    setActiveTab('transfer');
    setTransferMode('pay');
  };

  const openReceive = () => {
    resetReceive();
    setActiveTab('transfer');
    setTransferMode('receive');
  };

  // Parse un deep link Sleepmask / Sleepay.
  const handleQrScanned = useCallback((qrData: string) => {
    try {
      const url = new URL(qrData);
      const requestId = url.searchParams.get('requestId');
      const amount    = url.searchParams.get('amount');
      const recipient = url.searchParams.get('recipient');
      const token     = url.searchParams.get('token');

      if (requestId) setParsedRequestId(requestId);
      if (recipient) setParsedRecipient(decodeURIComponent(recipient));
      if (token && /^0x[a-fA-F0-9]{40}$/.test(token)) {
        setParsedToken(token as `0x${string}`);
      } else {
        setParsedToken(null);
      }
      if (amount) setPayAmount((parseInt(amount, 10) / 1_000_000).toFixed(2));
      if (recipient && !payRecipient) {
        setPayRecipient('Paiement Sleepmask');
      }

      setTransferMode('pay');
      setModal(null);
    } catch {
      Alert.alert('QR invalide', 'Ce QR code n\'est pas compatible Sleepmask.');
    }
  }, [payRecipient]);

  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url) {
        handleQrScanned(url);
      }
    }).catch(() => undefined);

    const subscription = Linking.addEventListener('url', event => {
      handleQrScanned(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleQrScanned]);

  const parsePayLink = () => {
    if (!payLinkInput.trim()) {
      Alert.alert('Lien requis', 'Collez un lien Sleepmask valide.');
      return;
    }

    handleQrScanned(payLinkInput.trim());
  };

  const startPayment = async () => {
    if (!mnemonic) {
      Alert.alert('Identité requise', 'Connectez-vous d\'abord.');
      return;
    }

    const amountMicro = Math.round(
      parseFloat((payAmount || '0').replace(',', '.')) * 1_000_000,
    );

    if (!Number.isFinite(amountMicro) || amountMicro <= 0) {
      Alert.alert('Montant invalide', 'Saisissez un montant USDC valide.');
      return;
    }

    setModal({ type: 'transaction', phase: 'pending', variant: 'pay' });

    const privateMicros = BigInt(privateUsdcRaw || '0');
    const requiredMicros = BigInt(amountMicro);
    const missingMicros =
      requiredMicros > privateMicros ? requiredMicros - privateMicros : 0n;
    if (missingMicros > 0n) {
      if (!wallet) {
        Alert.alert(
          'Paiement échoué',
          'Wallet non prêt pour le dépôt automatique.',
        );
        setModal(null);
        return;
      }
      try {
        await depositUsdcToPrivateBalance({
          mnemonic,
          wallet,
          amount: missingMicros.toString(),
          token: config.usdcToken,
        });
      } catch {
        Alert.alert(
          'Paiement échoué',
          'Dépôt automatique impossible. Vérifiez votre solde wallet USDC et réessayez.',
        );
        setModal(null);
        return;
      }
      await refreshBalance();
    }

    const paymentToken = parsedToken ?? config.usdcToken;
    const directAddress = payEvmAddress.trim();

    if (/^0x[a-fA-F0-9]{40}$/.test(directAddress)) {
      await payEvm({
        recipientEvmAddress: directAddress,
        amount: amountMicro.toString(),
        token: paymentToken,
        localTag: payRecipient || 'Retrait vers wallet',
      });
      return;
    }

    if (parsedRequestId && parsedRecipient) {
      await payRequest({
        requestId: parsedRequestId,
        recipientUnlinkAddress: parsedRecipient,
        amount: amountMicro.toString(),
        token: paymentToken,
        localTag: payRecipient || 'Paiement Sleepmask',
      });
      return;
    }

    Alert.alert(
      'Destination requise',
      'Scannez un QR Sleepmask, collez un lien valide, ou saisissez une adresse EVM.',
    );
    setModal(null);
  };

  const generateReceiveRequest = async () => {
    if (!mnemonic) {
      Alert.alert('Identité requise', 'Connectez-vous d\'abord.');
      return;
    }

    if (!unlinkAddress) {
      Alert.alert(
        'Adresse indisponible',
        "Votre adresse Sleepmask n'est pas encore prête. Réessayez dans un instant.",
      );
      return;
    }

    if (!flexibleReceive) {
      const amountMicro = Math.round(
        parseFloat((receiveAmount || '0').replace(',', '.')) * 1_000_000,
      );

      if (!Number.isFinite(amountMicro) || amountMicro <= 0) {
        Alert.alert('Montant invalide', 'Saisissez un montant USDC valide.');
        return;
      }

      await createRequest({
        amount: amountMicro.toString(),
        flexibleAmount: false,
        token: config.usdcToken,
      });
      return;
    }

    await createRequest({
      amount: '0',
      flexibleAmount: true,
      token: config.usdcToken,
    });
  };

  const startDeposit = async () => {
    if (!mnemonic) {
      Alert.alert('Identité requise', 'Connectez-vous d\'abord.');
      return;
    }

    const amountMicro = Math.round(
      parseFloat((depositAmount || '0').replace(',', '.')) * 1_000_000,
    );

    if (!Number.isFinite(amountMicro) || amountMicro <= 0) {
      Alert.alert('Montant invalide', 'Saisissez un montant USDC valide.');
      return;
    }

    await deposit(amountMicro.toString(), config.usdcToken);
  };

  const handleLogout = async () => {
    await logoutIdentity();
    setStage('login');
    setActiveTab('home');
    setTransferMode('pay');
    setModal(null);
    resetPay();
    resetReceive();
  };

  // Solde formaté pour l'affichage
  const formattedBalance = useMemo(() => {
    if (!balance?.balances?.length) return undefined;
    const usdc =
      balance.balances.find(b => b.token?.toLowerCase().includes('usdc')) ??
      balance.balances[0];
    if (!usdc) return undefined;
    const amount = (parseInt(usdc.amount, 10) / 1_000_000).toFixed(2);
    return `${amount} USDC`;
  }, [balance]);

  const transactionAmount =
    modal?.type === 'transaction' && modal.variant === 'receive'
      ? flexibleReceive
        ? 'Libre'
        : receiveAmount || '0,00'
      : payAmount || '0,00';

  const activeReceiveQrData =
    receiveShareMode === 'classic'
      ? receiveRequest?.qrClassic
      : receiveRequest?.qrSleepmask;
  const activeReceiveDisplayValue =
    receiveShareMode === 'classic'
      ? receiveRequest?.oneshotAddress
      : receiveRequest?.qrSleepmask;
  const activeReceiveLabel =
    receiveShareMode === 'classic'
      ? 'Wallet classique'
      : 'Sleepmask';

  return (
    <>
      {stage === 'splash' ? (
        <SplashScreen compact={compact} onContinue={() => setStage('login')} />
      ) : stage === 'login' ? (
        <LoginScreen
          compact={compact}
          connectionMethod={connectionMethod}
          loading={identityLoading}
          error={identityError}
          onConnect={initIdentity}
        />
      ) : (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.appRoot}
          >
            <View style={styles.screenArea}>
              {activeTab === 'home' ? (
                <HomeTab
                  compact={compact}
                  balanceMasked={balanceMasked}
                  balance={formattedBalance}
                  holdings={holdings}
                  activity={activity}
                  depositAmount={depositAmount}
                  onToggleBalance={() => setBalanceMasked(current => !current)}
                  onChangeDepositAmount={setDepositAmount}
                  onDeposit={startDeposit}
                  onRefresh={refreshBalance}
                  onOpenPay={openPay}
                  onOpenReceive={openReceive}
                  onOpenProfile={() => setActiveTab('profile')}
                />
              ) : activeTab === 'transfer' ? (
                <TransferTab
                  compact={compact}
                  mode={transferMode}
                  onChangeMode={nextMode =>
                    setTransferMode(nextMode as TransferMode)
                  }
                  payAmount={payAmount}
                  payRecipient={payRecipient}
                  payLinkInput={payLinkInput}
                  payEvmAddress={payEvmAddress}
                  receiveAmount={receiveAmount}
                  flexibleReceive={flexibleReceive}
                  receiveShareMode={receiveShareMode}
                  receiveQrData={activeReceiveQrData}
                  receiveDisplayValue={activeReceiveDisplayValue}
                  receiveDisplayLabel={activeReceiveLabel}
                  onChangePayAmount={setPayAmount}
                  onChangePayRecipient={setPayRecipient}
                  onChangePayLink={setPayLinkInput}
                  onChangePayEvmAddress={setPayEvmAddress}
                  onChangeReceiveAmount={setReceiveAmount}
                  onToggleFlexibleReceive={setFlexibleReceive}
                  onChangeReceiveShareMode={nextMode =>
                    setReceiveShareMode(nextMode as ReceiveShareMode)
                  }
                  onOpenScan={() => setModal({ type: 'scan' })}
                  onParsePayLink={parsePayLink}
                  onStartPayment={startPayment}
                  onGenerateReceive={generateReceiveRequest}
                  onOpenFullQr={() =>
                    activeReceiveQrData
                      ? setModal({ type: 'fullQr' })
                      : Alert.alert('QR indisponible', "Générez d'abord une demande de paiement.")
                  }
                  onCopyLink={() => {
                    if (!activeReceiveDisplayValue) {
                      Alert.alert('Lien indisponible', "Générez d'abord une demande de paiement.");
                      return;
                    }
                    Clipboard.setString(activeReceiveDisplayValue);
                    Alert.alert(
                      'Copié',
                      receiveShareMode === 'classic'
                        ? "L'adresse one-shot a été copiée."
                        : 'Le lien Sleepmask a été copié.',
                    );
                  }}
                  onShare={async () => {
                    if (!activeReceiveQrData) {
                      Alert.alert('Lien indisponible', "Générez d'abord une demande de paiement.");
                      return;
                    }
                    await Share.share({ message: activeReceiveQrData });
                  }}
                />
              ) : (
                <ProfileTab
                  compact={compact}
                  connectionMethod={connectionMethod}
                  walletAddress={walletAddress}
                  unlinkAddress={unlinkAddress}
                  activity={activity}
                  onLogout={handleLogout}
                />
              )}
            </View>

            <View
              style={[
                styles.bottomNavWrap,
                { paddingBottom: Math.max(insets.bottom, 18) },
              ]}
            >
              <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}

      <QrScannerModal
        compact={compact}
        visible={modal?.type === 'scan'}
        onClose={() => setModal(null)}
        onQrScanned={handleQrScanned}
      />
      <FullQrModal
        compact={compact}
        visible={modal?.type === 'fullQr'}
        amount={flexibleReceive ? 'Montant libre' : `${receiveAmount || '0,00'} USDC`}
        label={activeReceiveLabel}
        qrData={activeReceiveQrData}
      onClose={() => setModal(null)}
      />
      <TransactionSheet
        visible={modal?.type === 'transaction'}
        phase={modal?.type === 'transaction' ? modal.phase : 'pending'}
        variant={modal?.type === 'transaction' ? modal.variant : 'pay'}
        amount={transactionAmount}
        counterparty={transactionCounterparty}
        onClose={() => setModal(null)}
      />
    </>
  );
}

function SplashScreen({
  compact,
  onContinue,
}: {
  compact: boolean;
  onContinue: () => void;
}) {
  return (
    <SafeAreaView
      style={styles.fullScreen}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.splashScroll,
          compact ? styles.splashScrollCompact : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.heroWrap, compact ? styles.heroWrapCompact : null]}
        >
          <Text style={styles.eyebrow}>Sleepmask</Text>
          <SleepMaskMark size={compact ? 148 : 176} />
          <Text style={styles.heroTitle}>L&apos;argent, discrètement.</Text>
          <Text style={styles.heroText}>
            Une interface froide, blanche et calme. Le masque couvre, protège,
            puis révèle.
          </Text>
        </View>
        <View style={styles.heroFooterInline}>
          <PrimaryButton label="Continuer" onPress={onContinue} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LoginScreen({
  compact,
  connectionMethod,
  loading,
  error,
  onConnect,
}: {
  compact: boolean;
  connectionMethod: string | null;
  loading: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  return (
    <SafeAreaView
      style={styles.fullScreen}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.authScroll,
          compact ? styles.authScrollCompact : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SleepMaskMark size={compact ? 126 : 148} />
        <Text style={styles.screenTitle}>Connectez-vous</Text>
        <Text style={styles.screenText}>
          Votre wallet est prêt en arrière-plan. Simple, privé, immédiat.
        </Text>
        {connectionMethod ? (
          <Text style={styles.screenSubtext}>Dernière connexion : {connectionMethod}</Text>
        ) : null}
        <View style={styles.authMethods}>
          <PrimaryButton
            label={loading ? 'Chargement…' : 'Continuer'}
            onPress={onConnect}
            disabled={loading}
          />
        </View>
        {error ? (
          <View style={styles.authErrorCard}>
            <Text style={styles.authErrorTitle}>Connexion indisponible</Text>
            <Text style={styles.authErrorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type HomeTabProps = {
  compact: boolean;
  balanceMasked: boolean;
  balance?: string;
  holdings: Holding[];
  activity: ActivityItem[];
  depositAmount: string;
  onToggleBalance: () => void;
  onChangeDepositAmount: (value: string) => void;
  onDeposit: () => void;
  onRefresh: () => void;
  onOpenPay: () => void;
  onOpenReceive: () => void;
  onOpenProfile: () => void;
};

function HomeTab({
  compact,
  balanceMasked,
  balance,
  holdings,
  activity,
  depositAmount,
  onToggleBalance,
  onChangeDepositAmount,
  onDeposit,
  onRefresh,
  onOpenPay,
  onOpenReceive,
  onOpenProfile,
}: HomeTabProps) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        compact ? styles.scrollContentCompact : null,
      ]}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Sleepmask</Text>
          <Text style={styles.headerTitle}>Accueil</Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.headerAction}>
          <Text style={styles.headerActionText}>Refresh</Text>
        </Pressable>
      </View>

      <BalanceRevealCard
        compact={compact}
        masked={balanceMasked}
        balance={balance}
        onToggle={onToggleBalance}
      />

      <View style={styles.primaryActions}>
        <PrimaryButton label="Payer" onPress={onOpenPay} />
        <SecondaryButton label="Recevoir" onPress={onOpenReceive} />
      </View>

      <SectionBlock
        title="Approvisionner"
        caption="Déposez des USDC depuis votre wallet vers Sleepmask."
      >
        <InputField
          label="Montant à déposer"
          value={depositAmount}
          onChangeText={onChangeDepositAmount}
          placeholder="25,00"
          keyboardType="decimal-pad"
          hint="Le dépôt signe une vraie transaction depuis votre wallet public."
        />
        <PrimaryButton label="Déposer en USDC" onPress={onDeposit} />
      </SectionBlock>

      <SectionBlock
        title="Tokens détenus"
        caption="Les autres actifs restent visibles, mais le produit reste centré sur USDC."
      >
        {holdings.map(item => (
          <TokenRow key={item.id} item={item} />
        ))}
      </SectionBlock>

      <SectionBlock
        title="Activité récente"
        caption="Les repères et tags restent locaux au téléphone. Les détails techniques restent secondaires."
      >
        {activity.slice(0, 3).map(item => (
          <ActivityRow key={item.id} item={item} />
        ))}
        <Pressable onPress={onOpenProfile} style={styles.inlineAction}>
          <Text style={styles.inlineActionText}>Voir tout dans Profil</Text>
        </Pressable>
      </SectionBlock>
    </ScrollView>
  );
}

type TransferTabProps = {
  compact: boolean;
  mode: TransferMode;
  onChangeMode: (nextMode: string) => void;
  payAmount: string;
  payRecipient: string;
  payLinkInput: string;
  payEvmAddress: string;
  receiveAmount: string;
  flexibleReceive: boolean;
  receiveShareMode: ReceiveShareMode;
  receiveQrData?: string;
  receiveDisplayValue?: string;
  receiveDisplayLabel: string;
  onChangePayAmount: (value: string) => void;
  onChangePayRecipient: (value: string) => void;
  onChangePayLink: (value: string) => void;
  onChangePayEvmAddress: (value: string) => void;
  onChangeReceiveAmount: (value: string) => void;
  onToggleFlexibleReceive: (value: boolean) => void;
  onChangeReceiveShareMode: (value: string) => void;
  onOpenScan: () => void;
  onParsePayLink: () => void;
  onStartPayment: () => void;
  onGenerateReceive: () => void;
  onOpenFullQr: () => void;
  onCopyLink: () => void;
  onShare: () => void;
};

function TransferTab({
  compact,
  mode,
  onChangeMode,
  payAmount,
  payRecipient,
  payLinkInput,
  payEvmAddress,
  receiveAmount,
  flexibleReceive,
  receiveShareMode,
  receiveQrData,
  receiveDisplayValue,
  receiveDisplayLabel,
  onChangePayAmount,
  onChangePayRecipient,
  onChangePayLink,
  onChangePayEvmAddress,
  onChangeReceiveAmount,
  onToggleFlexibleReceive,
  onChangeReceiveShareMode,
  onOpenScan,
  onParsePayLink,
  onStartPayment,
  onGenerateReceive,
  onOpenFullQr,
  onCopyLink,
  onShare,
}: TransferTabProps) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        compact ? styles.scrollContentCompact : null,
      ]}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>USDC only</Text>
          <Text style={styles.headerTitle}>Transfert</Text>
        </View>
      </View>

      <SegmentedControl
        options={[
          { key: 'pay', label: 'Payer' },
          { key: 'receive', label: 'Recevoir' },
        ]}
        value={mode}
        onChange={onChangeMode}
      />

      {mode === 'pay' ? (
        <>
          <SectionBlock
            title="Payer"
            caption="Le flux reste centré sur USDC. Le tag destinataire n'est qu'un repère local pour votre historique."
          >
            <Pressable onPress={onOpenScan} style={styles.scanCard}>
              <Text style={styles.scanTitle}>Scanner un QR code</Text>
              <Text style={styles.scanText}>
                Chargez une demande Sleepmask via un QR ou un lien deep link.
              </Text>
            </Pressable>

            <SecondaryButton
              compact
              label="Analyser le lien"
              onPress={onParsePayLink}
            />

            <InputField
              label="Lien ou code"
              value={payLinkInput}
              onChangeText={onChangePayLink}
              placeholder="sleepmask://pay?requestId=..."
              hint="Accepte les liens Sleepmask/Sleepay ouverts depuis un QR ou un site."
            />

            <InputField
              label="Adresse EVM directe"
              value={payEvmAddress}
              onChangeText={onChangePayEvmAddress}
              placeholder="0x..."
              hint="Optionnel. Si elle est remplie, le paiement part directement vers ce wallet classique."
            />

            <InfoRail label="Paiement en USDC" />

            <InputField
              label="Montant"
              value={payAmount}
              onChangeText={onChangePayAmount}
              placeholder="48,00"
              keyboardType="decimal-pad"
            />
            <InputField
              label="Tag local"
              value={payRecipient}
              onChangeText={onChangePayRecipient}
              placeholder="Nom ou repère local"
              hint="Repère enregistré uniquement dans le cache local du téléphone."
            />

            <PrimaryButton label="Confirmer" onPress={onStartPayment} />
          </SectionBlock>
        </>
      ) : (
        <>
          <SectionBlock
            title="Recevoir"
            caption="Le QR crée une vraie demande de paiement USDC. Vous pouvez partager soit le flux Sleepmask, soit l'adresse one-shot pour wallet classique."
          >
            <InfoRail label="Recevoir en USDC" />

            <SegmentedControl
              options={[
                { key: 'sleepmask', label: 'Sleepmask' },
                { key: 'classic', label: 'Wallet classique' },
              ]}
              value={receiveShareMode}
              onChange={onChangeReceiveShareMode}
            />

            <View style={styles.toggleRow}>
              <ToggleChip
                label="Montant fixe"
                active={!flexibleReceive}
                onPress={() => onToggleFlexibleReceive(false)}
              />
              <ToggleChip
                label="Montant libre"
                active={flexibleReceive}
                onPress={() => onToggleFlexibleReceive(true)}
              />
            </View>

            {!flexibleReceive ? (
              <InputField
                label="Montant"
                value={receiveAmount}
                onChangeText={onChangeReceiveAmount}
                placeholder="24,00"
                keyboardType="decimal-pad"
              />
            ) : (
              <View style={styles.flexibleNotice}>
                <Text style={styles.flexibleTitle}>Montant libre</Text>
                <Text style={styles.flexibleText}>
                  Le payeur choisit le montant depuis son flux de paiement.
                </Text>
              </View>
            )}

            <View style={styles.qrCard}>
              <QrCodeMock size={compact ? 172 : 196} data={receiveQrData} />
              <Text style={styles.qrTitle}>Scannez pour me payer</Text>
              <Text style={styles.qrText}>
                {receiveQrData
                  ? receiveShareMode === 'classic'
                    ? 'Adresse one-shot compatible MetaMask et wallet classique.'
                    : flexibleReceive
                    ? 'Paiement discret en USDC, montant libre.'
                    : `${receiveAmount || '0,00'} USDC · Paiement discret`
                  : 'Génération du QR en cours…'}
              </Text>
              {receiveDisplayValue ? (
                <Text style={styles.qrMetaText}>
                  {receiveDisplayLabel === 'Wallet classique'
                    ? receiveDisplayValue
                    : 'Lien Sleepmask prêt à être partagé.'}
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.twoColumnRow,
                compact ? styles.stackedButtons : null,
              ]}
            >
              <SecondaryButton
                compact
                label={
                  receiveShareMode === 'classic'
                    ? "Copier l'adresse"
                    : 'Copier le lien'
                }
                onPress={onCopyLink}
              />
              <SecondaryButton compact label="Partager" onPress={onShare} />
            </View>
            <SecondaryButton
              compact
              label="Afficher en plein écran"
              onPress={onOpenFullQr}
            />
            <PrimaryButton
              label={receiveQrData ? 'Régénérer le QR' : 'Générer le QR'}
              onPress={onGenerateReceive}
            />
          </SectionBlock>
        </>
      )}
    </ScrollView>
  );
}

function ProfileTab({
  compact,
  connectionMethod,
  walletAddress,
  unlinkAddress,
  activity,
  onLogout,
}: {
  compact: boolean;
  connectionMethod: string | null;
  walletAddress: string | null;
  unlinkAddress: string | null;
  activity: ActivityItem[];
  onLogout: () => void;
}) {
  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : '—';
  const shortUnlink = unlinkAddress
    ? `${unlinkAddress.slice(0, 12)}…${unlinkAddress.slice(-6)}`
    : '—';
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        compact ? styles.scrollContentCompact : null,
      ]}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Compte</Text>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>
      </View>

      <View style={[styles.profileCard, shadows.card]}>
        <SleepMaskMark size={96} />
        <Text style={styles.profileTitle}>Wallet Sleepmask</Text>
        <Text style={styles.profileText}>
          Identité ZK dérivée localement. Aucune donnée transmise au repos.
        </Text>

        <View style={styles.profileMeta}>
          <ProfileMetaRow
            label="Connexion"
            value={connectionMethod ?? 'Dynamic'}
          />
          <ProfileMetaRow label="Adresse EVM" value={shortAddr} />
          <ProfileMetaRow label="Adresse Unlink" value={shortUnlink} />
        </View>

        <SecondaryButton
          compact
          label="Copier l'adresse EVM"
          onPress={() =>
            Alert.alert('Adresse EVM', walletAddress ?? 'Non disponible')
          }
        />
      </View>

      <SectionBlock
        title="Activité"
        caption="Historique enrichi localement pour garder des repères lisibles, sans bruit technique par défaut."
      >
        {activity.map(item => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </SectionBlock>

      <PrimaryButton label="Se déconnecter" onPress={onLogout} />
    </ScrollView>
  );
}

type FullQrModalProps = {
  compact: boolean;
  visible: boolean;
  amount: string;
  label: string;
  qrData?: string;
  onClose: () => void;
};

function FullQrModal({
  compact,
  visible,
  amount,
  label,
  qrData,
  onClose,
}: FullQrModalProps) {
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView
        style={styles.fullScreenQr}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Recevoir</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.modalClose}>Fermer</Text>
          </Pressable>
        </View>
        <View style={styles.fullQrCard}>
          <QrCodeMock size={compact ? 248 : 292} data={qrData} />
          <Text style={styles.fullQrTitle}>Scannez pour me payer</Text>
          <Text style={styles.fullQrText}>
            {label === 'Wallet classique'
              ? 'Adresse one-shot compatible wallet classique'
              : 'Paiement discret avec Sleepmask'}
          </Text>
          <Text style={styles.fullQrAmount}>{amount}</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled ? styles.buttonDisabled : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  compact,
}: {
  label: string;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        compact ? styles.secondaryButtonCompact : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SectionBlock({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, shadows.card]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCaption}>{caption}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function TokenRow({ item }: { item: Holding }) {
  return (
    <View style={[styles.listRow, item.primary ? styles.listRowPrimary : null]}>
      <View style={styles.rowLeft}>
        <View
          style={[
            styles.tokenDot,
            item.primary ? styles.tokenDotPrimary : null,
          ]}
        />
        <View>
          <Text style={styles.rowTitle}>{item.symbol}</Text>
          <Text style={styles.rowSubtitle}>{item.name}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{item.amount}</Text>
        <Text style={styles.rowNote}>{item.note}</Text>
      </View>
    </View>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.rowLeft}>
        <View
          style={[
            styles.directionDot,
            item.direction === 'Reçu' ? styles.directionDotReceive : null,
          ]}
        />
        <View>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>
          {item.amount} {item.token}
        </Text>
        <StatusPill status={item.status} />
      </View>
    </View>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (nextValue: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
  hint?: string;
}) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        keyboardType={keyboardType}
        style={styles.input}
      />
      {hint ? <Text style={styles.inputHint}>{hint}</Text> : null}
    </View>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleChip,
        active ? styles.toggleChipActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text
        style={[
          styles.toggleChipText,
          active ? styles.toggleChipTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRail({ label }: { label: string }) {
  return (
    <View style={styles.infoRail}>
      <Text style={styles.infoRailText}>{label}</Text>
    </View>
  );
}

function ProfileMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileMetaRow}>
      <Text style={styles.profileMetaLabel}>{label}</Text>
      <Text style={styles.profileMetaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenArea: {
    flex: 1,
  },
  bottomNavWrap: {
    paddingHorizontal: 18,
    backgroundColor: colors.background,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  splashScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 28,
  },
  splashScrollCompact: {
    justifyContent: 'flex-start',
    paddingTop: 24,
  },
  heroWrap: {
    alignItems: 'center',
    gap: 28,
  },
  heroWrapCompact: {
    gap: 22,
  },
  heroFooterInline: {
    marginTop: 30,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  heroText: {
    maxWidth: 320,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textMuted,
  },
  authScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: 'center',
    gap: 24,
  },
  authScrollCompact: {
    paddingTop: 24,
    justifyContent: 'flex-start',
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
  },
  screenText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 12,
  },
  screenSubtext: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textSubtle,
    marginTop: -4,
  },
  authMethods: {
    marginTop: 18,
    gap: 12,
  },
  authHelperText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  authErrorCard: {
    marginTop: 8,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authErrorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  authErrorText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 18,
  },
  scrollContentCompact: {
    paddingHorizontal: 16,
    gap: 14,
  },
  eyebrow: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  identityBannerWrap: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  identityCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  identityCardCopy: {
    gap: 8,
  },
  identityCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  identityCardText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  identityCardHint: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSubtle,
  },
  identityCardFooter: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  identityCardError: {
    fontSize: 13,
    lineHeight: 19,
    color: '#B42318',
  },
  identityInlineNote: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  identityInlineText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  headerTitle: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
  },
  balanceCardShell: {
    position: 'relative',
    paddingHorizontal: 6,
  },
  balanceBand: {
    position: 'absolute',
    top: '42%',
    width: 28,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#2A2F36',
  },
  balanceBandLeft: {
    left: 0,
  },
  balanceBandRight: {
    right: 0,
  },
  balanceCard: {
    borderRadius: 38,
    backgroundColor: colors.black,
    padding: 24,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D8E1EA',
  },
  balanceCaption: {
    marginTop: 8,
    fontSize: 13,
    color: '#AEBAC7',
  },
  balanceToggle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  balanceToggleText: {
    color: colors.surfaceRaised,
    fontSize: 12,
    fontWeight: '700',
  },
  balanceValue: {
    marginTop: 26,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: colors.surfaceRaised,
  },
  balanceFootnote: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    color: '#AEBAC7',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  stackedButtons: {
    flexDirection: 'column',
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    flex: 1,
  },
  primaryButtonText: {
    color: colors.surfaceRaised,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    flex: 1,
  },
  secondaryButtonCompact: {
    minHeight: 54,
    flex: 0,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.56,
  },
  section: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  sectionCaption: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  sectionBody: {
    marginTop: 18,
    gap: 12,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listRowPrimary: {
    backgroundColor: '#F0F6F3',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  tokenDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  tokenDotPrimary: {
    backgroundColor: colors.black,
  },
  directionDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.black,
  },
  directionDotReceive: {
    backgroundColor: colors.mintDeep,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  rowNote: {
    fontSize: 12,
    color: colors.textMuted,
  },
  inlineAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  inlineActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  scanCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    padding: 20,
    minHeight: 148,
    justifyContent: 'center',
  },
  scanTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  scanText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  infoRail: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.mint,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoRailText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blackSoft,
  },
  inputWrap: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  input: {
    minHeight: 58,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  inputHint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  toggleChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  toggleChipTextActive: {
    color: colors.surfaceRaised,
  },
  flexibleNotice: {
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flexibleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  flexibleText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  qrCard: {
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  qrTitle: {
    marginTop: 16,
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
  },
  qrText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.textMuted,
  },
  qrMetaText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSubtle,
    textAlign: 'center',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  profileCard: {
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 12,
  },
  profileTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  profileText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.textMuted,
  },
  profileMeta: {
    width: '100%',
    marginTop: 12,
    gap: 10,
  },
  profileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  profileMetaLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  profileMetaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 25, 0.24)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 34,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  modalClose: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  scannerFrame: {
    height: 300,
    borderRadius: 34,
    backgroundColor: '#F2F7FB',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scannerFrameCompact: {
    height: 252,
  },
  scannerCorner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: colors.black,
  },
  scannerCornerTopLeft: {
    top: 22,
    left: 22,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  scannerCornerTopRight: {
    top: 22,
    right: 22,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  scannerCornerBottomLeft: {
    bottom: 22,
    left: 22,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  scannerCornerBottomRight: {
    bottom: 22,
    right: 22,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  fullScreenQr: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  fullQrCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  fullQrTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  fullQrText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  fullQrAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.black,
  },
});
