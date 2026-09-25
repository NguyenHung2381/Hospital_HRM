const otplib = require('otplib');
const QRCode = require('qrcode');

const TOTP_ISSUER = 'HRM Hospital';
const CODE_RE = /^\d{6}$/;

// Xác minh mã TOTP 6 số. epochTolerance=1 cho phép lệch đồng hồ ±1 bước (±30s)
// giữa app xác thực và server. afterTimeStep chặn dùng lại mã đã dùng (replay):
// mỗi mã chỉ dùng được đúng 1 lần kể cả khi còn trong khung 30s.
// Trả về timeStep của mã hợp lệ (để lưu làm totp_last_step), hoặc null.
async function verifyTotpCode(secret, code, lastStep) {
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
async function createTotpSetup(username) {
	const secret = await otplib.generateSecret();
	const otpauth_uri = otplib.generateURI({
		issuer: TOTP_ISSUER,
		label: username,
		secret,
		type: 'totp',
	});
	const qr_data_url = await QRCode.toDataURL(otpauth_uri, { margin: 1, width: 220 });
	return { secret, otpauth_uri, qr_data_url };
}

module.exports = { verifyTotpCode, createTotpSetup };
