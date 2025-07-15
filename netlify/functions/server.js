const serverless = require("serverless-http");
// This imports the compiled, production-ready app from the dist directory.
const { app } = require("../../dist/index");

// Export the handler for Netlify to use.
exports.handler = serverless(app);
