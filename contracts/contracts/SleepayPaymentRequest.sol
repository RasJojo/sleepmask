// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SleepayPaymentRequest
 * @notice Orchestrateur de paiements privés Sleepay — architecture two-burner.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  CAS 1 — Sleepmask → Sleepmask (protection maximale)
 * ═══════════════════════════════════════════════════════════════════════
 *  Alice appelle instructPayment(requestId, amount)
 *  → contrat génère BurnerA (CREATE2), émet PaymentInstructed
 *  Backend :
 *    Alice ──[Unlink ZK]──► BurnerA ──[Unlink ZK]──► BurnerB ──► Bob
 *  On-chain visible : Alice→Unlink pool … Unlink pool→Bob
 *  Aucun lien Alice↔Bob. Double couche ZK.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  CAS 2 — Sleepmask → wallet classique
 * ═══════════════════════════════════════════════════════════════════════
 *  Alice appelle instructPayment(requestId, amount)
 *  → contrat génère BurnerA, émet PaymentInstructed
 *  Backend :
 *    Alice ──[Unlink ZK]──► BurnerA ──[withdraw]──► Bob EVM
 *  On-chain visible : Alice→Unlink pool … Unlink pool→Bob EVM
 *  Alice protégée. Bob voit juste un retrait Unlink anonyme.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  CAS 3 — Wallet classique → Sleepmask
 * ═══════════════════════════════════════════════════════════════════════
 *  Backend génère adresse EVM one-shot dérivée du requestId
 *  Appelle registerOneShot(requestId, oneshotEVM) → émet OneShotRegistered
 *  Bob envoie USDC à oneshotEVM (Alice lui montre juste cette adresse)
 *  Relayer détecte l'arrivée (Transfer event ERC20) → appelle notifyReceived()
 *  → contrat vérifie le solde on-chain, émet FundsReceived
 *  Backend : sweep oneshotEVM ──[Unlink deposit]──► Alice Unlink pool
 *  Appelle markPaid() après confirmation Unlink
 *  Bob ne voit jamais l'adresse Unlink d'Alice. Alice protégée.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  Arc bounty : logique conditionnelle USDC + expiry + multi-step settlement
 * ═══════════════════════════════════════════════════════════════════════
 */
