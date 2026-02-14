const { detectIntent } = require("./intentDetector");

function routeMessage({ message, context }) {
  return detectIntent(context);
}

module.exports = { routeMessage };
