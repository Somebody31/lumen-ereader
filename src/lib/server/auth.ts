import type { Context } from 'hono';
import type { AppEnv } from './types';

const COOKIE = 'lumen_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function hmacSign(secret: string, payload: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
	return bufferToBase64Url(sig);
}

async function hmacVerify(secret: string, payload: string, signature: string): Promise<boolean> {
	const expected = await hmacSign(secret, payload);
	return timingSafeEqual(expected, signature);
}

function bufferToBase64Url(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let out = 0;
	for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return out === 0;
}

function parseCookie(header: string | undefined, name: string): string | null {
	if (!header) return null;
	const parts = header.split(';');
	for (const p of parts) {
		const [k, ...rest] = p.trim().split('=');
		if (k === name) return rest.join('=');
	}
	return null;
}

export function syncConfigured(env: AppEnv['Bindings']): boolean {
	return Boolean(env.SESSION_SECRET && env.READER_PASSPHRASE && env.BOOKS && env.META);
}

export async function createSessionToken(secret: string): Promise<string> {
	const exp = Date.now() + MAX_AGE * 1000;
	const payload = `v1.${exp}`;
	const sig = await hmacSign(secret, payload);
	return `${payload}.${sig}`;
}

export async function verifySessionToken(secret: string, token: string): Promise<boolean> {
	const lastDot = token.lastIndexOf('.');
	if (lastDot < 0) return false;
	const payload = token.slice(0, lastDot);
	const sig = token.slice(lastDot + 1);
	const [v, expStr] = payload.split('.');
	if (v !== 'v1') return false;
	const exp = Number(expStr);
	if (!Number.isFinite(exp) || Date.now() > exp) return false;
	return hmacVerify(secret, payload, sig);
}

export async function isAuthenticated(c: Context<AppEnv>): Promise<boolean> {
	const secret = c.env.SESSION_SECRET;
	if (!secret) return false;
	const token = parseCookie(c.req.header('Cookie'), COOKIE);
	if (!token) return false;
	return verifySessionToken(secret, token);
}

export function setSessionCookie(token: string): string {
	return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie(): string {
	return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function checkPassphrase(env: AppEnv['Bindings'], passphrase: string): Promise<boolean> {
	const expected = env.READER_PASSPHRASE;
	if (!expected) return false;
	return timingSafeEqual(passphrase, expected);
}
