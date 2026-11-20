# BLAC-P3-077 - Message livreur complet (WhatsApp : livreur, articles, lien de suivi)

## Mesures (node --test --import ./tests/helpers/register.mjs)
| Moment | tests | reussis | echecs | ignores |
|---|---|---|---|---|
| Avant (baseline, avant toute modification) | 837 | 837 | 0 | 0 |
| Apres | 847 | 847 | 0 | 0 |

- Ecart de +10 tests = les 10 tests de tests/driver-whatsapp-message-complet.test.mjs (nouveau fichier).
- Intermediaire mesure : avec le code modifie mais avant adaptation du test de l'ancien bouton, la suite donnait 846 tests, 845 reussis, 1 echec (voir Ecarts).
- Six fichiers cibles (nouveau test, driver-accept-whatsapp, driver-accept-delivery, driver-tracking-sender, delivery-tracking, tracking-view) : 52 tests, 52 reussis, 0 echec, 0 ignore.
- Typage : tsc --noEmit filtre sur les quatre fichiers modifies : aucune erreur remontee.

## Checklist
- [x] lib/delivery-whatsapp.ts : buildEnRouteMessage accepte items (nom, quantite), ligne "Votre commande : 2 x Produit, ..." (8 articles max puis ", et N autre(s)"), comportement inchange sans liste ou liste vide
- [x] lib/delivery-whatsapp.ts : helper shareTrackingViaWhatsApp (appel de la route puis ouverture de whatsappUrl) pour que le bouton soit testable
- [x] app/api/driver/accept-delivery/route.ts : lecture de order_items (product_name, quantity) par order_id, passee a buildEnRouteMessage dans les deux chemins (acceptation et deja accepte) ; tout echec => liste vide, aucune exception
- [x] components/driver/DriverMarkDelivered.tsx : bouton "Prévenir le client et partager mon suivi", erreur courte et nouvel essai possible, aide en trois lignes conservee en astuce optionnelle
- [x] components/driver/DriverTrackingSender.tsx : navigator.wakeLock demande, redemande au retour de visibilite, position envoyee immediatement au retour de visibilite, texte "Garde cet écran ouvert pour que le client te suive", indisponibilite du verrou ignoree
- [x] API de suivi, schema et autres composants non modifies
- [x] Tests ecrits et lances, mesures avant et apres relevees

## Ecarts
1. Test existant adapte hors de la liste des zones d'ecriture : tests/driver-signalement-fenetre.test.mjs, test "bouton WhatsApp : secondaire de 44 px avec icone SVG, meme comportement". Justification : il verifiait l'ancien libelle "Partager ma position en direct dans WhatsApp", les noms d'etat helpOpen/setHelpOpen, une hauteur de 44 px et l'absence de soulignement, qui contredisent le nouveau bouton demande par le ticket. Il est remplace par une version qui verifie le nouveau libelle, minHeight 48, l'icone SVG, aria-expanded={tipOpen}, setTipOpen et le texte de l'astuce. Le ticket demande d'adapter et lister tout test verifiant l'ancien comportement, mais ce fichier ne figure pas dans la liste des zones : a valider par Martial.
2. tests/driver-tracking-sender.test.mjs : assertion sur l'ancien libelle du bouton remplacee par le nouveau libelle (fichier autorise).
3. Le comportement du verrou d'ecran et du retour de visibilite est verifie par lecture du source (comme les tests existants du composant), pas par execution dans un navigateur : le composant React n'est pas executable dans la suite node.
4. Aucun test reel sur appareil ni navigateur n'a ete fait ; window.location.href est utilise pour ouvrir WhatsApp (ouverture apres un appel reseau, plus fiable qu'un window.open sur mobile), non verifie sur telephone.

## Limites
Un navigateur ne peut pas garantir l'envoi continu de la position quand l'application est en arriere-plan ou l'ecran verrouille. Le verrou d'ecran (wakeLock) n'est qu'une aide, disponible seulement sur certains navigateurs, et il est relache si le livreur quitte la page. Pour un suivi continu ecran verrouille, seule la fonction native "Partager la position en direct" de WhatsApp convient, d'ou l'astuce conservee sous le bouton.
