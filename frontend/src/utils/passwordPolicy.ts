// Password complexity: the "8/4 rule" (at least 8 characters, covering all 4
// character classes) as a fast, cheap first check, plus zxcvbn-ts to catch
// passwords that satisfy that rule but are still guessable — "Passw0rd1!"
// technically has upper/lower/digit/symbol, but it's a dictionary word with
// trivial substitutions, so zxcvbn scores it very low.
//
// zxcvbn's dictionaries are sizeable, so they're dynamically imported and
// only loaded the first time a password actually needs checking.

import type { ZxcvbnFactory as ZxcvbnFactoryType } from "@zxcvbn-ts/core";

export const PASSWORD_RULE_TEXT =
  "At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character.";

// zxcvbn score is 0 (worst) to 4 (best). Only 3/4 ("safely unguessable" /
// "very unguessable") pass — anything below 3 is rejected.
const MIN_ZXCVBN_SCORE = 3;

function ruleIssues(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push("at least 8 characters");
  if (!/[a-z]/.test(pw)) issues.push("a lowercase letter");
  if (!/[A-Z]/.test(pw)) issues.push("an uppercase letter");
  if (!/[0-9]/.test(pw)) issues.push("a number");
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push("a special character");
  return issues;
}

let checkerReady: Promise<InstanceType<typeof ZxcvbnFactoryType>> | null = null;

function loadChecker() {
  if (!checkerReady) {
    checkerReady = (async () => {
      const [core, common, en] = await Promise.all([
        import("@zxcvbn-ts/core"),
        import("@zxcvbn-ts/language-common"),
        import("@zxcvbn-ts/language-en"),
      ]);
      return new core.ZxcvbnFactory({
        dictionary: {
          ...common.dictionary,
          ...en.dictionary,
        },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
      });
    })();
  }
  return checkerReady;
}

/** null if the password is acceptable, otherwise a message explaining why not. */
export async function passwordError(pw: string): Promise<string | null> {
  const issues = ruleIssues(pw);
  if (issues.length > 0) {
    return `Password needs ${issues.join(", ")}.`;
  }

  const checker = await loadChecker();
  const result = checker.check(pw);
  if (result.score < MIN_ZXCVBN_SCORE) {
    return "Your password is too weak";
  }

  return null;
}
