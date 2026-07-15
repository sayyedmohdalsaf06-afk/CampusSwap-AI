module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Reanimated v4 (Expo SDK 54): the worklets Babel plugin lives in
      // react-native-worklets and must be listed last.
      "react-native-worklets/plugin",
    ],
  };
};
