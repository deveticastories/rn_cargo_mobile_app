const { withProjectBuildGradle } = require('expo/config-plugins');

// Notifee ships its core .aar as a local maven repo inside node_modules.
// Anchor the path to $rootDir so it resolves the same from every subproject.
const NOTIFEE_REPO = 'maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }';

module.exports = function withNotifeeMaven(config) {
  return withProjectBuildGradle(config, (config) => {
    const { contents } = config.modResults;
    if (!contents.includes('@notifee/react-native/android/libs')) {
      config.modResults.contents = contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        (match) => `${match}\n    ${NOTIFEE_REPO}`
      );
    }
    return config;
  });
};
