const crypto = require('crypto');
const otplib = require('otplib');
const QRCode = require('qrcode');

const TOTP_ISSUER = 'HRM Hospital';
const CODE_RE = /^\d{6}$/;

// ── Mã hoá secret TOTP khi lưu DB (AES-256-GCM) ─────────────────
// Trước đây totp_secret lưu dạng rõ → ai đọc được DB / bản backup là sinh
// được mã 2FA của mọi người. Khoá lấy từ TOTP_ENCRYPTION_KEY; chưa đặt thì
// suy ra từ JWT_SECRET (HKDF) — khi đó ĐỔI JWT_SECRET sẽ làm mọi 2FA đang bật
// không xác minh được nữa (quản trị phải "Tắt 2FA" cho từng người), nên nên
// đặt riêng TOTP_ENCRYPTION_KEY. Secret cũ dạng rõ vẫn đọc được và được mã hoá
// lại ở lần đăng nhập 2FA thành công kế tiếp.
const SEALED_PREFIX = 'enc:v1:';

const ENCRYPTION_KEY = (() => {
	const configured = process.env.TOTP_ENCRYPTION_KEY;
	if (configured) {
		if (configured.length < 32)
			throw new Error('TOTP_ENCRYPTION_KEY quá ngắn (< 32 ký tự).');
		return crypto.createHash('sha256').update(configured).digest();
	}
	return Buffer.from(
		crypto.hkdfSync('sha256', process.env.JWT_SECRET || '', 'hrm-totp', 'totp-secret-v1', 32),
	);
})();

function isSealed(stored) {
	return typeof stored === 'string' && stored.startsWith(SEALED_PREFIX);
}

function sealTotpSecret(plain) {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
	const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${SEALED_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ct.toString('base64url')}`;
}

// Trả về secret dạng rõ, hoặc null nếu không giải mã được (sai khoá / hỏng).
function openTotpSecret(stored) {
	if (!stored) return null;
	if (!isSealed(stored)) return stored; // dữ liệu cũ chưa mã hoá
	try {
		const [iv, tag, ct] = stored.slice(SEALED_PREFIX.length).split('.');
		const decipher = crypto.createDecipheriv(
			'aes-256-gcm',
			ENCRYPTION_KEY,
			Buffer.from(iv, 'base64url'),
		);
		decipher.setAuthTag(Buffer.from(tag, 'base64url'));
		return Buffer.concat([
			decipher.update(Buffer.from(ct, 'base64url')),
			decipher.final(),
		]).toString('utf8');
	} catch {
		console.error('[2fa] Không giải mã được totp_secret (sai TOTP_ENCRYPTION_KEY / JWT_SECRET?)');
		return null;
	}
}

// Xác minh mã TOTP 6 số. storedSecret là giá trị cột totp_secret (đã mã hoá
// hoặc dạng rõ cũ). epochTolerance=1 cho phép lệch đồng hồ ±1 bước (±30s)
// giữa app xác thực và server. afterTimeStep chặn dùng lại mã đã dùng (replay):
// mỗi mã chỉ dùng được đúng 1 lần kể cả khi còn trong khung 30s.
// Trả về timeStep của mã hợp lệ (để lưu làm totp_last_step), hoặc null.
async function verifyTotpCode(storedSecret, code, lastStep) {
	const secret = openTotpSecret(storedSecret);
	if (!secret || typeof code !== 'string' || !CODE_RE.test(code)) return null;
	try {
		const result = await otplib.verify({
			secret,
			token: code,
			type: 'totp',
			epochTolerance: 1,
			...(lastStep != null ? { afterTimeStep: Number(lastStep) } : {}),
		});
		return result.valid ? result.timeStep : null;
	} catch {
		return null;
	}
}

// Sinh secret mới + otpauth URI + ảnh QR (data URL) để client hiển thị cho
// người dùng quét bằng Google Authenticator / Microsoft Authenticator / Authy.
// sealed_secret là giá trị để lưu DB (không trả về client).
async function createTotpSetup(username) {
	const secret = await otplib.generateSecret();
	const otpauth_uri = otplib.generateURI({
		issuer: TOTP_ISSUER,
		label: username,
		secret,
		type: 'totp',
	});
	const qr_data_url = await QRCode.toDataURL(otpauth_uri, { margin: 1, width: 220 });
	return { secret, otpauth_uri, qr_data_url, sealed_secret: sealTotpSecret(secret) };
}

module.exports = { verifyTotpCode, createTotpSetup, sealTotpSecret, openTotpSecret, isSealed };
