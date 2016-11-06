import { ModuleNamespace } from 'es-module-loader/core/loader-polyfill.js';
import RegisterLoader from 'es-module-loader/core/register-loader.js';
import { warn, nodeRequire, scriptSrc, isBrowser, global, createSymbol, baseURI } from './common.js';

import { getConfig, getConfigItem, setConfig } from './config.js';
import { decanonicalize, normalize, normalizeSync } from './resolve.js';
import { instantiate } from './instantiate.js';
import formatHelpers from './format-helpers.js';

export { ModuleNamespace }

export default SystemJSLoader;

function SystemJSLoader (baseKey) {
  RegisterLoader.call(this, baseKey);

  // NB deprecate
  this._loader = {};

  // internal configuration
  this[CONFIG] = {
    // this means paths normalization has already happened
    pathsLocked: false,

    baseURL: baseURI,
    paths: {},

    packageConfigPaths: [],
    packageConfigKeys: [],
    map: {},
    packages: {},
    depCache: {},
    meta: {},
    bundles: {},

    production: false,

    // traceur is default transpiler
    transpiler: 'traceur',
    loadedBundles: {},

    // global behaviour flags
    warnings: false,
    pluginFirst: false,

    // enable wasm loading and detection when supported
    wasm: false
  };

  // make the location of the system.js script accessible (if any)
  this.scriptSrc = scriptSrc;

  this._nodeRequire = nodeRequire;

  // support the empty module, as a concept
  this.set('@empty', emptyModule = this.newModule({}));

  setProduction.call(this, false, false);

  // add module format helpers
  formatHelpers(this);
}

export var emptyModule;

export var envModule;
export function setProduction (isProduction, isBuilder) {
  this[CONFIG].production = isProduction;
  this.set('@system-env', envModule = this.newModule({
    browser: isBrowser,
    node: !!this._nodeRequire,
    production: !isBuilder && isProduction,
    dev: isBuilder || !isProduction,
    build: isBuilder,
    'default': true
  }));
}

export var CONFIG = createSymbol('loader-config');
export var CREATE_METADATA = SystemJSLoader.createMetadata = RegisterLoader.createMetadata;
var RESOLVE = SystemJSLoader.resolve = RegisterLoader.resolve;
var INSTANTIATE = SystemJSLoader.instantiate = RegisterLoader.instantiate;

SystemJSLoader.prototype = Object.create(RegisterLoader.prototype);

SystemJSLoader.prototype.constructor = SystemJSLoader;

SystemJSLoader.prototype[CREATE_METADATA] = function () {
  return {
    registered: false,
    pluginKey: undefined,
    pluginArgument: undefined,
    pluginModule: undefined,
    packageKey: undefined,
    packageConfig: undefined,
    load: undefined
  };
};

SystemJSLoader.prototype[RESOLVE] = normalize;

// NB deprecate decanonicalize
SystemJSLoader.prototype.decanonicalize = SystemJSLoader.prototype.normalizeSync = normalizeSync;

SystemJSLoader.prototype[INSTANTIATE] = instantiate;

SystemJSLoader.prototype.config = setConfig;
SystemJSLoader.prototype.getConfig = getConfig;

SystemJSLoader.prototype.global = global;

export var configNames = ['baseURL', 'map', 'paths', 'packages', 'packageConfigPaths', 'depCache', 'meta', 'bundles', 'transpiler', 'warnings', 'pluginFirst', 'production'];

var hasProxy = typeof Proxy !== 'undefined';
for (var i = 0; i < configNames.length; i++) (function (configName) {
  Object.defineProperty(SystemJSLoader.prototype, configName, {
    get: function () {
      var cfg = getConfigItem(this[CONFIG], configName);

      if (hasProxy && typeof cfg === 'object')
        cfg = new Proxy(cfg, {
          set: function (target, option) {
            throw new Error('Cannot set SystemJS.' + configName + '["' + option + '"] directly. Use SystemJS.config({ ' + configName + ': { "' + option + '": ... } }) rather.');
          }
        });

      //if (typeof cfg === 'object')
      //  warn.call(this[CONFIG], 'Referencing `SystemJS.' + configName + '` is deprecated. Use the config getter `SystemJS.getConfig(\'' + configName + '\')`');
      return cfg;
    },
    set: function (name) {
      throw new Error('Setting `SystemJS.' + configName + '` directly is no longer supported. Use `SystemJS.config({ ' + configName + ': ... })`.');
    }
  });
})(configNames[i]);

/*
 * Backwards-compatible registry API, to be deprecated
 */
/* function registryWarn(loader, method) {
  warn.call(loader, 'SystemJS.' + method + ' is deprecated for SystemJS.registry.' + method);
} */
SystemJSLoader.prototype.delete = function (key) {
  // registryWarn(this, 'delete');
  this.registry.delete(key);
};
SystemJSLoader.prototype.get = function (key) {
  // registryWarn(this, 'get');
  return this.registry.get(key);
};
SystemJSLoader.prototype.has = function (key) {
  // registryWarn(this, 'has');
  return this.registry.has(key);
};
SystemJSLoader.prototype.set = function (key, module) {
  // registryWarn(this, 'set');
  return this.registry.set(key, module);
};
SystemJSLoader.prototype.newModule = function (bindings) {
  return new ModuleNamespace(bindings);
};

// ensure System.register and System.registerDynamic decanonicalize
SystemJSLoader.prototype.register = function (key, deps, declare) {
  if (typeof key === 'string')
    key = decanonicalize.call(this, this[CONFIG], key);
  return RegisterLoader.prototype.register.call(this, key, deps, declare);
};

SystemJSLoader.prototype.registerDynamic = function (key, deps, executingRequire, execute) {
  if (typeof key === 'string')
    key = decanonicalize.call(this, this[CONFIG], key);
  return RegisterLoader.prototype.registerDynamic.call(this, key, deps, executingRequire, execute);
};
