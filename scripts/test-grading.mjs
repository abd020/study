/**
 * Tests de la correction des réponses de quiz.
 *   node --experimental-strip-types scripts/test-grading.mjs
 */
import { checkAnswer } from "../src/lib/quiz-grading.ts";

let failures = 0;
const check = (label, condition) => {
  if (condition) console.log(`  ok   ${label}`);
  else { console.log(`  FAIL ${label}`); failures++; }
};
const q = (question_type, correct_answer) => ({ question_type, correct_answer });

console.log("— Choix multiple —");
check("Réponse exacte acceptée", checkAnswer(q("multiple_choice", "La sensibilité aux taux"), "La sensibilité aux taux"));
check("Casse et accents tolérés", checkAnswer(q("multiple_choice", "Élasticité"), "elasticite"));
check("Autre choix refusé", !checkAnswer(q("multiple_choice", "A"), "B"));
check("Réponse partielle refusée en QCM", !checkAnswer(q("multiple_choice", "sensibilité aux taux"), "sensibilité"));

console.log("\n— Vrai / Faux —");
check("« vrai » accepté", checkAnswer(q("true_false", "Vrai"), "vrai"));
check("« Faux » refusé quand « Vrai » attendu", !checkAnswer(q("true_false", "Vrai"), "Faux"));

console.log("\n— Réponse courte —");
check("Formule identique acceptée", checkAnswer(q("short_answer", "VP = C / r"), "VP = C / r"));
check("Ponctuation différente tolérée", checkAnswer(q("short_answer", "VP = C / r"), "vp c r"));
check("Mots dans le désordre tolérés", checkAnswer(q("short_answer", "valeur temporelle"), "temporelle valeur"));
check("Mots vides ignorés", checkAnswer(q("short_answer", "la duration d'une obligation"), "duration obligation"));
check("Réponse partielle refusée", !checkAnswer(q("short_answer", "VP = C / r"), "r"));
check("Réponse vide refusée", !checkAnswer(q("short_answer", "VP = C / r"), "   "));
check("Mot manquant refusé", !checkAnswer(q("short_answer", "sensibilité aux taux"), "sensibilité"));
check("Réponse plus longue mais complète acceptée", checkAnswer(q("short_answer", "modèle de Gordon"), "le modèle de Gordon-Shapiro"));
check("Accents dans la réponse attendue tolérés", checkAnswer(q("short_answer", "intérêts composés"), "interets composes"));

console.log(failures === 0 ? "\n✅ Tous les tests de correction passent." : `\n❌ ${failures} test(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
