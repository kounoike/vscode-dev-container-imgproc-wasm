
var createWasmModule = (function() {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  return (
function(createWasmModule) {
  createWasmModule = createWasmModule || {};



  return createWasmModule.ready
}
);
})();
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = createWasmModule;
else if (typeof define === 'function' && define['amd'])
  define([], function() { return createWasmModule; });
else if (typeof exports === 'object')
  exports["createWasmModule"] = createWasmModule;