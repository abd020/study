/**
 * Tests des validateurs de l'Edge Function : ce sont eux qui empêchent
 * qu'une sortie mal formée de Claude n'atteigne la base de données.
 *   node --experimental-strip-types scripts/test-validators.mjs
 */
import {
  ValidationError,
  validateExplanation,
  validateFlashcards,
  validateKeyConcepts,
  validateQuiz,
  validateStudyPlan,
  validateSummary,
} from "../supabase/functions/generate-study-material/schemas.ts";

let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) console.log(`  ok   ${label}`);
  else { console.log(`  FAIL ${label} ${detail}`); failures++; }
};
const rejects = (label, fn) => {
  try { fn(); check(label, false, "aucune erreur levée"); }
  catch (error) { check(label, error instanceof ValidationError, `type inattendu : ${error}`); }
};

console.log("— Flashcards —");
const cards = validateFlashcards({
  flashcards: [
    { question: " Q1 ", answer: "R1", explanation: "E1", difficulty: "hard", topic: "Obligations" },
    { question: "Q2", answer: "R2", explanation: "", difficulty: "inconnu", topic: "" },
  ],
}, 10);
check("Les champs sont nettoyés (trim)", cards[0].question === "Q1");
check("Une difficulté inconnue retombe sur « medium »", cards[1].difficulty === "medium");
check("Une explication vide est tolérée", cards[1].explanation === "");
check("Le nombre demandé est respecté",
  validateFlashcards({ flashcards: Array.from({ length: 40 }, () => ({ question: "q", answer: "r", explanation: "", difficulty: "easy", topic: "t" })) }, 5).length === 5);
rejects("Une carte sans réponse est rejetée", () =>
  validateFlashcards({ flashcards: [{ question: "q", answer: "   ", difficulty: "easy", topic: "t" }] }, 5));
rejects("Un tableau vide est rejeté", () => validateFlashcards({ flashcards: [] }, 5));
rejects("Une charge utile non conforme est rejetée", () => validateFlashcards({ cartes: [] }, 5));

console.log("\n— Quiz —");
const quiz = validateQuiz({
  title: "Quiz",
  questions: [
    { question: "Q", question_type: "multiple_choice", choices: ["A", "B", "C", "D"], correct_answer: "B", explanation: "", topic: "T", difficulty: "medium" },
    { question: "V/F", question_type: "true_false", choices: ["x"], correct_answer: "Vrai", explanation: "", topic: "T", difficulty: "easy" },
    { question: "Court", question_type: "short_answer", choices: ["parasite"], correct_answer: "VP = C / r", explanation: "", topic: "T", difficulty: "hard" },
  ],
}, 10);
check("Les choix vrai/faux sont normalisés", JSON.stringify(quiz.questions[1].choices) === '["Vrai","Faux"]');
check("Une réponse courte n'a pas de choix", quiz.questions[2].choices.length === 0);
check("Le titre est conservé", quiz.title === "Quiz");
check("Un titre absent reçoit une valeur par défaut",
  validateQuiz({ questions: [{ question: "Q", question_type: "short_answer", choices: [], correct_answer: "r", explanation: "", topic: "", difficulty: "easy" }] }, 5).title === "Quiz généré");
rejects("Bonne réponse absente des choix → rejet", () =>
  validateQuiz({ title: "T", questions: [{ question: "Q", question_type: "multiple_choice", choices: ["A", "B"], correct_answer: "Z", explanation: "", topic: "", difficulty: "easy" }] }, 5));
rejects("Choix multiple avec un seul choix → rejet", () =>
  validateQuiz({ title: "T", questions: [{ question: "Q", question_type: "multiple_choice", choices: ["A"], correct_answer: "A", explanation: "", topic: "", difficulty: "easy" }] }, 5));
rejects("Vrai/faux avec une réponse invalide → rejet", () =>
  validateQuiz({ title: "T", questions: [{ question: "Q", question_type: "true_false", choices: [], correct_answer: "Peut-être", explanation: "", topic: "", difficulty: "easy" }] }, 5));
rejects("Quiz sans question → rejet", () => validateQuiz({ title: "T", questions: [] }, 5));

console.log("\n— Résumé —");
const summary = validateSummary({
  title: "Résumé ch.3",
  overview: "Synthèse",
  key_concepts: [{ name: "Duration", description: "Sensibilité" }, { name: "", description: "ignoré" }],
  definitions: [{ term: "Coupon", definition: "Intérêt versé" }],
  formulas: [],
  memorize: ["a", "", "b"],
  pitfalls: null,
  likely_exam_questions: ["Q1"],
});
check("Les concepts sans nom sont écartés", summary.key_concepts.length === 1);
check("Les entrées vides des listes sont écartées", summary.memorize.length === 2);
check("Un champ absent devient une liste vide", Array.isArray(summary.pitfalls) && summary.pitfalls.length === 0);
check("Les formules vides sont acceptées", summary.formulas.length === 0);
rejects("Un résumé sans synthèse est rejeté", () => validateSummary({ title: "T" }));

console.log("\n— Notions clés / plan —");
check("Les notions clés sont validées",
  validateKeyConcepts({ title: "N", concepts: [{ name: "A", description: "d", importance: "haute" }] }).concepts[0].importance === "medium");
rejects("Aucune notion exploitable → rejet", () => validateKeyConcepts({ title: "N", concepts: [{ name: "", description: "" }] }));
check("Le plan de révision est validé",
  validateStudyPlan({ title: "P", overview: "o", days: [{ day: 1, focus: "F", activities: ["a"], estimated_minutes: 90 }] }).days.length === 1);
check("Les minutes sont bornées",
  validateStudyPlan({ title: "P", overview: "", days: [{ day: 1, focus: "F", activities: [], estimated_minutes: 99999 }] }).days[0].estimated_minutes === 600);
rejects("Un plan vide est rejeté", () => validateStudyPlan({ title: "P", days: [] }));

console.log("\n— Explication —");
const explanation = validateExplanation({
  answer: "Réponse",
  grounded: false,
  missing_from_material: "La formule de Macaulay",
  follow_up_questions: ["Q1", "Q2", "", "Q3", "Q4", "Q5", "Q6"],
});
check("Le drapeau « hors matériel » est conservé", explanation.grounded === false);
check("Les questions de suivi sont limitées à 5", explanation.follow_up_questions.length <= 5);
check("« grounded » vaut true par défaut", validateExplanation({ answer: "R" }).grounded === true);
rejects("Une explication sans réponse est rejetée", () => validateExplanation({ grounded: true }));

console.log(failures === 0 ? "\n✅ Tous les tests de validation passent." : `\n❌ ${failures} test(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
