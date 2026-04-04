// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SleepayPaymentRequest
 * @notice Registre de demandes de paiement privées pour Sleepay.
 *
 * Flow :
 * 1. Marchand appelle createRequest() → requestId stocké on-chain avec hash de destination Unlink
 * 2. Acheteur paie via Unlink (ZK transfer, hors-chain)
 * 3. Backend appelle markPaid() après confirmation Unlink → solde vérifié
 * 4. N'importe qui vérifie isPaid(requestId)
 *
 * Bounty Arc : logique conditionnelle USDC, settlement multi-step, expiry automatique.
 */
contract SleepayPaymentRequest is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ────────────────────────────────────────────────────────────────

    enum Status { Pending, Paid, Expired, Cancelled }

    struct PaymentRequest {
        bytes32  unlinkAddressHash; // keccak256 de l'adresse Unlink du destinataire — jamais révélée
        address  token;             // USDC ou autre ERC20
        uint256  amount;            // 0 = montant libre
        uint256  expiresAt;         // timestamp UNIX, 0 = pas d'expiry
        address  creator;           // wallet qui a créé la request
        Status   status;
        uint256  paidAmount;        // montant effectivement reçu
        uint256  paidAt;            // timestamp du paiement
    }

    // ─── State ────────────────────────────────────────────────────────────────

    mapping(bytes32 => PaymentRequest) public requests;

    // Adresse du relayer backend autorisé à appeler markPaid
    address public relayer;

    // Whitelist de tokens acceptés (USDC, EURC, etc.)
    mapping(address => bool) public acceptedTokens;

    // ─── Events ───────────────────────────────────────────────────────────────

    event RequestCreated(
        bytes32 indexed requestId,
        address indexed creator,
        address token,
        uint256 amount,
        uint256 expiresAt
    );

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
    error RequestAlreadyPaid();
    error RequestExpiredError();
    error InsufficientAmount(uint256 expected, uint256 received);
    error UnauthorizedRelayer();
    error InvalidToken();
    error InvalidAmount();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _relayer) Ownable(msg.sender) {
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

    // ─── Core : création ──────────────────────────────────────────────────────

    /**
     * @notice Crée une demande de paiement.
     * @param requestId        Identifiant unique (ex: keccak256(abi.encode(creator, nonce)))
     * @param unlinkAddressHash Hash de l'adresse Unlink destinataire — protège la vie privée
     * @param token            Adresse du token ERC20 (USDC)
     * @param amount           Montant en unités token (0 = libre)
     * @param ttlSeconds       Durée de validité en secondes (0 = pas d'expiry)
     */
    function createRequest(
        bytes32 requestId,
        bytes32 unlinkAddressHash,
        address token,
        uint256 amount,
        uint256 ttlSeconds
    ) external {
        if (!acceptedTokens[token]) revert InvalidToken();
        if (requests[requestId].creator != address(0)) revert RequestAlreadyPaid();

        uint256 expiresAt = ttlSeconds > 0 ? block.timestamp + ttlSeconds : 0;

        requests[requestId] = PaymentRequest({
            unlinkAddressHash: unlinkAddressHash,
            token:             token,
            amount:            amount,
            expiresAt:         expiresAt,
            creator:           msg.sender,
            status:            Status.Pending,
            paidAmount:        0,
            paidAt:            0
        });

        emit RequestCreated(requestId, msg.sender, token, amount, expiresAt);
    }

    // ─── Core : settlement ────────────────────────────────────────────────────

    /**
     * @notice Marque une request comme payée. Appelé par le relayer backend
     *         après confirmation du transfert Unlink ZK.
     * @param requestId   La request à solder
     * @param paidAmount  Montant confirmé par Unlink
     */
    function markPaid(
        bytes32 requestId,
        uint256 paidAmount
    ) external onlyRelayer nonReentrant requestExists(requestId) {
        PaymentRequest storage req = requests[requestId];

        if (req.status != Status.Pending) revert RequestNotPending();

        // Vérifie expiry
        if (req.expiresAt > 0 && block.timestamp > req.expiresAt) {
            req.status = Status.Expired;
            emit RequestExpired(requestId);
            revert RequestExpiredError();
        }

        // Vérifie le montant si fixe (logique conditionnelle Arc)
        if (req.amount > 0 && paidAmount < req.amount) {
            revert InsufficientAmount(req.amount, paidAmount);
        }

        // Settlement multi-step : update state avant events (checks-effects-interactions)
        req.status    = Status.Paid;
        req.paidAmount = paidAmount;
        req.paidAt    = block.timestamp;

        emit RequestPaid(requestId, paidAmount, block.timestamp);
    }

    /**
     * @notice Expire manuellement les requests périmées (appelable par tous).
     */
    function expireRequest(bytes32 requestId) external requestExists(requestId) {
        PaymentRequest storage req = requests[requestId];
        if (req.status != Status.Pending) revert RequestNotPending();
        if (req.expiresAt == 0 || block.timestamp <= req.expiresAt) revert RequestNotPending();

        req.status = Status.Expired;
        emit RequestExpired(requestId);
    }

    /**
     * @notice Annule une request. Seul le créateur peut annuler.
     */
    function cancelRequest(bytes32 requestId) external requestExists(requestId) {
        PaymentRequest storage req = requests[requestId];
        if (msg.sender != req.creator && msg.sender != owner()) revert UnauthorizedRelayer();
        if (req.status != Status.Pending) revert RequestNotPending();

        req.status = Status.Cancelled;
        emit RequestCancelled(requestId);
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

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
        emit RelayerUpdated(_relayer);
    }

    function setTokenAccepted(address token, bool accepted) external onlyOwner {
        acceptedTokens[token] = accepted;
        emit TokenWhitelisted(token, accepted);
    }
}
