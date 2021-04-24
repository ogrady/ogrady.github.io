const path = require('path');

module.exports = {
  mode: "production",
  entry: ["./unicodemathml/mathjax.js", "./unicodemathml/unicodemathml.js", "./unicodemathml/unicodemathml-parser.js", "./unicodemathml/unicodemathml-integration.js"],
  output: {
    filename: "unicodemathml.js",
    path: path.resolve(__dirname, "../assets/js/"),
  },
  /*optimization: {
        minimize: false
  }*/
};
