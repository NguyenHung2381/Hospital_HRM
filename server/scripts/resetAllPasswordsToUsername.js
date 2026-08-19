/* ==============================================================
   scripts/resetAllPasswordsToUsername.js

   Script duy nhất cần chạy để đảm bảo mật khẩu trong bảng Users
   ở trạng thái an toàn: đặt mật khẩu của TOÀN BỘ tài khoản về
   đúng bằng username của tài khoản đó, dưới dạng bcrypt hash.

   Vì mỗi mật khẩu đều được ghi đè bằng bcrypt(username) bất kể
   giá trị cũ là gì (plaintext hay đã hash), script này tự nó đã
   bao gồm luôn phần "migrate plaintext → bcrypt" — không cần chạy
   riêng scripts/hashExistingPasswords.js (đã gộp vào đây và xoá) nữa.

   CẢNH BÁO: ghi đè mật khẩu của mọi tài khoản, kể cả admin đang
   dùng. Sau khi chạy, mỗi người đăng nhập bằng chính username của
   họ làm mật khẩu, và nên đổi lại ngay.

   Cách chạy (từ thư mục server/):
     node scripts/resetAllPasswordsToUsername.js
   hoặc:
     npm run reset-passwords-to-username
   ============================================================== */

const { getPool, sql } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

async function main() {
	const pool = await getPool();
	const result = await pool.request().query('SELECT id_user, username FROM Users');
	const rows = result.recordset;

	for (const row of rows) {
		const hashed = await hashPassword(row.username);
		await pool
			.request()
			.input('id', sql.Int, row.id_user)
			.input('password', sql.NVarChar(255), hashed)
			.query(
				'UPDATE Users SET password = @password, updated_at = SYSDATETIMEOFFSET() WHERE id_user = @id',
			);
		console.log(`  ✔ Đã đặt mật khẩu = username cho tài khoản "${row.username}"`);
	}

	console.log(`\nHoàn tất: đã đặt lại mật khẩu cho ${rows.length} tài khoản.`);
	await sql.close();
}

main().catch((err) => {
	console.error('Lỗi khi đặt lại mật khẩu:', err);
	process.exit(1);
});
