// Common weak passwords blacklist
var COMMON_WEAK_PASSWORDS = new Set([
  "1234567890", "password123", "Password123", "qwerty12345",
  "admin123456", "123456789a", "1111111111", "0000000000",
  "abc1234567", "a123456789", "password1!", "Password1!",
  "Iloveyou123", "iloveyou123",
]);

var SEQUENTIAL_PATTERNS = [
  "1234567890", "0987654321", "qwertyuiop", "asdfghjkl;",
  "abcdefghij", "ABCDEFGHIJ",
];

function isWeakPassword(password) {
  if (COMMON_WEAK_PASSWORDS.has(password)) {
    return { weak: true, reason: "此密码过于常见" };
  }
  for (var i = 0; i < SEQUENTIAL_PATTERNS.length; i++) {
    if (password.includes(SEQUENTIAL_PATTERNS[i])) {
      return { weak: true, reason: "密码包含连续字符序列" };
    }
  }
  return { weak: false };
}

module.exports = { isWeakPassword };
