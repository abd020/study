/**
 * Tests du moteur de répétition espacée (SM-2).
 *   node --experimental-strip-types scripts/test-sm2.mjs
 * ou : npm run test:sm2
 */
import { scheduleReview, INITIAL_STATE, previewInterval } from "../src/lib/sm2.ts";

let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) console.log(`  ok   ${label}`);
  else { console.log(`  FAIL ${label} ${detail}`); failures++; }
};
const days = (r) => r.interval_days;

console.log("— Nouvelle carte —");
let s = { ...INITIAL_STATE };
let again = scheduleReview(s, "again");
check("« Encore » sur une carte neuve → apprentissage, intervalle court",
  again.status === "learning" && days(again) < 0.02 && again.lapses === 0, JSON.stringify(again));
check("« Encore » incrémente incorrect_count", again.incorrect_count === 1);

let good = scheduleReview(s, "good");
check("« Bien » → 1 répétition, statut learning", good.repetitions === 1 && good.status === "learning");
check("« Bien » incrémente correct_count", good.correct_count === 1);

let easy = scheduleReview(s, "easy");
check("« Facile » donne un intervalle plus long que « Bien »", days(easy) > days(good), `${days(easy)} vs ${days(good)}`);
check("« Facile » augmente le facteur de facilité", easy.ease_factor > INITIAL_STATE.ease_factor);

console.log("\n— Progression sur plusieurs révisions —");
s = { ...INITIAL_STATE };
const intervals = [];
for (let i = 0; i < 6; i++) { s = scheduleReview(s, "good"); intervals.push(days(s)); }
check("Les intervalles croissent strictement",
  intervals.every((v, i) => i === 0 || v > intervals[i - 1]), JSON.stringify(intervals));
check("Carte maîtrisée après plusieurs bonnes réponses", s.status === "mastered", `status=${s.status} interval=${days(s)}`);
check("Facteur de facilité borné à 3.0 max", s.ease_factor <= 3.0);

console.log("\n— Rechute —");
const lapse = scheduleReview(s, "again");
check("« Encore » sur une carte mûre → lapsed", lapse.status === "lapsed");
check("« Encore » incrémente les rechutes", lapse.lapses === 1);
check("« Encore » réinitialise les répétitions", lapse.repetitions === 0);
check("« Encore » réduit l'intervalle", days(lapse) < days(s));
check("« Encore » baisse le facteur de facilité", lapse.ease_factor < s.ease_factor);

console.log("\n— Difficile —");
s = { ...INITIAL_STATE };
for (let i = 0; i < 3; i++) s = scheduleReview(s, "good");
const hard = scheduleReview(s, "hard");
const goodNext = scheduleReview(s, "good");
check("« Difficile » < « Bien »", days(hard) < days(goodNext), `${days(hard)} vs ${days(goodNext)}`);
check("« Difficile » baisse le facteur de facilité", hard.ease_factor < s.ease_factor);
check("« Difficile » compte comme correct", hard.correct_count === s.correct_count + 1);

console.log("\n— Bornes —");
s = { ...INITIAL_STATE };
for (let i = 0; i < 12; i++) s = scheduleReview(s, "again");
check("Facteur de facilité jamais sous 1.3", s.ease_factor >= 1.3, `ef=${s.ease_factor}`);
s = { ...INITIAL_STATE };
for (let i = 0; i < 25; i++) s = scheduleReview(s, "easy");
check("Intervalle plafonné à 365 jours", days(s) <= 365, `interval=${days(s)}`);

console.log("\n— Dates et aperçus —");
const now = new Date("2026-09-13T10:00:00Z");
const r = scheduleReview({ ...INITIAL_STATE, repetitions: 2, interval_days: 6, status: "review", correct_count: 2 }, "good", now);
const delta = (new Date(r.next_review_at) - now) / 86400000;
check("next_review_at = maintenant + intervalle", Math.abs(delta - days(r)) < 0.001, `${delta} vs ${days(r)}`);
check("last_reviewed_at correspond à l'instant de révision", r.last_reviewed_at === now.toISOString());
check("Aperçu « Encore » en minutes", previewInterval(INITIAL_STATE, "again").includes("min"), previewInterval(INITIAL_STATE, "again"));
check("Aperçu « Facile » lisible", /j|mois|an/.test(previewInterval({ ...INITIAL_STATE, repetitions: 3, interval_days: 10, status: "review" }, "easy")));

console.log(failures === 0 ? "\n✅ Tous les tests SM-2 passent." : `\n❌ ${failures} test(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
