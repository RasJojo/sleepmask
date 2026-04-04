# SLEEPMASK— UI/UX

> App de paiement privé, light theme, premium fintech.
> Prompt de design complet envoyé à un outil de génération UI.

---

## Identité visuelle (FINAL)

| Élément | Valeur |
|---------|--------|
| Fond principal | Ivoire / sable chaud |
| Surface cards | Off-white / pierre claire |
| Couleur primaire | Noir mat profond |
| Accent succès | Sage green / mint pâle |
| Texte primaire | Charcoal noir |
| Texte secondaire | Gris chaud atténué |
| Borders | Fin, gris chaud doux |
| Thème | **Light uniquement** |

**Interdit** : mode sombre, violet, dégradés neon, cyberpunk, charts trading.

---

## Nom de l'app
sleepmask

---

## Navigation (3 tabs)
- **Home** — Solde + actions rapides + activité
- **Transfer** — Segmented control Pay | Recevoir
- **Profile** — Wallet, sécurité, déconnexion

---

## Écrans (12 screens)

1. **Splash** — Masque abstrait centré, "Payez discrètement."
2. **Login** — Connexion Dynamic (Google, Apple, email, passkey)
3. **Home connecté** — Carte noire solde + boutons Payer/Recevoir + tokens + activité
4. **Transfer** — Segmented control Pay | Recevoir
5. **Pay** — Scanner QR + coller lien + sélection token + montant
6. **QR Scan** — Écran plein scan, cadre mint, "Scanner pour payer"
7. **Receive** — Sélection token + montant + QR généré
8. **QR plein écran** — QR centré, "Scannez pour me payer"
9. **Pending** — Masque noir qui recouvre le contenu, "Transaction masquée..."
10. **Success** — Masque qui se lève, sage green, "Paiement envoyé anonymement"
11. **Activity** — Liste transactions (sent/received/pending/failed)
12. **Profile** — Wallet Dynamic, adresse tronquée, déconnexion

---

## Signature motion
Le masque noir recouvre et révèle le contenu pendant les états de paiement.
Mouvement lent, élégant, légèrement théâtral. Jamais flashy.

---

## Copy UI (français)
- "Payez discrètement."
- "Recevez simplement."
- "Solde privé"
- "Masqué et prêt à être utilisé"
- "Transaction masquée..."
- "Nous protégeons l'échange pendant la confirmation."
- "Paiement envoyé anonymement"
- "Votre transaction a été confirmée."

---

## Hooks à brancher par ChatGPT UI

```typescript
// Balance
const { balance, unlinkAddress, loading, refresh } = useBalance(mnemonic);

// Payer
const { pay, status, txId, error } = usePayment(mnemonic);
await pay({ requestId, recipientUnlinkAddress, amount });

// Recevoir
const { createRequest, qrData, paid } = useReceive(unlinkAddress);
await createRequest("10000000", "3600");

// Déposer
const { deposit, status } = useDeposit(mnemonic);
await deposit("1000000000000000000");
```

---

## Questions ouvertes
- [ ] Outil de génération UI choisi ? (v0.dev, Figma AI, autre)
- [ ] Init Expo ou bare React Native ?
- [ ] Dynamic SDK RN : version compatible Expo ?
