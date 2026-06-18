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
