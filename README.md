# Revia — révision scolaire et universitaire

Application web full-stack pour centraliser ses cours et réviser efficacement :
chapitres, contenus, flashcards à répétition espacée, quiz, examens, calendrier,
progression et points faibles — avec Claude pour transformer le matériel de cours
en supports de révision.

> Ce n'est pas une maquette : l'authentification, la base de données, la sécurité,
> la logique métier et l'intégration IA sont fonctionnelles. Toutes les données
> affichées viennent de Supabase.

---

## Sommaire

- [Stack](#stack)
- [Démarrage rapide](#démarrage-rapide)
- [Configuration de Supabase](#configuration-de-supabase)
- [Déploiement](#déploiement-vercel-netlify)
- [Sécurité](#sécurité)
- [Architecture](#architecture)
- [Modèle de données](#modèle-de-données)
- [Répétition espacée](#répétition-espacée)
- [Intégration Claude](#intégration-claude)
- [Maîtrise des coûts IA](#maîtrise-des-coûts-ia)
- [Tests](#tests)
- [Scripts](#scripts)

---

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + composants shadcn/ui (Radix) |
| Données | Supabase — PostgreSQL, Auth, Row Level Security, Storage |
| Serveur | Supabase Edge Functions (Deno) |
| IA | API Anthropic — `claude-opus-5`, appelée uniquement côté serveur |
| État serveur | TanStack Query |
| Graphiques | Recharts |

---

## Démarrage rapide

```bash
npm install
cp .env.example .env      # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5173
```

Avant le premier lancement, il faut appliquer les migrations sur un projet
Supabase — voir la section suivante.

---

## Configuration de Supabase

### 1. Appliquer le schéma

Avec la CLI Supabase, sur un projet distant :

```bash
supabase link --project-ref <votre-ref>
supabase db push
```

Ou en local :

```bash
supabase start
supabase db reset          # applique supabase/migrations/*.sql dans l'ordre
```

Les migrations, dans l'ordre :

| Fichier | Contenu |
|---|---|
| `20260101000000_init_schema.sql` | Types, tables, contraintes, index, triggers `updated_at` |
| `20260101000001_rls_policies.sql` | RLS sur toutes les tables, rôles, provisionnement du profil, garde-fous d'intégrité |
| `20260101000002_business_logic.sql` | Vue `course_overview` et fonctions métier (cartes dues, points faibles, préparation d'examen, dashboard, progression, recherche, notifications) |
| `20260101000003_demo_data.sql` | `seed_demo_data()` / `remove_demo_data()` |
| `20260101000004_storage.sql` | Bucket privé `materials` et ses politiques |

### 2. Authentification

Dans **Authentication → Providers**, activer *Email*. Pour un MVP à deux comptes,
désactiver la confirmation par email accélère la mise en route ; sinon les
utilisateurs reçoivent un lien de confirmation.

Dans **Authentication → URL Configuration** :

- Site URL : `http://localhost:5173` (puis l'URL de production)
- Redirect URLs : ajouter `<origine>/reset-password`

À l'inscription, le trigger `handle_new_user()` crée automatiquement le profil,
le rôle `owner` et les préférences par défaut.

### 3. Clé Anthropic et Edge Function

La clé **ne doit jamais** se trouver dans le frontend. Elle est stockée dans les
secrets Supabase et lue uniquement par l'Edge Function :

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy generate-study-material
```

La fonction est déployée avec `verify_jwt = true` (voir `supabase/config.toml`) :
tout appel non authentifié est rejeté.

### 4. Données de démonstration (facultatif)

Depuis l'application : **Paramètres → Données → Créer les données de
démonstration**. Un cours « Finance (démo) » avec quatre chapitres, un contenu,
cinq cartes et un examen. Le bouton voisin supprime tout.

---

## Déploiement (Vercel, Netlify…)

### 1. Déclarer les variables d'environnement chez l'hébergeur

C'est l'oubli le plus fréquent. Vite **remplace** `import.meta.env.VITE_*` au
moment du build : le fichier `.env` local n'est pas versionné, donc l'hébergeur
ne le voit jamais. Sans ces variables, l'application se compile sans erreur mais
ne peut joindre aucune base.

Sur Vercel : **Settings → Environment Variables**, pour *Production*, *Preview*
et *Development* :

| Variable | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → *Project URL* |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → clé *anon public* |

Puis **redéployer** : les variables ne sont prises en compte qu'au build suivant,
un simple rafraîchissement de la page ne suffit pas.

Si elles manquent, l'application affiche un écran expliquant lesquelles sont
absentes plutôt qu'une page blanche.

`ANTHROPIC_API_KEY` n'a rien à faire ici : elle vit dans les secrets Supabase et
n'est lue que par l'Edge Function.

### 2. Autoriser le domaine déployé dans Supabase

**Authentication → URL Configuration** :

- *Site URL* : `https://<votre-projet>.vercel.app`
- *Redirect URLs* : ajouter `https://<votre-projet>.vercel.app/reset-password`
  et `https://<votre-projet>.vercel.app/login`

Sans cela, les liens de confirmation d'inscription et de réinitialisation de mot
de passe renvoient vers l'ancienne *Site URL* (souvent `localhost`). Pour les
déploiements de préversion, dont l'URL change à chaque commit, un motif comme
`https://<votre-projet>-*.vercel.app/**` couvre l'ensemble.

### 3. Routage

`vercel.json` redirige toutes les routes vers `index.html` : sans cette règle,
ouvrir ou rafraîchir directement `/courses/<id>` renvoie une 404, puisque le
routeur vit côté navigateur. Les fichiers de `assets/` restent servis
statiquement et sont mis en cache un an (leur nom contient une empreinte).

### 4. Version de Node

Le projet requiert **Node 20.11 ou plus** (`engines` dans `package.json`). Sur
Vercel : Settings → General → Node.js Version.

### Liste de vérification

```
[ ] VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY déclarées chez l'hébergeur
[ ] Redéploiement effectué après l'ajout des variables
[ ] Migrations appliquées sur le projet Supabase (supabase db push)
[ ] Domaine déployé ajouté dans Authentication → URL Configuration
[ ] ANTHROPIC_API_KEY dans les secrets Supabase, jamais côté frontend
[ ] Edge Function déployée (supabase functions deploy generate-study-material)
[ ] Node 20.11+ configuré
```

---

## Sécurité

La sécurité est appliquée par PostgreSQL, jamais par le frontend seul.

- **RLS activée et forcée** (`force row level security`) sur les 18 tables de
  données utilisateur. Aucune table n'est sans politique.
- **Politiques par opération** (`select` / `insert` / `update` / `delete`) sur
  `user_id = auth.uid()`. Les tables filles sans `user_id` — `quiz_questions`,
  `quiz_answers`, `exam_sections` — vérifient la propriété via leur parent.
- **Garde-fous d'intégrité** : des triggers `SECURITY DEFINER` refusent de
  rattacher une ressource à un cours, un chapitre ou une carte qui ne vous
  appartient pas. Connaître l'UUID d'une ressource d'autrui ne sert à rien.
- **Rôles non auto-attribuables** : `user_roles` est en lecture seule côté
  client ; seul le trigger d'inscription y écrit. `has_role()` est
  `SECURITY DEFINER` pour éviter toute récursion RLS.
- **Fonctions métier en `SECURITY INVOKER`** : la RLS s'applique à l'intérieur,
  y compris pour la recherche globale et les statistiques.
- **Storage privé** : le bucket `materials` range les fichiers sous
  `<user_id>/<course_id>/…` et les politiques comparent le premier segment du
  chemin à `auth.uid()`. Les téléchargements passent par des URL signées d'une
  heure.
- **Clé Anthropic côté serveur uniquement** : le navigateur n'appelle que
  l'Edge Function, qui valide le JWT, vérifie la propriété du cours, puis
  appelle l'API Anthropic.

Ces garanties sont vérifiées par un test automatisé (`npm run test:db`) qui
simule deux utilisateurs et tente une dizaine d'accès croisés.

---

## Architecture

```
src/
├── pages/         écrans (dashboard, cours, révision, quiz, calendrier, progression, paramètres)
├── components/
│   ├── ui/        primitives shadcn/ui
│   ├── layout/    sidebar, navigation mobile, barre supérieure, recherche, notifications
│   ├── common/    états vides, états d'erreur, squelettes, confirmations
│   ├── courses/   cartes de cours, formulaires, dialogues de génération
│   ├── exams/     formulaire et carte d'examen
│   └── study/     lecteur de flashcards, bilan de session
├── hooks/         hooks TanStack Query (un par domaine)
├── services/      accès aux données Supabase (aucun JSX)
├── lib/           logique pure : SM-2, correction de quiz, formatage, client Supabase
├── providers/     authentification, thème, client de requêtes
└── types/         types TypeScript correspondant au schéma
supabase/
├── migrations/    schéma, RLS, logique métier, démo, storage
├── functions/     Edge Function generate-study-material
└── tests/         tests SQL (schéma, RPC, isolation entre utilisateurs)
scripts/           tests SM-2, correction de quiz, validateurs, base de données
```

Règle de séparation : `lib/` ne dépend de rien de réseau, `services/` ne contient
pas de JSX, `hooks/` encapsule le cache et les notifications toast, `pages/` et
`components/` ne parlent jamais directement à Supabase.

---

## Modèle de données

Clés primaires en UUID, clés étrangères réelles, `created_at` / `updated_at` sur
les tables importantes, index sur `user_id`, `course_id`, `section_id`,
`exam_date` et `next_review_at`.

```
profiles ──┬── courses ──┬── course_sections ──┬── study_materials
           │             │                     ├── study_summaries
           │             │                     ├── flashcards ── flashcard_progress
           │             │                     └── exam_sections
           │             ├── exams ────────────┘
           │             └── quizzes ── quiz_questions ── quiz_answers
           │                                └── quiz_attempts ─┘
           ├── study_sessions
           ├── notifications
           ├── ai_generations
           ├── user_settings
           └── user_roles
```

Suppressions en cascade : un cours supprimé emporte ses chapitres, contenus,
cartes, progressions, quiz, questions, tentatives, réponses et examens.

### Fonctions métier (aucune n'appelle Claude)

| Fonction | Rôle |
|---|---|
| `get_due_flashcards()` | Cartes à réviser aujourd'hui, nouvelles d'abord |
| `get_weak_topics()` | Croise cartes en difficulté, réponses de quiz et fraîcheur des révisions |
| `get_exam_readiness()` | Score de préparation : maîtrise des cartes (55 %), quiz (25 %), couverture du programme (20 %), pénalité par notion faible |
| `build_exam_session()` | Session avant examen priorisée : cartes difficiles → jamais révisées → erreurs de quiz → notions faibles → dues |
| `get_dashboard_summary()` | Tout le dashboard en une requête, série de jours comprise |
| `get_progress_overview()` | Séries quotidiennes, performance par cours et par chapitre |
| `global_search()` | Recherche dans cours, chapitres, cartes, résumés, contenus, quiz, examens |
| `refresh_notifications()` | Rappels d'examen et de cartes dues, idempotents via `dedupe_key` |

---

## Répétition espacée

Le moteur est inspiré de **SM-2** et vit intégralement côté application
(`src/lib/sm2.ts`) : aucune révision ne déclenche d'appel réseau vers l'IA.

Quatre choix après chaque carte, avec l'intervalle prévisionnel affiché :

| Choix | Effet |
|---|---|
| **Encore** | Répétitions remises à zéro, carte replacée en apprentissage (10 min), rechute comptabilisée |
| **Difficile** | Intervalle × 1,2 et facteur de facilité abaissé |
| **Bien** | Progression standard SM-2 (× facteur de facilité) |
| **Facile** | Intervalle × facteur × 1,3, facteur de facilité relevé |

Le facteur de facilité reste borné entre 1,3 et 3,0, l'intervalle est plafonné à
365 jours. Une carte passe à `mastered` après 4 répétitions réussies et un
intervalle d'au moins 21 jours. Raccourcis clavier : `Espace` pour révéler,
`1`–`4` pour noter.

---

## Intégration Claude

Une seule Edge Function : `supabase/functions/generate-study-material`.

**Entrée** — `{ course_id, section_id?, generation_type, content?, force?, options? }`
avec `generation_type` parmi `summary`, `flashcards`, `quiz`, `key_concepts`,
`study_plan`, `explanation`.

**Déroulé**

1. Vérification du JWT, puis client Supabase créé avec le jeton de l'utilisateur
   (la RLS s'applique à toutes les lectures et écritures de la fonction).
2. Vérification que le cours — et le chapitre — appartiennent bien à l'appelant.
3. Construction du contexte **depuis la base**, à partir des `study_materials`
   du chapitre ou du cours (120 000 caractères au maximum).
4. Appel de `claude-opus-5` en *strict tool use* : le modèle doit renvoyer ses
   résultats via un outil au schéma JSON figé, jamais en texte libre.
5. **Validation côté serveur** de la sortie avant toute écriture : champs
   obligatoires, longueurs, énumérations, et pour les quiz la cohérence entre
   `correct_answer` et `choices`. Une sortie non conforme est rejetée.
6. Insertion en base, puis journalisation dans `ai_generations`
   (type, empreinte des entrées, modèle, statut, éléments créés, tokens).

**Ancrage dans le cours** — le prompt système impose de ne travailler qu'à partir
du matériel fourni et d'indiquer explicitement ce qui en est absent. La réponse
d'une explication porte un drapeau `grounded` et un champ
`missing_from_material`, affichés dans l'interface.

---

## Maîtrise des coûts IA

- Claude n'est appelé que sur action explicite : **générer**, **régénérer**,
  **expliquer**. Jamais au chargement d'une page.
- Tous les contenus générés sont persistés et relus depuis la base.
- Répétition espacée, progression, statistiques, calendrier, compte à rebours,
  points faibles et recherche fonctionnent **sans aucun appel à l'IA**.
- Déduplication : l'empreinte SHA-256 des entrées est comparée aux générations
  réussies des 24 dernières heures ; l'utilisateur doit confirmer
  « Régénérer quand même » pour repayer une génération identique.

---

## Tests

```bash
npm test            # typecheck + SM-2 + correction de quiz + validateurs IA
npm run test:db     # migrations + RPC + isolation RLS sur une base jetable
```

`npm run test:db` démarre un cluster PostgreSQL temporaire, applique les
migrations par-dessus un *shim* reproduisant le minimum de l'environnement
Supabase (`supabase/tests/00-supabase-shim.sql`), puis :

- vérifie le provisionnement automatique des profils, rôles et préférences ;
- exerce chaque fonction métier sur des données réalistes ;
- simule deux utilisateurs et tente lecture, écriture, modification et
  suppression croisées, y compris avec des UUID connus de l'autre compte ;
- contrôle les suppressions en cascade ;
- vérifie qu'aucune table n'a la RLS désactivée ni ne se retrouve sans politique.

Pour viser une base existante plutôt qu'un cluster jetable :

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres USE_LOCAL_CLUSTER=0 npm run test:db
```

---

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (typecheck inclus) |
| `npm run preview` | Prévisualisation du build |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Typecheck et tests de logique pure |
| `npm run test:sm2` | Moteur de répétition espacée |
| `npm run test:grading` | Correction des réponses de quiz |
| `npm run test:validators` | Validateurs de sortie de Claude |
| `npm run test:db` | Schéma, RPC et isolation RLS |

---

## Parcours utilisateur

1. Inscription, puis création d'un cours.
2. Découpage en chapitres, ajout du contenu (texte collé, notes, documents).
3. Enregistrement de la date d'examen et des chapitres évalués.
4. Génération d'un résumé, de flashcards et d'un quiz à partir du contenu.
5. Révision quotidienne : la répétition espacée fixe les prochaines échéances.
6. Le dashboard priorise le cours dont l'examen approche.
7. Le moteur de points faibles remonte les notions fragiles.
8. « Révision avant examen » mélange cartes difficiles, notions jamais vues,
   erreurs de quiz et points faibles, limités aux chapitres évalués.
