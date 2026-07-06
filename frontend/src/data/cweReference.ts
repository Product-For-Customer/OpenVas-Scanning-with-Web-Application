// Static, offline reference data for the two classification schemes ZAP
// alerts carry (CWE, WASC). These are well-established public identifiers
// maintained by MITRE (CWE) and the (now-archived) Web Application Security
// Consortium (WASC) — kept as a local, curated subset covering the
// weaknesses ZAP's default ruleset actually reports, rather than calling a
// live external API for data that never changes at runtime.
//
// Unknown IDs still get a working link (cwe.mitre.org / WASC project page)
// even without a name in these tables — see FindingDetail's usage.

export const CWE_NAMES: Record<string, string> = {
  "16": "Configuration",
  "20": "Improper Input Validation",
  "22": "Path Traversal",
  "23": "Relative Path Traversal",
  "36": "Absolute Path Traversal",
  "77": "Command Injection",
  "78": "OS Command Injection",
  "79": "Cross-Site Scripting (XSS)",
  "89": "SQL Injection",
  "90": "LDAP Injection",
  "91": "XML Injection",
  "93": "CRLF Injection",
  "94": "Code Injection",
  "95": "Eval Injection",
  "96": "Static Code Injection",
  "113": "HTTP Response Splitting",
  "116": "Improper Encoding or Escaping of Output",
  "183": "Permissive List of Allowed Inputs",
  "200": "Exposure of Sensitive Information to an Unauthorized Actor",
  "209": "Generation of Error Message Containing Sensitive Information",
  "255": "Credentials Management Errors",
  "259": "Use of Hard-coded Password",
  "284": "Improper Access Control",
  "285": "Improper Authorization",
  "287": "Improper Authentication",
  "295": "Improper Certificate Validation",
  "296": "Improper Following of a Certificate's Chain of Trust",
  "306": "Missing Authentication for Critical Function",
  "311": "Missing Encryption of Sensitive Data",
  "319": "Cleartext Transmission of Sensitive Information",
  "326": "Inadequate Encryption Strength",
  "327": "Use of a Broken or Risky Cryptographic Algorithm",
  "330": "Use of Insufficiently Random Values",
  "338": "Use of Cryptographically Weak Pseudo-Random Number Generator",
  "346": "Origin Validation Error",
  "352": "Cross-Site Request Forgery (CSRF)",
  "384": "Session Fixation",
  "400": "Uncontrolled Resource Consumption",
  "434": "Unrestricted Upload of File with Dangerous Type",
  "470": "Unsafe Reflection",
  "494": "Download of Code Without Integrity Check",
  "502": "Deserialization of Untrusted Data",
  "523": "Unprotected Transport of Credentials",
  "532": "Insertion of Sensitive Information into Log File",
  "548": "Exposure of Information Through Directory Listing",
  "601": "URL Redirection to Untrusted Site (Open Redirect)",
  "611": "Improper Restriction of XML External Entity Reference (XXE)",
  "613": "Insufficient Session Expiration",
  "614": "Sensitive Cookie Without 'Secure' Attribute",
  "639": "Authorization Bypass Through User-Controlled Key (IDOR)",
  "693": "Protection Mechanism Failure",
  "732": "Incorrect Permission Assignment for Critical Resource",
  "770": "Allocation of Resources Without Limits or Throttling",
  "776": "XML Entity Expansion (Billion Laughs)",
  "798": "Use of Hard-coded Credentials",
  "829": "Inclusion of Functionality from Untrusted Control Sphere",
  "862": "Missing Authorization",
  "863": "Incorrect Authorization",
  "918": "Server-Side Request Forgery (SSRF)",
  "942": "Permissive Cross-domain Policy with Untrusted Domains",
  "1004": "Sensitive Cookie Without 'HttpOnly' Flag",
  "1021": "Improper Restriction of Rendered UI Layers (Clickjacking)",
};

export const WASC_NAMES: Record<string, string> = {
  "1": "Insufficient Authentication",
  "2": "Insufficient Authorization",
  "3": "Integer Overflows",
  "4": "Insufficient Transport Layer Protection",
  "5": "Remote File Inclusion",
  "6": "Format String",
  "7": "Buffer Overflow",
  "8": "Cross-Site Scripting",
  "9": "Cross-Site Request Forgery",
  "10": "Denial of Service",
  "11": "Brute Force",
  "12": "Content Spoofing",
  "13": "Information Leakage",
  "14": "Insufficient Anti-automation",
  "15": "Insufficient Process Validation",
  "16": "Directory Indexing",
  "17": "Improper Filesystem Permissions",
  "18": "Credential/Session Prediction",
  "19": "SQL Injection",
  "20": "Improper Input Handling",
  "22": "Improper Output Handling",
  "23": "XML Injection",
  "24": "HTTP Request Splitting",
  "25": "HTTP Response Splitting",
  "31": "OS Commanding",
  "33": "Path Traversal",
  "34": "Predictable Resource Location",
  "38": "URL Redirector Abuse",
  "39": "XML External Entities",
};

export const cweUrl = (id: string): string =>
  `https://cwe.mitre.org/data/definitions/${encodeURIComponent(id)}.html`;

// WASC's own site (webappsec.org) is defunct; OWASP's mirror of the Threat
// Classification is the closest living reference for a specific ID list.
export const wascUrl = (): string =>
  "https://owasp.org/www-community/attacks/";

export const cweName = (id: string): string | null => CWE_NAMES[id.trim()] ?? null;
export const wascName = (id: string): string | null => WASC_NAMES[id.trim()] ?? null;
