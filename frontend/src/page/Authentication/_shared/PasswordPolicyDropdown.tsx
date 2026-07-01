import React from "react";
import { FiCheck } from "react-icons/fi";
import type { PasswordPolicy } from "../../../services/passwordpolicy";
import { useLanguage } from "../../../contexts/LanguageContext";
import type { TranslationKey } from "../../../locales";

type Rule = { key: TranslationKey; vars?: Record<string, string | number>; met: boolean };

type Props = {
  policy: PasswordPolicy | null;
  password: string;
  open: boolean;
};

const buildRules = (policy: PasswordPolicy | null, password: string): Rule[] => {
  if (!policy) return [];
  const minLen = policy.min_length ?? 8;

  const rules: Rule[] = [
    { key: "auth.ruleMinChars", vars: { min: minLen }, met: password.length >= minLen },
  ];

  if (policy.require_uppercase) {
    rules.push({ key: "auth.ruleUppercase", met: /[A-Z]/.test(password) });
  }
  if (policy.require_number) {
    rules.push({ key: "auth.ruleNumber", met: /[0-9]/.test(password) });
  }
  if (policy.require_special) {
    rules.push({ key: "auth.ruleSpecial", met: /[^A-Za-z0-9]/.test(password) });
  }

  return rules;
};

/**
 * Live password-requirements dropdown, shown while the password field is
 * focused. Rules reflect the admin-configured Password Policy — only rules
 * the admin has enabled are listed, each checked live against the current
 * input value.
 */
const PasswordPolicyDropdown: React.FC<Props> = ({ policy, password, open }) => {
  const { t } = useLanguage();

  if (!open || !policy) return null;

  const rules = buildRules(policy, password);
  const allMet = rules.length > 0 && rules.every(r => r.met);

  return (
    <div
      className="absolute left-0 right-0 top-full z-20 mt-1.5 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-[#1a1830]"
      // Prevent the password input's onBlur from firing before a click
      // inside this dropdown would register (not currently interactive,
      // but keeps behaviour predictable if it becomes so later).
      onMouseDown={e => e.preventDefault()}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30">
        {t("auth.passwordRequirements")}
      </p>
      <ul className="space-y-1.5">
        {rules.map(rule => (
          <li key={rule.key} className="flex items-center gap-2 text-xs">
            <span
              className={[
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                rule.met
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-gray-300 text-transparent dark:border-white/20",
              ].join(" ")}
            >
              <FiCheck size={10} />
            </span>
            <span className={rule.met ? "text-gray-700 dark:text-white/80" : "text-gray-400 dark:text-white/40"}>
              {t(rule.key, rule.vars)}
            </span>
          </li>
        ))}
      </ul>
      {allMet && (
        <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {t("auth.passwordAllRequirementsMet")}
        </p>
      )}
    </div>
  );
};

export default PasswordPolicyDropdown;
