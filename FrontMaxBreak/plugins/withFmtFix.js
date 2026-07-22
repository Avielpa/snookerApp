const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// React Native 0.79 bundles fmt 11.0.2 (via RCT-Folly). Xcode 26.4+ ships a
// stricter Apple Clang that enforces C++20 consteval rules fmt's
// FMT_USE_CONSTEVAL detection doesn't account for, causing
// "call to consteval function ... is not a constant expression" errors in
// format-inl.h. See https://github.com/fmtlib/fmt/issues/4740.
//
// A compiler flag (-DFMT_CONSTEVAL=...) does NOT work here: fmt/include/fmt/base.h
// unconditionally redefines FMT_USE_CONSTEVAL/FMT_CONSTEVAL via its own #if/#elif
// chain, silently overwriting any externally-provided -D value. The chain also
// falls through to an `FMT_CLANG_VERSION >= 1101` branch that re-enables consteval
// even if the __cpp_consteval branch above it is skipped, since Apple Clang 21
// reports a clang version far above that threshold.
//
// The only fix that actually works is patching the generated
// Pods/fmt/include/fmt/base.h in a Podfile post_install hook (after `pod install`
// writes it, before Xcode compiles) to unconditionally disable consteval for all
// Apple Clang builds, not just old/broken ones. This only turns off a
// compile-time-only diagnostic feature in fmt — it does not change runtime
// formatting behaviour.
const withFmtFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      const fmtFix = `  # Fix fmt consteval incompatibility with Xcode 26.4+ / Apple Clang 21 (fmtlib/fmt#4740)
  fmt_base_h = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
  if File.exist?(fmt_base_h)
    content = File.read(fmt_base_h)
    patched = content.sub(
      /#elif defined\\(__apple_build_version__\\) && __apple_build_version__ < 14000029L/,
      '#elif defined(__apple_build_version__)'
    )
    File.write(fmt_base_h, patched) if patched != content
  end`;
      if (podfile.includes('post_install do |installer|')) {
        podfile = podfile.replace(
          'post_install do |installer|',
          `post_install do |installer|\n${fmtFix}`
        );
      } else {
        podfile += `\npost_install do |installer|\n${fmtFix}\nend\n`;
      }
      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};

module.exports = withFmtFix;
