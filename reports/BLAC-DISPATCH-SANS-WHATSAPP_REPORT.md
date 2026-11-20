# BLAC-DISPATCH-SANS-WHATSAPP — Rapport

## Checklist
- [x] Fenetre de dispatch (phase succes) : bouton "Envoyer message WhatsApp au client" et texte "Prevenez le client par WhatsApp" retires ; affichage de "Livreur dispatche. Le livreur previent le client depuis son application." et du bouton Fermer
- [x] Liste des commandes : le bouton WhatsApp de transition n'est plus rendu quand le statut cible est en_livraison (`if (pending === 'en_livraison') return null`)
- [x] Boutons WhatsApp des autres statuts (confirmee, preparation, livree, retrait, annulation) inchanges
- [x] Liens WhatsApp de contact simple (client et livreur) inchanges
- [x] finishDispatch envoie toujours le statut en_livraison (sendStatusBeacon), met a jour l'etat local (onDispatched) et ferme ; la notification push au livreur (/api/driver/notify-assignment) est inchangee
- [x] Code devenu inutile supprime apres recherche : etat successWaUrl/setSuccessWaUrl, constantes formatDateLocal et waUrl du dispatch (grep residuel : aucune occurrence)
- [x] Test tests/admin-dispatch-sans-whatsapp.test.mjs ecrit et execute
- [x] Suite complete executee avant et apres

## Mesures (node --test --import ./tests/helpers/register.mjs)
| | tests | reussis | echecs | ignores |
|---|---|---|---|---|
| Avant | 816 | 816 | 0 | 0 |
| Apres | 824 | 824 | 0 | 0 |

- Test du ticket seul : 8 tests, 8 reussis, 0 echec, 0 ignore.
- Ecart +8 = les 8 nouveaux tests du ticket ; aucun autre test n'a change d'etat.
- git diff de la page : 2 insertions, 15 suppressions.
- tsc --noEmit : aucune erreur signalee pour app/admin/commandes/page.tsx.

## Tests existants adaptes
Aucun : aucun test existant ne verifiait l'ancien comportement.

## Ecarts / points d'attention
- Conserve volontairement (non supprime) : la branche `en_livraison` de buildWhatsAppUrl et le libelle WA_BUTTON_LABELS.en_livraison, car ils sont atteints par recherche dynamique (targetStatus / pending) et ne peuvent pas etre prouves inutilises par simple recherche de texte.
- Effet de bord attendu de la consigne (2) : dans la zone du statut en attente, il n'y a plus de bouton pour valider le passage en_livraison ; ce passage s'effectue via la fenetre de dispatch (finishDispatch). Non verifie en conditions reelles dans le navigateur (aucun test d'interface execute).
