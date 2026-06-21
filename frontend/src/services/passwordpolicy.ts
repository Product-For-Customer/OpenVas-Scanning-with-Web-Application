import { baseApi } from "./api";

export type PasswordPolicy = {
  min_length: number;
  require_uppercase: boolean;
  require_number: boolean;
  require_special: boolean;
  expiry_days: number;
};

export const GetPasswordPolicy = async (): Promise<PasswordPolicy> => {
  const r = await baseApi.get("/password-policy");
  return r.data as PasswordPolicy;
};

export const UpdatePasswordPolicy = async (payload: Partial<PasswordPolicy>): Promise<PasswordPolicy> => {
  const r = await baseApi.patch("/password-policy", payload);
  return (r.data?.data ?? r.data) as PasswordPolicy;
};

export const validatePasswordAgainstPolicy = (
  value: string,
  policy: PasswordPolicy | null
): string => {
  if (!value) return "";
  const minLen = policy?.min_length ?? 8;
  if (value.length < minLen)
    return `Password must be at least ${minLen} characters`;
  if ((policy?.require_uppercase ?? false) && !/[A-Z]/.test(value))
    return "Must contain at least 1 uppercase letter";
  if ((policy?.require_number ?? false) && !/[0-9]/.test(value))
    return "Must contain at least 1 number";
  if ((policy?.require_special ?? false) && !/[^A-Za-z0-9]/.test(value))
    return "Must contain at least 1 special character";
  return "";
};