contract SleepayPaymentRequest is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constante pour prédiction CREATE2 ───────────────────────────────────

    /// @dev Seed arbitraire et constant utilisé comme initCodeHash CREATE2.
    ///      Aucun contrat n'est jamais déployé — c'est un salt partagé entre
    ///      le contrat et le backend pour dériver des adresses déterministes.
    bytes32 private constant BURNER_INIT_CODE_HASH = keccak256("sleepay.burner.v1");

    // ─── Types ────────────────────────────────────────────────────────────────

    enum Status {
        Pending,      // Demande créée, en attente d'action
        Instructed,   // Cas 1/2 : paiement instruis, BurnerA généré, ZK transfer en cours
        BurnerReady,  // Cas 3  : one-shot EVM enregistré, en attente des fonds de Bob
        Paid,         // Paiement confirmé (tous cas)
        Expired,      // TTL dépassé
        Cancelled     // Annulé par le créateur
    }

    struct PaymentRequest {
        bytes32 unlinkAddressHash; // keccak256(unlinkAddress) — jamais révélée on-chain
        address token;             // ERC20 accepté (USDC, EURC…)
        uint256 amount;            // 0 = montant libre
        uint256 expiresAt;         // timestamp UNIX, 0 = sans expiry
        address creator;           // wallet créateur de la request
        Status  status;
        // ─ Settlement tracking ─
        address burnerAddress;     // BurnerA (cas 1/2) ou one-shot EVM (cas 3)
        uint256 burnerNonce;       // Nonce utilisé pour prédire burnerAddress (cas 1/2)
        uint256 paidAmount;        // Montant effectivement traité
        uint256 paidAt;            // Timestamp de confirmation finale
    }

    // ─── State ────────────────────────────────────────────────────────────────

    mapping(bytes32 => PaymentRequest) public requests;

    /// @notice Relayer backend — seul autorisé à émettre instructions et confirmations
    address public relayer;

    /// @notice Tokens ERC20 acceptés (USDC mainnet, USDC testnet, EURC…)
    mapping(address => bool) public acceptedTokens;

    /// @dev Nonce global pour dérivation déterministe des burners
    uint256 private _burnerNonce;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Request de paiement créée (destination hashée, vie privée préservée)
    event RequestCreated(
        bytes32 indexed requestId,
        address indexed creator,
        address token,
        uint256 amount,
        uint256 expiresAt
    );

    /**
     * @notice Cas 1/2 : Alice veut payer — backend doit exécuter le ZK transfer.
     * @param requestId     Identifiant de la request
     * @param burnerAddress Adresse EVM déterministe du BurnerA (CREATE2)
     *                      → utilisée comme seed pour la keypair Unlink éphémère
     * @param amount        Montant à transférer
     * @param token         Token ERC20
     */
    event PaymentInstructed(
        bytes32 indexed requestId,
        address indexed burnerAddress,
        uint256 amount,
        address token
    );

    /**
     * @notice Cas 3 : adresse one-shot enregistrée pour réception depuis wallet classique.
     * @param requestId    Identifiant de la request
     * @param oneshotAddress Adresse EVM one-shot que Bob doit envoyer les fonds
     * @param amount       Montant attendu (0 = libre)
     * @param token        Token ERC20
     */
    event OneShotRegistered(
        bytes32 indexed requestId,
        address indexed oneshotAddress,
        uint256 amount,
        address token
    );

    /**
     * @notice Cas 3 : fonds arrivés au one-shot, vérifiés on-chain.
     *         Backend doit sweep → Unlink deposit → Alice puis appeler markPaid().
     * @param requestId    Identifiant de la request
     * @param oneshotAddress Adresse one-shot où les fonds sont confirmés
     * @param amount       Montant confirmé on-chain
     */
    event FundsReceived(
        bytes32 indexed requestId,
        address indexed oneshotAddress,
        uint256 amount
    );

    /// @notice Paiement finalisé — tous cas confondus
    event RequestPaid(
        bytes32 indexed requestId,
        uint256 paidAmount,
        uint256 paidAt
    );

    event RequestExpired(bytes32 indexed requestId);
    event RequestCancelled(bytes32 indexed requestId);
    event RelayerUpdated(address indexed newRelayer);
    event TokenWhitelisted(address indexed token, bool accepted);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error RequestNotFound();
    error RequestNotPending();
    error RequestAlreadyExists();
    error RequestExpiredError();
    error InsufficientAmount(uint256 expected, uint256 received);
    error UnauthorizedRelayer();
    error InvalidToken();
    error BurnerAlreadyAssigned();
    error FundsNotArrived();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _relayer) Ownable(msg.sender) {
        if (_relayer == address(0)) revert UnauthorizedRelayer();
        relayer = _relayer;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyRelayer() {
        if (msg.sender != relayer && msg.sender != owner()) revert UnauthorizedRelayer();
        _;
    }

    modifier requestExists(bytes32 requestId) {
        if (requests[requestId].creator == address(0)) revert RequestNotFound();
        _;
    }

    modifier notExpired(bytes32 requestId) {
        PaymentRequest storage req = requests[requestId];
        if (req.expiresAt > 0 && block.timestamp > req.expiresAt) {
            req.status = Status.Expired;
            emit RequestExpired(requestId);
            revert RequestExpiredError();
        }
        _;
    }

    // ─── Création ─────────────────────────────────────────────────────────────

    /**
     * @notice Crée une demande de paiement.
     *         La destination est hashée : jamais d'adresse Unlink en clair on-chain.
     *
     * @param requestId         Identifiant unique — keccak256(abi.encode(creator, nonce))
     * @param unlinkAddressHash keccak256(unlinkAddress) du destinataire
     * @param token             Token ERC20 (doit être whitelisté)
     * @param amount            Montant attendu (0 = libre)
     * @param ttlSeconds        Durée de validité en secondes (0 = illimité)
     */
    function createRequest(
        bytes32 requestId,
        bytes32 unlinkAddressHash,
        address token,
        uint256 amount,
        uint256 ttlSeconds
    ) external {
        if (!acceptedTokens[token]) revert InvalidToken();
        if (requests[requestId].creator != address(0)) revert RequestAlreadyExists();

        uint256 expiresAt = ttlSeconds > 0 ? block.timestamp + ttlSeconds : 0;

        requests[requestId] = PaymentRequest({
            unlinkAddressHash: unlinkAddressHash,
            token:             token,
            amount:            amount,
            expiresAt:         expiresAt,
            creator:           msg.sender,
            status:            Status.Pending,
            burnerAddress:     address(0),
            burnerNonce:       0,
            paidAmount:        0,
            paidAt:            0
        });

        emit RequestCreated(requestId, msg.sender, token, amount, expiresAt);
    }

    // ─── Cas 1 & 2 : Sleepmask → (Sleepmask | wallet classique) ─────────────

    /**
     * @notice Alice déclenche son paiement.
     *         Le contrat génère une adresse BurnerA déterministe (CREATE2) et émet
     *         PaymentInstructed. Le backend la reçoit et exécute :
     *           Alice ──[Unlink ZK]──► BurnerA ──[Unlink ZK/withdraw]──► Bob
     *
     * @param requestId Identifiant de la request à payer
     * @param amount    Montant à envoyer (doit couvrir req.amount si fixé)
     *
     * @dev L'adresse BurnerA est purement déterministe — aucun contrat n'est déployé.
     *      Elle sert de seed partagée entre le contrat et le backend pour
     *      dériver la keypair Unlink éphémère via keccak256(burnerAddress + "unlink").
     *      Ni l'identité d'Alice ni celle de Bob ne sont jamais visibles on-chain.
     */
    function instructPayment(
        bytes32 requestId,
        uint256 amount
    ) external requestExists(requestId) notExpired(requestId) {
        PaymentRequest storage req = requests[requestId];

        if (req.status != Status.Pending) revert RequestNotPending();
        if (req.amount > 0 && amount < req.amount) revert InsufficientAmount(req.amount, amount);

        uint256 nonce   = ++_burnerNonce;
        address burnerA = _predictBurnerAddress(requestId, nonce);

        req.status        = Status.Instructed;
        req.burnerAddress = burnerA;
        req.burnerNonce   = nonce;
        req.paidAmount    = amount; // stocké pour que le backend connaisse le montant exact

        emit PaymentInstructed(requestId, burnerA, amount, req.token);
    }

    // ─── Cas 3 : Wallet classique → Sleepmask ────────────────────────────────

    /**
     * @notice Backend enregistre une adresse EVM one-shot pour réception depuis wallet classique.
     *         Bob scanne le QR d'Alice → voit l'adresse one-shot → envoie USDC.
     *         Alice ne révèle jamais son adresse Unlink à Bob.
     *
     * @param requestId   Identifiant de la request d'Alice
     * @param oneshotEVM  Adresse EVM éphémère contrôlée par le backend
     *                    (dérivée de keccak256(masterKey, requestId))
     */
    function registerOneShot(
        bytes32 requestId,
        address oneshotEVM
    ) external onlyRelayer requestExists(requestId) notExpired(requestId) {
        PaymentRequest storage req = requests[requestId];

        if (req.status != Status.Pending) revert RequestNotPending();
        if (req.burnerAddress != address(0)) revert BurnerAlreadyAssigned();

        req.status        = Status.BurnerReady;
        req.burnerAddress = oneshotEVM;

        emit OneShotRegistered(requestId, oneshotEVM, req.amount, req.token);
    }

    /**
     * @notice Relayer notifie l'arrivée des fonds sur l'adresse one-shot.
     *         Le contrat vérifie le solde ERC20 on-chain avant d'émettre FundsReceived.
     *         Backend sweep oneshotEVM ──[Unlink deposit]──► Alice Unlink pool.
     *         Appeler markPaid() après confirmation du deposit Unlink.
     *
     * @param requestId Identifiant de la request
     * @param amount    Montant reçu (vérifié contre le solde réel on-chain)
     */
    function notifyReceived(
        bytes32 requestId,
        uint256 amount
    ) external onlyRelayer nonReentrant requestExists(requestId) {
        PaymentRequest storage req = requests[requestId];

        if (req.status != Status.BurnerReady) revert RequestNotPending();

        if (req.expiresAt > 0 && block.timestamp > req.expiresAt) {
            req.status = Status.Expired;
            emit RequestExpired(requestId);
            revert RequestExpiredError();
        }

        // Vérification on-chain : les fonds sont bien arrivés (pas de fausse déclaration)
        uint256 onchainBalance = IERC20(req.token).balanceOf(req.burnerAddress);
        if (onchainBalance < amount) revert FundsNotArrived();

        // Vérification montant conditionnel (Arc bounty logic)
        if (req.amount > 0 && amount < req.amount) revert InsufficientAmount(req.amount, amount);

        // Stocke le montant confirmé — reste BurnerReady jusqu'au markPaid post-Unlink
        req.paidAmount = amount;

        emit FundsReceived(requestId, req.burnerAddress, amount);
    }

    // ─── Settlement final (tous cas) ──────────────────────────────────────────

    /**
     * @notice Finalise le paiement après confirmation du transfert Unlink.
     *         Appelé par le relayer backend après poll du txId Unlink.
     *         Valide pour Instructed (cas 1/2) et BurnerReady (cas 3).
     *
     * @param requestId  Identifiant de la request
     * @param paidAmount Montant confirmé par Unlink
     */
    function markPaid(
        bytes32 requestId,
        uint256 paidAmount
    ) external onlyRelayer nonReentrant requestExists(requestId) {
        PaymentRequest storage req = requests[requestId];

        if (req.status != Status.Instructed && req.status != Status.BurnerReady) {
            revert RequestNotPending();
        }

        if (req.expiresAt > 0 && block.timestamp > req.expiresAt) {
            req.status = Status.Expired;
            emit RequestExpired(requestId);
            revert RequestExpiredError();
        }

        // Logique conditionnelle Arc : montant reçu doit couvrir le montant demandé
        if (req.amount > 0 && paidAmount < req.amount) {
            revert InsufficientAmount(req.amount, paidAmount);
        }

        // Checks → Effects → Interactions
        req.status     = Status.Paid;
        req.paidAmount = paidAmount;
        req.paidAt     = block.timestamp;

        emit RequestPaid(requestId, paidAmount, block.timestamp);
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    /**
     * @notice Expire manuellement les requests périmées.
     *         Appelable par n'importe qui pour libérer le state / économiser le gas.
     */
    function expireRequest(bytes32 requestId) external requestExists(requestId) {
        PaymentRequest storage req = requests[requestId];
        if (
            req.status == Status.Paid ||
            req.status == Status.Expired ||
            req.status == Status.Cancelled
        ) revert RequestNotPending();
        if (req.expiresAt == 0 || block.timestamp <= req.expiresAt) revert RequestNotPending();

        req.status = Status.Expired;
        emit RequestExpired(requestId);
    }

    /**
     * @notice Annule une request. Seul le créateur (ou owner) peut annuler.
     *         Impossible dès qu'un burner a été assigné (paiement en cours).
     */
    function cancelRequest(bytes32 requestId) external requestExists(requestId) {
        PaymentRequest storage req = requests[requestId];
        if (msg.sender != req.creator && msg.sender != owner()) revert UnauthorizedRelayer();
        if (req.status != Status.Pending) revert RequestNotPending();

        req.status = Status.Cancelled;
        emit RequestCancelled(requestId);
    }

    // ─── Prédiction CREATE2 ───────────────────────────────────────────────────

    /**
     * @notice Calcule l'adresse EVM déterministe d'un burner via CREATE2.
     *         Aucun contrat n'est déployé — c'est un salt partagé contract↔backend.
     *         Le backend reproduit ce calcul pour dériver la keypair Unlink éphémère.
     *
     *         Reproduire côté backend (viem) :
     *           const salt = keccak256(encodePacked(['bytes32','uint256'], [requestId, nonce]));
     *           const addr = getCreate2Address({
     *             from: CONTRACT_ADDRESS,
     *             salt,
     *             bytecodeHash: keccak256(toHex('sleepay.burner.v1')),
     *           });
     *
     * @param requestId Identifiant de la request
     * @param nonce     Nonce global au moment de l'instruction (stocké dans req.burnerNonce)
     */
    function predictBurnerAddress(bytes32 requestId, uint256 nonce) external view returns (address) {
        return _predictBurnerAddress(requestId, nonce);
    }

    function _predictBurnerAddress(bytes32 requestId, uint256 nonce) internal view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(requestId, nonce));
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            BURNER_INIT_CODE_HASH
        )))));
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function isPaid(bytes32 requestId) external view returns (bool) {
        return requests[requestId].status == Status.Paid;
    }

    function getStatus(bytes32 requestId) external view returns (Status) {
        return requests[requestId].status;
    }

    function getRequest(bytes32 requestId) external view returns (PaymentRequest memory) {
        return requests[requestId];
    }

    function getBurnerAddress(bytes32 requestId) external view returns (address) {
        return requests[requestId].burnerAddress;
    }

    function currentBurnerNonce() external view returns (uint256) {
        return _burnerNonce;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setRelayer(address _relayer) external onlyOwner {
        if (_relayer == address(0)) revert UnauthorizedRelayer();
        relayer = _relayer;
        emit RelayerUpdated(_relayer);
    }

    function setTokenAccepted(address token, bool accepted) external onlyOwner {
        acceptedTokens[token] = accepted;
        emit TokenWhitelisted(token, accepted);
    }
}
