// name_abbreviation_test.mjs — tests for abbreviatePlayerName
// Runs in Node.js, no React needed. Logic mirrors utils/playerUtils.ts exactly.

function abbreviatePlayerName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) {
    return fullName;
  }
  const [first, ...rest] = parts;
  return `${first.charAt(0)}. ${rest.join(' ')}`;
}

let passed = 0;
let failed = 0;

function assertEq(actual, expected, label) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — got "${actual}", expected "${expected}"`);
    failed++;
  }
}

console.log('\nSECTION 1 — Basic two-part names');
assertEq(abbreviatePlayerName('Matthew Selt'), 'M. Selt', '"Matthew Selt" -> "M. Selt"');
assertEq(abbreviatePlayerName('Long Zehuang'), 'L. Zehuang', '"Long Zehuang" -> "L. Zehuang"');
assertEq(abbreviatePlayerName('Ronnie O\'Sullivan'), 'R. O\'Sullivan', 'apostrophe surname preserved');
assertEq(abbreviatePlayerName('Judd Trump'), 'J. Trump', '"Judd Trump" -> "J. Trump"');

console.log('\nSECTION 2 — Multi-word surnames (3+ parts)');
assertEq(abbreviatePlayerName('John van der Berg'), 'J. van der Berg', 'multi-word surname joined unchanged');
assertEq(abbreviatePlayerName('Mark Allen Jr'), 'M. Allen Jr', 'trailing suffix kept as part of surname');

console.log('\nSECTION 3 — Single-word / unabbreviatable names');
assertEq(abbreviatePlayerName('TBD'), 'TBD', 'single-word "TBD" returned unchanged');
assertEq(abbreviatePlayerName('Ronnie'), 'Ronnie', 'single first name returned unchanged');
assertEq(abbreviatePlayerName(''), '', 'empty string returned unchanged');

console.log('\nSECTION 4 — Whitespace handling');
assertEq(abbreviatePlayerName('  Matthew   Selt  '), 'M. Selt', 'extra/leading/trailing whitespace normalized');
assertEq(abbreviatePlayerName('   '), '   ', 'whitespace-only string returned unchanged (no parts after trim)');

console.log('\nSECTION 5 — Case preservation');
assertEq(abbreviatePlayerName('matthew selt'), 'm. selt', 'lowercase input preserves case of the initial');
assertEq(abbreviatePlayerName('MATTHEW SELT'), 'M. SELT', 'uppercase input preserves case');

console.log('\n' + '═'.repeat(60));
if (failed === 0) {
  console.log(`✅  All ${passed} assertions passed`);
} else {
  console.log(`❌  ${failed} failed / ${passed} passed`);
  process.exit(1);
}
