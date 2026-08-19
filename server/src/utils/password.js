const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

function isHashed(password) {
	return typeof password === 'string' && BCRYPT_HASH_RE.test(password);
}

function hashPassword(plain) {
	return bcrypt.hash(plain, SALT_ROUNDS);
}

// So sánh mật khẩu nhập vào với giá trị lưu trong DB.
// Vẫn nhận diện mật khẩu plaintext cũ (chưa migrate) để không khoá tài khoản
// trước khi chạy scripts/hashExistingPasswords.js.
function comparePassword(plain, stored) {
	if (isHashed(stored)) return bcrypt.compare(plain, stored);
	return Promise.resolve(plain === stored);
}

module.exports = { SALT_ROUNDS, isHashed, hashPassword, comparePassword };
