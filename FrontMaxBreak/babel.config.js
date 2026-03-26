module.exports = function (api) {
    api.cache(true);
    return {
      presets: [
        ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      ],
      plugins: [
        // Use css-interop babel plugin directly to avoid pulling in
        // react-native-worklets/plugin (reanimated 4 only) from nativewind/babel preset
        require("react-native-css-interop/dist/babel-plugin").default,
      ],
    };
  };