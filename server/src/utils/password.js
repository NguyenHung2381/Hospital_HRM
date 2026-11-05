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

// Mật khẩu "đạt luật" (≥ 8 ký tự, có chữ + số) nhưng nằm đầu mọi danh sách
// dò mật khẩu, hoặc gắn với tên bệnh viện/hệ thống → chặn. So sánh viết thường.
const COMMON_PASSWORDS = new Set([
	'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd1',
	'12345678a', '123456789a', 'a12345678', 'a123456789', 'abc12345', 'abc123456',
	'abcd1234', '1234abcd', 'qwerty123', 'qwerty12', 'qwe12345', '1qaz2wsx',
	'aa123456', '123456aa', 'iloveyou1', 'admin123', 'admin1234', 'admin12345',
	'test1234', 'user1234', 'welcome1', 'changeme1', 'matkhau1', 'matkhau123',
	'matkhau12', 'benhvien1', 'benhvien123', 'hospital1', 'hospital123', 'hrm12345',
	'bvhndk123', 'nghean123', 'dieuduong1', 'dieuduong123',
]);

// Trả về thông báo lỗi nếu mật khẩu không đạt chính sách, ngược lại null.
function validatePasswordPolicy(password, { username } = {}) {
	if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH)
		return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
	if (Buffer.byteLength(password) > PASSWORD_MAX_BYTES)
		return `Mật khẩu quá dài (tối đa ${PASSWORD_MAX_BYTES} byte)`;
	if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
		return 'Mật khẩu phải gồm cả chữ và số';
	const lower = password.toLowerCase();
	const name = String(username || '').toLowerCase();
	// Tên đăng nhập ≥ 3 ký tự nằm trong mật khẩu (vd "nguyenvana123") → dễ đoán
	if (name && (lower === name || (name.length >= 3 && lower.includes(name))))
		return 'Mật khẩu không được chứa tên đăng nhập';
	if (COMMON_PASSWORDS.has(lower))
		return 'Mật khẩu quá phổ biến, dễ bị dò ra. Hãy chọn mật khẩu khác';
	// 1 ký tự lặp ≥ 4 lần liên tiếp (vd "aaaa1111")
	if (/(.)\1{3,}/.test(password))
		return 'Mật khẩu không được có 1 ký tự lặp lại 4 lần liên tiếp';
	return null;
}

// Mật khẩu do quản trị đặt (tạo tài khoản / đặt lại) chỉ dùng được trong
// TEMP_PASSWORD_TTL_HOURS kể từ lúc đặt; quá hạn mà chưa đổi thì không đăng
// nhập được nữa, phải nhờ quản trị cấp lại. 0 = không giới hạn.
const TEMP_PASSWORD_TTL_HOURS = (() => {
	const n = Number(process.env.TEMP_PASSWORD_TTL_HOURS ?? 72);
	return Number.isFinite(n) && n >= 0 ? n : 72;
})();

function isTempPasswordExpired(user, now = Date.now()) {
	if (!user?.must_change_password || !TEMP_PASSWORD_TTL_HOURS || !user.password_changed_at)
		return false;
	return now - new Date(user.password_changed_at).getTime() > TEMP_PASSWORD_TTL_HOURS * 3600 * 1000;
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
	const result = chars.join('');
	// Rất hiếm khi trúng luật "ký tự lặp" → sinh lại
	return validatePasswordPolicy(result) ? generateTempPassword(length) : result;
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
	TEMP_PASSWORD_TTL_HOURS,
	isTempPasswordExpired,
};
