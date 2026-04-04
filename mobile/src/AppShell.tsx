import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BalanceRevealCard } from './components/BalanceRevealCard';
import { BottomTabs } from './components/BottomTabs';
import { QrCodeMock } from './components/QrCodeMock';
import { SegmentedControl } from './components/SegmentedControl';
import { SleepMaskMark } from './components/SleepMaskMark';
import { StatusPill } from './components/StatusPill';
import { TransactionSheet } from './components/TransactionSheet';
import { activity, holdings, profileSummary } from './data/mock';
import { colors, radius, shadows } from './theme';

type Stage = 'splash' | 'login' | 'app';
type TabKey = 'home' | 'transfer' | 'profile';
type TransferMode = 'pay' | 'receive';
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
  const [stage, setStage] = useState<Stage>('splash');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [transferMode, setTransferMode] = useState<TransferMode>('pay');
  const [balanceMasked, setBalanceMasked] = useState(true);
  const [payAmount, setPayAmount] = useState('48,00');
  const [payRecipient, setPayRecipient] = useState('Atelier Saint-Honore');
  const [receiveAmount, setReceiveAmount] = useState('24,00');
  const [flexibleReceive, setFlexibleReceive] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    if (!modal || modal.type !== 'transaction' || modal.phase !== 'pending') {
      return;
    }

    const timeout = setTimeout(() => {
      setModal({
        type: 'transaction',
        phase: 'success',
        variant: modal.variant,
      });
    }, 2400);

    return () => clearTimeout(timeout);
  }, [modal]);

  const transactionCounterparty = useMemo(() => {
    return modal?.type === 'transaction' && modal.variant === 'receive'
      ? 'Paiement Sleepmask'
      : payRecipient;
  }, [modal, payRecipient]);

  const openPay = () => {
    setActiveTab('transfer');
    setTransferMode('pay');
  };

  const openReceive = () => {
    setActiveTab('transfer');
    setTransferMode('receive');
  };

  const showScanDemo = () => {
    setPayRecipient('Atelier Saint-Honore');
    setPayAmount('48,00');
    setTransferMode('pay');
    setModal(null);
  };

  const pasteDemoLink = () => {
    setPayRecipient('Le Comptoir Calme');
    setPayAmount('18,50');
    Alert.alert(
      'Lien mock collé',
      'Les champs de paiement ont été préremplis.',
    );
  };

  const startPayment = () => {
    setModal({
      type: 'transaction',
      phase: 'pending',
      variant: 'pay',
    });
  };

  const startReceiveSimulation = () => {
    setModal({
      type: 'transaction',
      phase: 'pending',
      variant: 'receive',
    });
  };

  const handleLogout = () => {
    setStage('login');
    setActiveTab('home');
    setTransferMode('pay');
    setModal(null);
  };

  const transactionAmount =
    modal?.type === 'transaction' && modal.variant === 'receive'
      ? flexibleReceive
        ? 'Libre'
        : receiveAmount || '24,00'
      : payAmount || '48,00';

  return (
    <>
      {stage === 'splash' ? (
        <SplashScreen compact={compact} onContinue={() => setStage('login')} />
      ) : stage === 'login' ? (
        <LoginScreen compact={compact} onConnect={() => setStage('app')} />
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
                  onToggleBalance={() => setBalanceMasked(current => !current)}
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
                  receiveAmount={receiveAmount}
                  flexibleReceive={flexibleReceive}
                  onChangePayAmount={setPayAmount}
                  onChangePayRecipient={setPayRecipient}
                  onChangeReceiveAmount={setReceiveAmount}
                  onToggleFlexibleReceive={setFlexibleReceive}
                  onOpenScan={() => setModal({ type: 'scan' })}
                  onPasteDemo={pasteDemoLink}
                  onStartPayment={startPayment}
                  onOpenFullQr={() => setModal({ type: 'fullQr' })}
                  onCopyLink={() =>
                    Alert.alert('Lien copié', 'Lien de réception mock copié.')
                  }
                  onShare={() =>
                    Alert.alert(
                      'Partage mock',
                      'La demande de paiement est prête.',
                    )
                  }
                  onSimulateReceive={startReceiveSimulation}
                />
              ) : (
                <ProfileTab compact={compact} onLogout={handleLogout} />
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

      <ScanModal
        compact={compact}
        visible={modal?.type === 'scan'}
        onClose={() => setModal(null)}
        onUseDemo={showScanDemo}
      />
      <FullQrModal
        compact={compact}
        visible={modal?.type === 'fullQr'}
        amount={
          flexibleReceive ? 'Montant libre' : `${receiveAmount || '24,00'} USDC`
        }
        onClose={() => setModal(null)}
        onSimulateReceive={startReceiveSimulation}
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
  onConnect,
}: {
  compact: boolean;
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

        <View style={styles.authMethods}>
          <AuthButton label="Continuer avec Google" onPress={onConnect} />
          <AuthButton label="Continuer avec Apple" onPress={onConnect} />
          <AuthButton label="Continuer avec email" onPress={onConnect} />
          <AuthButton label="Continuer avec passkey" onPress={onConnect} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type HomeTabProps = {
  compact: boolean;
  balanceMasked: boolean;
  onToggleBalance: () => void;
  onOpenPay: () => void;
  onOpenReceive: () => void;
  onOpenProfile: () => void;
};

function HomeTab({
  compact,
  balanceMasked,
  onToggleBalance,
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
      </View>

      <BalanceRevealCard
        compact={compact}
        masked={balanceMasked}
        onToggle={onToggleBalance}
      />

      <View style={styles.primaryActions}>
        <PrimaryButton label="Payer" onPress={onOpenPay} />
        <SecondaryButton label="Recevoir" onPress={onOpenReceive} />
      </View>

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
        caption="Historique local au device. Les tags et repères restent dans le cache local."
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
  receiveAmount: string;
  flexibleReceive: boolean;
  onChangePayAmount: (value: string) => void;
  onChangePayRecipient: (value: string) => void;
  onChangeReceiveAmount: (value: string) => void;
  onToggleFlexibleReceive: (value: boolean) => void;
  onOpenScan: () => void;
  onPasteDemo: () => void;
  onStartPayment: () => void;
  onOpenFullQr: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onSimulateReceive: () => void;
};

function TransferTab({
  compact,
  mode,
  onChangeMode,
  payAmount,
  payRecipient,
  receiveAmount,
  flexibleReceive,
  onChangePayAmount,
  onChangePayRecipient,
  onChangeReceiveAmount,
  onToggleFlexibleReceive,
  onOpenScan,
  onPasteDemo,
  onStartPayment,
  onOpenFullQr,
  onCopyLink,
  onShare,
  onSimulateReceive,
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
            caption="Tout le flux reste simplifié autour d'un paiement USDC unique. Le destinataire n'est qu'un tag local."
          >
            <Pressable onPress={onOpenScan} style={styles.scanCard}>
              <Text style={styles.scanTitle}>Scanner un QR code</Text>
              <Text style={styles.scanText}>
                Ouvrir un écran de scan propre, puis remplir la demande mock.
              </Text>
            </Pressable>

            <SecondaryButton
              compact
              label="Coller un lien ou un code"
              onPress={onPasteDemo}
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
              label="Tag destinataire"
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
            caption="Le QR reste central, avec un rail fixe en USDC. L'historique de réception reste local au device."
          >
            <InfoRail label="Recevoir en USDC" />

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
              <QrCodeMock size={compact ? 172 : 196} />
              <Text style={styles.qrTitle}>Scannez pour me payer</Text>
              <Text style={styles.qrText}>
                {flexibleReceive
                  ? 'Paiement discret en USDC, montant libre.'
                  : `${receiveAmount || '24,00'} USDC · Paiement discret`}
              </Text>
            </View>

            <View
              style={[
                styles.twoColumnRow,
                compact ? styles.stackedButtons : null,
              ]}
            >
              <SecondaryButton
                compact
                label="Copier le lien"
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
              label="Simuler une réception"
              onPress={onSimulateReceive}
            />
          </SectionBlock>
        </>
      )}
    </ScrollView>
  );
}

function ProfileTab({
  compact,
  onLogout,
}: {
  compact: boolean;
  onLogout: () => void;
}) {
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
        <Text style={styles.profileTitle}>{profileSummary.accountLabel}</Text>
        <Text style={styles.profileText}>
          Connexion mock via {profileSummary.connectionMethod}. Activité et tags
          conservés localement sur ce device.
        </Text>

        <View style={styles.profileMeta}>
          <ProfileMetaRow
            label="Moyen de connexion"
            value={profileSummary.connectionMethod}
          />
          <ProfileMetaRow label="Adresse" value={profileSummary.shortAddress} />
        </View>

        <SecondaryButton
          compact
          label="Copier l'adresse"
          onPress={() =>
            Alert.alert('Adresse mock copiée', profileSummary.fullAddress)
          }
        />
      </View>

      <SectionBlock
        title="Activité"
        caption="Historique local au device, toujours sans détails techniques visibles par défaut."
      >
        {activity.map(item => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </SectionBlock>

      <PrimaryButton label="Se déconnecter" onPress={onLogout} />
    </ScrollView>
  );
}

type ScanModalProps = {
  compact: boolean;
  visible: boolean;
  onClose: () => void;
  onUseDemo: () => void;
};

function ScanModal({ compact, visible, onClose, onUseDemo }: ScanModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, shadows.floating]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Scanner pour payer</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.modalClose}>Fermer</Text>
            </Pressable>
          </View>
          <Text style={styles.modalText}>
            Pointez votre caméra vers le QR code. Ici, le scan reste mocké pour
            préparer le flow.
          </Text>

          <View
            style={[
              styles.scannerFrame,
              compact ? styles.scannerFrameCompact : null,
            ]}
          >
            <View style={[styles.scannerCorner, styles.scannerCornerTopLeft]} />
            <View
              style={[styles.scannerCorner, styles.scannerCornerTopRight]}
            />
            <View
              style={[styles.scannerCorner, styles.scannerCornerBottomLeft]}
            />
            <View
              style={[styles.scannerCorner, styles.scannerCornerBottomRight]}
            />
            <SleepMaskMark size={compact ? 82 : 96} />
          </View>

          <PrimaryButton label="Utiliser un QR de démo" onPress={onUseDemo} />
        </View>
      </View>
    </Modal>
  );
}

type FullQrModalProps = {
  compact: boolean;
  visible: boolean;
  amount: string;
  onClose: () => void;
  onSimulateReceive: () => void;
};

function FullQrModal({
  compact,
  visible,
  amount,
  onClose,
  onSimulateReceive,
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
          <QrCodeMock size={compact ? 248 : 292} />
          <Text style={styles.fullQrTitle}>Scannez pour me payer</Text>
          <Text style={styles.fullQrText}>Paiement discret avec Sleepmask</Text>
          <Text style={styles.fullQrAmount}>{amount}</Text>
        </View>
        <PrimaryButton
          label="Simuler un paiement entrant"
          onPress={onSimulateReceive}
        />
      </SafeAreaView>
    </Modal>
  );
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
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

function AuthButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.authButton,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text style={styles.authButtonText}>{label}</Text>
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

function TokenRow({ item }: { item: (typeof holdings)[number] }) {
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

function ActivityRow({ item }: { item: (typeof activity)[number] }) {
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
  authMethods: {
    marginTop: 18,
    gap: 12,
  },
  authButton: {
    minHeight: 58,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
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
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
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
