const PROVIDER_TOKENS: readonly RegExp[] = [
	/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
	/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,255}/,
	/\bgithub_pat_[A-Za-z0-9_]{20,255}/,
	/\bnpm_[A-Za-z0-9]{30,255}/,
	/\bsk-[A-Za-z0-9]{20,255}/,
	/\bBearer\s+[A-Za-z0-9._-]{20,}/i,
	/-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY-----/,
];

export function containsSecret(text: string): boolean {
	if (!text) return false;
	return PROVIDER_TOKENS.some(pattern => pattern.test(text));
}

export function scanStrings(values: string[]): boolean {
	return values.some(containsSecret);
}
