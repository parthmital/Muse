/**
 * src/password.ts
 *
 * Password hashing on top of Node's crypto (scrypt) — no external dependency,
 * matching the dependency-free approach of src/jwt.ts. Stored format is
 * `salt:derivedKey`, both hex. Verification is constant-time.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(password, salt, KEYLEN, (err, derivedKey) => {
			if (err) reject(err);
			else resolve(derivedKey);
		});
	});
}

/** Hash a plaintext password. Returns `salt:hash` (hex). */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const derived = await scryptAsync(password, salt);
	return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Verify a plaintext password against a stored `salt:hash` value. */
export async function verifyPassword(
	password: string,
	stored: string | null | undefined,
): Promise<boolean> {
	if (!stored) return false;
	const [saltHex, hashHex] = stored.split(":");
	if (!saltHex || !hashHex) return false;
	const salt = Buffer.from(saltHex, "hex");
	const expected = Buffer.from(hashHex, "hex");
	const derived = await scryptAsync(password, salt);
	if (derived.length !== expected.length) return false;
	return timingSafeEqual(derived, expected);
}
