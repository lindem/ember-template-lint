'use strict';

const Rule = require('./base');
const Scope = require('./internal/scope');
const createErrorMessage = require('../helpers/create-error-message');

const WILDCARD = '*';

function hasForbiddenAttributes(node, withAttributesList) {
  debugger;
}

function makeConfiguredRule({name, withAttributes}) {
  return function checkInvocableBlacklist(node) {
    if (!withAttributes) {
      return true;
    } else {
      return hasForbiddenAttributes(node, withAttributes);
    }
  }
}

module.exports = class InvocableBlacklist extends Rule {
  parseConfig(config) {
    let errorMessage;

    switch (typeof config) {
      case 'boolean':
        if (!config) {
          return false;
        }
        break;
      case 'object':
        if (Array.isArray(config)) {
          // the configuration maps node and helper names to functions which
          // return true or false.
          return config.reduce((acc, configItem) => {
            if (typeof configItem === 'string') {
              return acc[configItem] = makeConfiguredRule({name: configItem});
            } else if (configItem !== null && 'name' in configItem) {
              acc[configItem.name] = makeConfiguredRule(configItem);
            } else {
              errorMessage = createErrorMessage(this.ruleName,
                ['  * array of strings or objects with "name" key - helpers ' +
                'or components to blacklist'], config);
              throw new Error(errorMessage);
            }
            // the default wildcard rule does nothing.
          }, {'*': () => false});
        }
        break;
      case
      'undefined':
        return false;
      case 'default':
        errorMessage = createErrorMessage(this.ruleName,
          ['  * array of strings (helpers or components to blacklist)'],
          config);
    }

    if (errorMessage) {
      throw new Error(errorMessage);
    }
  }

  visitor() {
    this._scope = new Scope();

    return {
      BlockStatement: {
        enter(node) {
          this._scope.pushFrame(node);
          this._checkBlacklist(node);
        },
        exit() {
          this._scope.popFrame();
        }
      },

      MustacheStatement(node) {
        this._checkBlacklist(node);
      },

      SubExpression(node) {
        this._checkBlacklist(node);
      }
    };
  }

  _checkBlacklist(node) {
    const name = node.path.original;
    let blacklist = this.config;
    if (blacklist['*'](node)) {
      this._logNode(node, 'wildcard');
    }
    if (name in blacklist && blacklist[name](node) &&
      checkForComponentHelper(node, name) && !this._scope.isLocal) {
      this._logNode(node, name);
    }
  }

  _logNode(node, name) {
    this.log({
      message: `Cannot use blacklisted helper or component '{{${name}}}'`,
      line: node.loc && node.loc.start.line,
      column: node.loc && node.loc.start.column,
      source: this.sourceForNode(node)
    });
  }
};

// node_modules\.bin\mocha --opts test\mocha.opts --recursive --grep invocable

function checkForComponentHelper(node, name) {
  return node.path.original === 'component' && node.params[0] &&
    node.params[0].original === name;
}
