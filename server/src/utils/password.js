const crypto = require('crypto');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;
const BCRYPT_HASH_RE = /^\$2[aby]\$(\d{2})\$/;

// Chính sách mật khẩu tối thiểu. bcrypt chỉ dùng 72 byte đầu → giới hạn độ
// dài tối đa để không có 2 mật khẩu khác nhau cho cùng 1 hash.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

function isHashed(password) {
	return typeof password === 'string' && BCRYPT_HASH_RE.test(password);
}

// Hash cũ (plaintext hoặc cost thấp hơn hiện tại) → nên hash lại khi user
// đăng nhập thành công.
function needsRehash(stored) {
	const m = typeof stored === 'string' && stored.match(BCRYPT_HASH_RE);
	return !m || Number(m[1]) < SALT_ROUNDS;
}

function hashPassword(plain) {
	return bcrypt.hash(plain, SALT_ROUNDS);
}

// Hash giả để vẫn tốn thời gian bcrypt khi username không tồn tại — tránh
// đoán username hợp lệ qua thời gian phản hồi.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), SALT_ROUNDS);

// So sánh mật khẩu nhập vào với giá trị lưu trong DB.
// Vẫn nhận diện mật khẩu plaintext cũ (chưa migrate) để không khoá tài khoản;
// login sẽ tự hash lại ngay khi đăng nhập thành công.
function comparePassword(plain, stored) {
	if (typeof plain !== 'string') return Promise.resolve(false);
	if (stored == null) return bcrypt.compare(plain, DUMMY_HASH).then(() => false);
	if (isHashed(stored)) return bcrypt.compare(plain, stored);
	const a = Buffer.from(plain);
	const b = Buffer.from(String(stored));
	return Promise.resolve(a.length === b.length && crypto.timingSafeEqual(a, b));
}

// Trả về thông báo lỗi nếu mật khẩu không đạt chính sách, ngược lại null.
function validatePasswordPolicy(password, { username } = {}) {
	if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH)
		return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
	if (Buffer.byteLength(password) > PASSWORD_MAX_BYTES)
		return `Mật khẩu quá dài (tối đa ${PASSWORD_MAX_BYTES} byte)`;
	if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
		return 'Mật khẩu phải gồm cả chữ và số';
	if (username && password.toLowerCase() === String(username).toLowerCase())
		return 'Mật khẩu không được trùng tên đăng nhập';
	return null;
}

// Mật khẩu tạm ngẫu nhiên (dùng khi quản trị đặt lại mật khẩu), luôn thoả
// chính sách: 12 ký tự, có chữ và số, bỏ các ký tự dễ nhầm (0/O, 1/l/I).
function generateTempPassword(length = 12) {
	const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
	const digits = '23456789';
	const all = letters + digits;
	const chars = [
		letters[crypto.randomInt(letters.length)],
		digits[crypto.randomInt(digits.length)],
	];
	while (chars.length < length) chars.push(all[crypto.randomInt(all.length)]);
	for (let i = chars.length - 1; i > 0; i--) {
		const j = crypto.randomInt(i + 1);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}
	return chars.join('');
}

module.exports = {
	SALT_ROUNDS,
	PASSWORD_MIN_LENGTH,
	isHashed,
	needsRehash,
	hashPassword,
	comparePassword,
	validatePasswordPolicy,
	generateTempPassword,
};
